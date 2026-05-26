import { ClogApiClient } from "./client";
import { ChatHistoryResponse, ChatSendRequest } from "./types";

export async function getChatHistory(
  client: ClogApiClient,
  projectId?: string,
): Promise<ChatHistoryResponse> {
  const query = projectId
    ? `?projectId=${encodeURIComponent(projectId)}`
    : "";
  return client.request<ChatHistoryResponse>(`/api/chat/history${query}`);
}

export function isChatSessionNotFoundMessage(message: string): boolean {
  return /채팅 세션을 찾을 수 없|CHAT_SESSION_NOT_FOUND/i.test(message);
}

export function buildChatSendBody(
  request: ChatSendRequest,
): ChatSendRequest {
  return {
    message: request.message,
    ...(request.chatSessionId ? { chatSessionId: request.chatSessionId } : {}),
    ...(request.projectId ? { projectId: request.projectId } : {}),
    ...(request.codeSnippets?.length
      ? { codeSnippets: request.codeSnippets }
      : {}),
  };
}
