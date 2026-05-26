export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
}

export interface UserResponse {
  id: number;
  name: string;
  nickname: string;
  email: string;
  socialId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectResponse {
  id: string;
  userId: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFileResponse {
  id: string;
  projectId: string;
  filePath: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeSnippet {
  fileName: string;
  language: string;
  startLine?: number;
  endLine?: number;
  code: string;
}

export interface ChatSendRequest {
  message: string;
  chatSessionId?: string;
  projectId?: string;
  codeSnippets?: CodeSnippet[];
}

export interface ChatMessageView {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  codeSnippets?: CodeSnippet[];
  reasoning?: string | null;
  markdown?: string | null;
  blogId?: number | null;
  createdAt: string;
}

export interface ChatHistoryResponse {
  sessionId: string;
  messages: ChatMessageView[];
}

export interface ExtensionPublishRequest {
  title: string;
  content: string;
  visibility: "PUBLIC" | "PRIVATE" | "LINKED";
  codeDiff?: string;
  codeContext?: string;
  prompt?: string;
  chatSessionId?: string;
}

export interface ExtensionPublishResponse {
  blogId: number;
  blogUrl: string;
}

export interface SseStreamState {
  thinking: string;
  assistant: string;
  previewMarkdown: string;
  chatSessionId?: string;
}

export interface WebviewAttachment {
  type?: string;
  name?: string;
  data?: string;
  fileName?: string;
  language?: string;
  lineStart?: number;
  lineEnd?: number;
}
