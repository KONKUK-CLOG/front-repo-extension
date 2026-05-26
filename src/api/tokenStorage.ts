import * as vscode from "vscode";

const ACCESS_TOKEN_KEY = "clog.accessToken";
const PROJECT_ID_KEY = "clog.projectId";
const CHAT_SESSION_ID_KEY = "clog.chatSessionId";

export class TokenStorage {
  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly globalState: vscode.Memento,
  ) {}

  getAccessToken(): Thenable<string | undefined> {
    return this.secrets.get(ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): Thenable<void> {
    return this.secrets.store(ACCESS_TOKEN_KEY, token);
  }

  clearAccessToken(): Thenable<void> {
    return this.secrets.delete(ACCESS_TOKEN_KEY);
  }

  getProjectId(): string | undefined {
    return this.globalState.get<string>(PROJECT_ID_KEY);
  }

  setProjectId(projectId: string): Thenable<void> {
    return this.globalState.update(PROJECT_ID_KEY, projectId);
  }

  getChatSessionId(): string | undefined {
    return this.globalState.get<string>(CHAT_SESSION_ID_KEY);
  }

  setChatSessionId(sessionId: string): Thenable<void> {
    return this.globalState.update(CHAT_SESSION_ID_KEY, sessionId);
  }

  clearSessionState(): Thenable<void> {
    return Promise.all([
      this.globalState.update(PROJECT_ID_KEY, undefined),
      this.globalState.update(CHAT_SESSION_ID_KEY, undefined),
    ]).then(() => undefined);
  }
}
