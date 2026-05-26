import { getApiBaseUrl } from "./config";
import { CLOG_API_DEBUG } from "./debug";
import { TokenStorage } from "./tokenStorage";
import { ApiResponse } from "./types";

function bodyToLogString(body: RequestInit["body"]): string {
  if (body == null) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  return String(body);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function formatHttpErrorMessage(
  status: number,
  bodyText: string,
): string {
  if (status === 401 || status === 403) {
    return "인증이 만료되었거나 유효하지 않습니다. GitHub로 다시 로그인해주세요.";
  }

  if (bodyText.trim()) {
    try {
      const payload = JSON.parse(bodyText) as ApiResponse<unknown>;
      if (payload.error) {
        return payload.error;
      }
    } catch {
      if (bodyText.length < 500) {
        return bodyText;
      }
    }
  }

  return `API 요청 실패 (${status})`;
}

export class ClogApiClient {
  constructor(
    private readonly tokenStorage: TokenStorage,
    private readonly log?: (line: string) => void,
    private readonly traceEnabled: boolean = CLOG_API_DEBUG,
  ) {}

  trace(line: string) {
    if (!this.traceEnabled) {
      return;
    }
    this.log?.(line);
  }

  async request<T>(
    path: string,
    init: RequestInit = {},
    options: { auth?: boolean } = {},
  ): Promise<T> {
    const auth = options.auth !== false;
    const headers = new Headers(init.headers);

    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }

    let token: string | undefined;
    if (auth) {
      token = await this.tokenStorage.getAccessToken();
      if (!token) {
        throw new ApiError("CLOG JWT가 없습니다. 다시 로그인해주세요.", 401);
      }
      headers.set("Authorization", `Bearer ${token}`);
    }

    const method = init.method ?? "GET";
    const url = `${getApiBaseUrl()}${path}`;
    this.trace(`[API] >>> ${method} ${url}`);
    if (token) {
      this.trace(`[API] Authorization: Bearer ${token}`);
    }
    const bodyLog = bodyToLogString(init.body);
    if (bodyLog) {
      this.trace(`[API] request body: ${bodyLog}`);
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const responseText = await response.text();
    this.trace(
      `[API] <<< ${method} ${url} status=${response.status} content-type=${contentType}`,
    );
    this.trace(`[API] response body: ${responseText || "(empty)"}`);

    if (!response.ok) {
      throw new ApiError(
        formatHttpErrorMessage(response.status, responseText),
        response.status,
        responseText,
      );
    }

    if (!contentType.includes("application/json")) {
      throw new ApiError(
        "예상하지 못한 응답 형식입니다.",
        response.status,
        responseText,
      );
    }

    let wrapped: ApiResponse<T>;
    try {
      wrapped = JSON.parse(responseText) as ApiResponse<T>;
    } catch {
      throw new ApiError(
        "JSON 파싱 실패",
        response.status,
        responseText,
      );
    }

    if (!wrapped.success) {
      throw new ApiError(
        wrapped.error ?? "API 요청에 실패했습니다.",
        response.status,
        responseText,
      );
    }

    if (wrapped.data === null || wrapped.data === undefined) {
      throw new ApiError(
        "응답 데이터가 비어 있습니다.",
        response.status,
        responseText,
      );
    }

    return wrapped.data;
  }

  async requestVoid(
    path: string,
    init: RequestInit = {},
  ): Promise<void> {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }

    const token = await this.tokenStorage.getAccessToken();
    if (!token) {
      throw new ApiError("CLOG JWT가 없습니다. 다시 로그인해주세요.", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);

    const method = init.method ?? "GET";
    const url = `${getApiBaseUrl()}${path}`;
    this.trace(`[API] >>> ${method} ${url}`);
    this.trace(`[API] Authorization: Bearer ${token}`);
    const bodyLog = bodyToLogString(init.body);
    if (bodyLog) {
      this.trace(`[API] request body: ${bodyLog}`);
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    const responseText = await response.text();
    this.trace(
      `[API] <<< ${method} ${url} status=${response.status}`,
    );
    this.trace(`[API] response body: ${responseText || "(empty)"}`);

    if (!response.ok) {
      throw new ApiError(
        formatHttpErrorMessage(response.status, responseText),
        response.status,
        responseText,
      );
    }
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.tokenStorage.getAccessToken();
  }

  async requestSse(
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<Response> {
    const token = await this.tokenStorage.getAccessToken();
    if (!token) {
      throw new ApiError("CLOG JWT가 없습니다. 다시 로그인해주세요.", 401);
    }

    const url = `${getApiBaseUrl()}${path}`;
    const bodyJson = JSON.stringify(body);
    this.trace(`[API] >>> POST ${url} (SSE)`);
    this.trace(`[API] Authorization: Bearer ${token}`);
    this.trace(`[API] request body: ${bodyJson}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: bodyJson,
      signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    this.trace(
      `[API] <<< POST ${url} status=${response.status} content-type=${contentType} (SSE headers only, body=stream)`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.trace(`[API] SSE error body: ${errorText || "(empty)"}`);
      throw new ApiError(
        formatHttpErrorMessage(response.status, errorText),
        response.status,
        errorText,
      );
    }

    return response;
  }
}
