import { SseStreamState } from "./types";

export interface SseEventHandlers {
  onEvent?: (eventName: string, data: unknown) => void;
  onThinkingDelta?: (delta: string, aggregate: string) => void;
  onAssistantDelta?: (delta: string, aggregate: string) => void;
  onPreviewDelta?: (delta: string, aggregate: string) => void;
  onSessionId?: (sessionId: string) => void;
  onError?: (message: string) => void;
}

export async function consumeSseResponse(
  stream: ReadableStream<Uint8Array>,
  streamState: SseStreamState,
  handlers: SseEventHandlers,
  abortSignal: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) {
        continue;
      }

      const packet = parseSseEvent(part);
      if (!packet) {
        continue;
      }

      handleSsePacket(packet, streamState, handlers);
    }
  }

  if (!abortSignal.aborted && buffer.trim()) {
    const packet = parseSseEvent(buffer);
    if (packet) {
      handleSsePacket(packet, streamState, handlers);
    }
  }
}

function parseSseEvent(
  rawEvent: string,
): { event: string; data: unknown } | undefined {
  const lines = rawEvent.split(/\r?\n/);
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return undefined;
  }

  const dataText = dataLines.join("\n");
  if (!dataText || dataText === "[DONE]") {
    return undefined;
  }

  try {
    return { event: eventName, data: JSON.parse(dataText) as unknown };
  } catch {
    return { event: eventName, data: dataText };
  }
}

function handleSsePacket(
  packet: { event: string; data: unknown },
  streamState: SseStreamState,
  handlers: SseEventHandlers,
): void {
  const eventName = packet.event;
  handlers.onEvent?.(eventName, packet.data);
  const normalized =
    typeof packet.data === "string"
      ? { text: packet.data }
      : packet.data && typeof packet.data === "object"
        ? (packet.data as Record<string, unknown>)
        : {};

  if (eventName === "error") {
    const message = extractString(normalized, ["message", "error", "text"]);
    handlers.onError?.(message || "LLM 스트림 오류가 발생했습니다.");
    return;
  }

  if (eventName === "done") {
    const sessionId = extractString(normalized, ["sessionId"]);
    if (sessionId) {
      streamState.chatSessionId = sessionId;
      handlers.onSessionId?.(sessionId);
    }
    return;
  }

  if (
    eventName === "started" ||
    eventName.startsWith("iteration_") ||
    eventName.startsWith("tool_") ||
    eventName === "final_running"
  ) {
    const statusText = formatStatusEvent(eventName, normalized);
    if (statusText) {
      streamState.thinking = streamState.thinking
        ? `${streamState.thinking}\n${statusText}`
        : statusText;
      handlers.onThinkingDelta?.(statusText, streamState.thinking);
    }
    return;
  }

  if (eventName === "answer") {
    const delta = extractString(normalized, [
      "text",
      "content",
      "delta",
      "answer",
    ]);
    if (!delta) {
      return;
    }

    streamState.assistant += delta;
    handlers.onAssistantDelta?.(delta, streamState.assistant);
    return;
  }

  if (eventName === "blog") {
    const delta = extractString(normalized, [
      "markdown",
      "blog_markdown",
      "content",
      "text",
      "delta",
    ]);
    if (!delta) {
      return;
    }

    streamState.previewMarkdown += delta;
    handlers.onPreviewDelta?.(delta, streamState.previewMarkdown);
    return;
  }

  if (eventName === "complete") {
    const finalAnswer = extractString(normalized, [
      "final_response",
      "finalResponse",
    ]);
    const artifact =
      normalized.final_artifact && typeof normalized.final_artifact === "object"
        ? (normalized.final_artifact as Record<string, unknown>)
        : normalized.finalArtifact &&
            typeof normalized.finalArtifact === "object"
          ? (normalized.finalArtifact as Record<string, unknown>)
          : undefined;

    const artifactAnswer = artifact
      ? extractString(artifact, ["answer"])
      : "";
    const artifactMarkdown = artifact
      ? extractString(artifact, ["blog_markdown", "blogMarkdown", "markdown"])
      : "";

    const assistant = finalAnswer || artifactAnswer;
    if (assistant) {
      streamState.assistant = assistant;
      handlers.onAssistantDelta?.("", assistant);
    }

    if (artifactMarkdown) {
      streamState.previewMarkdown = artifactMarkdown;
      handlers.onPreviewDelta?.("", artifactMarkdown);
    }
  }
}

function formatStatusEvent(
  eventName: string,
  data: Record<string, unknown>,
): string {
  const message = extractString(data, ["message", "status", "text"]);
  if (message) {
    return message;
  }

  if (eventName.startsWith("tool_")) {
    return `[도구] ${eventName.replace(/^tool_/, "")}`;
  }

  if (eventName.startsWith("iteration_")) {
    return `[반복] ${eventName.replace(/^iteration_/, "")}`;
  }

  switch (eventName) {
    case "started":
      return "생성을 시작합니다...";
    case "final_running":
      return "최종 결과를 작성 중입니다...";
    default:
      return "";
  }
}

function extractString(
  source: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
}

export function mapAttachmentsToCodeSnippets(
  attachments: unknown[],
): import("./types").CodeSnippet[] {
  const snippets: import("./types").CodeSnippet[] = [];

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== "object") {
      continue;
    }

    const item = attachment as Record<string, unknown>;
    const code = typeof item.data === "string" ? item.data : "";
    if (!code.trim()) {
      continue;
    }

    const fileName =
      typeof item.fileName === "string"
        ? item.fileName
        : typeof item.name === "string"
          ? item.name.replace(/\s*\(줄\s+\d+-\d+\)$/, "")
          : "snippet";
    const language =
      typeof item.language === "string" ? item.language : "plaintext";

    snippets.push({
      fileName,
      language,
      code,
      ...(typeof item.lineStart === "number"
        ? { startLine: item.lineStart }
        : {}),
      ...(typeof item.lineEnd === "number" ? { endLine: item.lineEnd } : {}),
    });
  }

  return snippets;
}
