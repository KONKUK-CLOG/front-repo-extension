import { getApiBaseUrl } from "./config";
import { ClogApiClient } from "./client";
import { listProjects } from "./projects";
import { isJwtExpired } from "./jwt";

/**
 * 로그인 직후 API 연동 환경 스모크 — Output 채널에 전부 기록.
 */
export async function runApiIntegrationProbe(
  client: ClogApiClient,
  githubAccessToken: string,
  projectId?: string,
): Promise<void> {
  const base = getApiBaseUrl();
  client.trace("");
  client.trace("========== CLOG API 연동 프로브 ==========");
  client.trace(`[Probe] apiBaseUrl=${base}`);
  client.trace(`[Probe] time=${new Date().toISOString()}`);

  client.trace("[Probe] 1) 공개 API GET /api/blogs/published");
  try {
    const res = await fetch(`${base}/api/blogs/published`);
    const text = await res.text();
    client.trace(`[Probe] published status=${res.status} body=${text}`);
  } catch (error) {
    client.trace(
      `[Probe] published FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  client.trace("[Probe] 2) JWT POST /api/auth/github/token");
  try {
    const res = await fetch(`${base}/api/auth/github/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubAccessToken }),
    });
    const text = await res.text();
    client.trace(`[Probe] auth status=${res.status} body=${text}`);
  } catch (error) {
    client.trace(
      `[Probe] auth FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const jwt = await client.getAccessToken();
  if (!jwt) {
    client.trace("[Probe] 3) SKIP — SecretStorage에 CLOG JWT 없음");
    client.trace("========== 프로브 종료 ==========");
    return;
  }

  client.trace(`[Probe] 3) 저장된 JWT exp 만료? ${isJwtExpired(jwt)}`);

  client.trace("[Probe] 4) GET /api/projects (Bearer)");
  try {
    const projects = await listProjects(client);
    client.trace(`[Probe] projects OK count=${projects.length} data=${JSON.stringify(projects)}`);
  } catch (error) {
    client.trace(
      `[Probe] projects FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  client.trace(`[Probe] 5) SSE POST /api/blogs/generate projectId=${projectId ?? "(none)"}`);
  try {
    const controller = new AbortController();
    const res = await client.requestSse(
      "/api/blogs/generate",
      {
        message: "api probe ping",
        ...(projectId ? { projectId } : {}),
      },
      controller.signal,
    );

    if (!res.body) {
      client.trace("[Probe] SSE FAIL: response.body 없음");
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let chunks = 0;
      const deadline = Date.now() + 15_000;

      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        chunks += 1;
        raw += decoder.decode(value, { stream: true });
        if (raw.length > 4000) {
          client.trace("[Probe] SSE raw (truncated at 4000 chars): " + raw.slice(0, 4000));
          raw = "";
          break;
        }
      }

      if (raw) {
        client.trace(`[Probe] SSE raw (${chunks} chunks): ${raw}`);
      }
      client.trace(`[Probe] SSE stream ended chunks=${chunks}`);
    }
  } catch (error) {
    client.trace(
      `[Probe] SSE FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  client.trace("========== 프로브 종료 ==========");
  client.trace("");
}
