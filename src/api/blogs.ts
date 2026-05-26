import { ClogApiClient } from "./client";
import {
  ChatSendRequest,
  ExtensionPublishRequest,
  ExtensionPublishResponse,
} from "./types";
import { buildChatSendBody } from "./chat";

export async function publishExtensionBlog(
  client: ClogApiClient,
  request: ExtensionPublishRequest,
): Promise<ExtensionPublishResponse> {
  return client.request<ExtensionPublishResponse>(
    "/api/blogs/extension/publish",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}

export async function streamBlogGenerate(
  client: ClogApiClient,
  request: ChatSendRequest,
  signal: AbortSignal,
): Promise<Response> {
  return client.requestSse(
    "/api/blogs/generate",
    buildChatSendBody(request),
    signal,
  );
}

export async function streamChatSend(
  client: ClogApiClient,
  request: ChatSendRequest,
  signal: AbortSignal,
): Promise<Response> {
  return client.requestSse("/api/chat/send", buildChatSendBody(request), signal);
}

export function extractTitleFromMarkdown(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim().slice(0, 150);
  }

  const firstLine = markdown
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine) {
    return firstLine.replace(/^#+\s*/, "").slice(0, 150);
  }

  return "Untitled Blog Post";
}
