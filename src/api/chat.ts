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
