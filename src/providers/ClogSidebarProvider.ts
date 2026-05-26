import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exchangeGithubToken } from "../api/auth";
import { streamBlogGenerate, publishExtensionBlog, extractTitleFromMarkdown } from "../api/blogs";
import { ApiError, ClogApiClient, formatHttpErrorMessage } from "../api/client";
import { isJwtExpired } from "../api/jwt";
import { formatPublishedBlogUrl } from "../api/blogUrl";
import { getApiBaseUrl } from "../api/config";
import { CLOG_API_DEBUG } from "../api/debug";
import { ensureWorkspaceProject } from "../api/projects";
import {
  getCachedFileEntry,
  isProjectSyncCacheValid,
  loadProjectSyncCache,
  saveProjectSyncCache,
  ProjectSyncCache,
} from "../sync/projectSyncCache";
import {
  ensureWorkspaceFileInCache,
  resolveRelativePathForDocument,
  syncEntireWorkspaceToServer,
  syncSavedFileDiffToServer,
} from "../sync/projectSync";
import {
  getWorkspaceFolder,
  resolveWorkspaceProjectName,
} from "../sync/workspaceFiles";
import { getUserIdFromToken } from "../api/jwt";
import { buildChatSendBody, isChatSessionNotFoundMessage } from "../api/chat";
import { runApiIntegrationProbe } from "../api/apiProbe";
import { consumeSseResponse, mapAttachmentsToCodeSnippets } from "../api/sse";
import { TokenStorage } from "../api/tokenStorage";
import { SseStreamState } from "../api/types";
import {
  openPreviewPanel,
  setPreviewPublishHandler,
  updatePreviewPanelContent,
} from "../utils/previewPanel";

/**
 * 사이드바 Webview Provider 클래스
 * 코파일럿처럼 사이드바에 표시되는 채팅 UI를 관리
 */
export class ClogSidebarProvider implements vscode.WebviewViewProvider {
  public view?: vscode.WebviewView;
  private readonly _projectSyncCacheUri: vscode.Uri;
  private _projectSyncCache: ProjectSyncCache | null = null;
  private readonly _debugOutput: vscode.OutputChannel;
  private _activeRequestController?: AbortController;
  private _latestPreviewMarkdown = "";
  private _lastSavePatch = "";
  private readonly _tokenStorage: TokenStorage;
  private readonly _apiClient: ClogApiClient;
  private _loginPromise?: Promise<boolean>;
  private _syncWorkspacePromise?: Promise<void>;
  private static readonly _githubScopes = ["read:user", "user:email"];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this._debugOutput = vscode.window.createOutputChannel(
      "Clog API Debug",
    );
    this._tokenStorage = new TokenStorage(
      this._context.secrets,
      this._context.globalState,
    );
    this._apiClient = new ClogApiClient(
      this._tokenStorage,
      CLOG_API_DEBUG ? (line) => this._debugLog(line) : undefined,
    );
    this._projectSyncCacheUri = vscode.Uri.joinPath(
      this._context.storageUri ?? this._context.globalStorageUri,
      "clog-project-sync-cache.json",
    );
    this._projectSyncCache = loadProjectSyncCache(this._projectSyncCacheUri);

    setPreviewPublishHandler((html) =>
      void this._publishPreviewMarkdown(this._latestPreviewMarkdown, html),
    );

    this._context.subscriptions.push(this._debugOutput);
  }

  private _bindPreviewPublish(
    markdown?: string,
  ): (html: string) => void | Promise<void> {
    const md = markdown ?? this._latestPreviewMarkdown;
    return (html) => void this._publishPreviewMarkdown(md, html);
  }

  /**
   * Webview 뷰가 생성될 때 호출
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 웹뷰로부터 메시지 받기
    this._setWebviewMessageListener(webviewView);

    this._debugLog("========== Clog webview 시작 ==========");
    this._debugLog(`[Env] apiBaseUrl=${getApiBaseUrl()}`);
    void this._syncGitHubAuthState();

  }

  /**
   * 웹뷰 메시지 리스너 등록
   */
  private _setWebviewMessageListener(webviewView: vscode.WebviewView) {
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "loginRequest":
        case "loginSuccess":
          void this._handleGitHubLogin();
          break;
        case "requestAuthState":
          void this._syncGitHubAuthState();
          break;
        case "authSuccess":
          void this._syncEntireWorkspace();
          break;
        case "requestSnapshotState": {
          const cache =
            this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);
          const fileCount = cache ? Object.keys(cache.files).length : 0;
          if (fileCount > 0) {
            this._postMessage({
              type: "snapshotReady",
              fileName: `${fileCount}개 파일`,
              filePath: cache?.workspaceRoot ?? "",
              language: "synced",
              savedAt: cache?.syncedAt ?? "",
            });
          } else {
            this._postMessage({
              type: "snapshotMissing",
              message: "로그인 후 워크스페이스 동기화가 아직 완료되지 않았습니다.",
            });
          }
          break;
        }
        case "requestCode":
          this.sendSelectedCode();
          break;
        case "sendPrompt":
          void this._handlePromptRequest(message);
          break;
        case "cancelPrompt":
          this._activeRequestController?.abort();
          break;
        case "openPreview": {
          const markdown =
            typeof message.markdown === "string"
              ? message.markdown
              : this._latestPreviewMarkdown;
          if (!markdown?.trim()) {
            void vscode.window.showWarningMessage(
              "미리볼 블로그 초안이 없습니다. 먼저 채팅으로 블로그를 생성해주세요.",
            );
            break;
          }
          openPreviewPanel(
            this._extensionUri,
            markdown,
            this._bindPreviewPublish(markdown),
          );
          break;
        }
      }
    });
  }

  private async _syncGitHubAuthState() {
    const session = await this._getGitHubSession(true);
    const accessToken = await this._tokenStorage.getAccessToken();

    if (session && !accessToken) {
      this._debugLog(
        "[Clog Auth] GitHub 세션은 있으나 CLOG JWT 없음 → 백엔드 교환 시도",
      );
      const loggedIn = await this._handleGitHubLogin();
      this._postAuthState(Boolean(session && loggedIn), session);
      return;
    }

    let isLoggedIn = Boolean(session && accessToken);

    if (isLoggedIn && accessToken && isJwtExpired(accessToken)) {
      this._debugLog("[Clog Auth] 저장된 CLOG JWT 만료");
      await this._tokenStorage.clearAccessToken();
      isLoggedIn = false;
      this._postMessage({
        type: "authError",
        message: "CLOG JWT가 만료되었습니다. 다시 로그인해주세요.",
      });
    }

    if (isLoggedIn && session && accessToken) {
      this._logAuthDebug(session, accessToken);
    } else if (session) {
      this._debugLog(
        `[Clog Auth] GitHub만 연결됨 (${session.account.label}), CLOG JWT 없음`,
      );
    } else {
      this._debugLog("[Clog Auth] GitHub·CLOG JWT 모두 없음");
    }

    if (isLoggedIn && accessToken) {
      await this._ensureWorkspaceProjectForCurrentFolder();
      const folder = getWorkspaceFolder();
      const cache =
        this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);
      if (
        !isProjectSyncCacheValid(
          cache,
          this._tokenStorage.getProjectId(),
          folder?.uri.fsPath,
        )
      ) {
        void this._syncEntireWorkspace();
      }
    }

    this._postAuthState(isLoggedIn, session);
  }

  private _debugLog(line: string) {
    if (!CLOG_API_DEBUG) {
      return;
    }
    const stamp = new Date().toISOString();
    this._debugOutput.appendLine(`${stamp} ${line}`);
  }

  private _probeLog(line: string) {
    const stamp = new Date().toISOString();
    this._debugOutput.appendLine(`${stamp} ${line}`);
  }

  private _postAuthState(
    isLoggedIn: boolean,
    session?: vscode.AuthenticationSession,
  ) {
    this._postMessage({
      type: "authStateChanged",
      isLoggedIn,
      accountLabel: session?.account.label ?? "",
      scopes: session?.scopes ?? [],
    });
  }

  private async _handleGitHubLogin(): Promise<boolean> {
    if (this._loginPromise) {
      return this._loginPromise;
    }

    this._loginPromise = this._performGitHubLogin();

    try {
      return await this._loginPromise;
    } finally {
      this._loginPromise = undefined;
    }
  }

  private async _performGitHubLogin(): Promise<boolean> {
    try {
      const session = await this._getGitHubSession(false);

      if (!session) {
        this._postAuthState(false);
        return false;
      }

      const auth = await exchangeGithubToken(
        this._apiClient,
        session.accessToken,
      );
      await this._tokenStorage.setAccessToken(auth.accessToken);

      this._postAuthState(true, session);

      try {
        await this._initializeWorkspaceSession();
      } catch (error) {
        const messageText =
          error instanceof ApiError
            ? error.message
            : "워크스페이스 프로젝트 연결에 실패했습니다.";
        vscode.window.showWarningMessage(
          `Clog: ${messageText} (채팅은 projectId 없이 시도됩니다.)`,
        );
      }

      await this._syncEntireWorkspace();
      this._logAuthDebug(session, auth.accessToken);

      void runApiIntegrationProbe(
        this._apiClient,
        session.accessToken,
        this._tokenStorage.getProjectId(),
      );

      return true;
    } catch (error) {
      await this._tokenStorage.clearAccessToken();

      const messageText =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "GitHub 로그인에 실패했습니다.";

      this._postMessage({
        type: "authError",
        message: messageText,
      });
      this._postAuthState(false);
      return false;
    }
  }

  /**
   * VS Code에서 다른 폴더를 열었을 때 호출 (extension.ts).
   */
  public async handleWorkspaceFoldersChanged(): Promise<void> {
    const accessToken = await this._tokenStorage.getAccessToken();
    if (!accessToken || isJwtExpired(accessToken)) {
      return;
    }

    const previousProjectId = this._tokenStorage.getProjectId();
    await this._ensureWorkspaceProjectForCurrentFolder();
    const folder = getWorkspaceFolder();
    const cache =
      this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);

    if (
      previousProjectId !== this._tokenStorage.getProjectId() ||
      !isProjectSyncCacheValid(
        cache,
        this._tokenStorage.getProjectId(),
        folder?.uri.fsPath,
      )
    ) {
      this._debugLog(
        "[Workspace] 폴더 변경 — 프로젝트/캐시 재동기화",
      );
      this._projectSyncCache = null;
      void this._syncEntireWorkspace();
    }
  }

  private async _ensureWorkspaceProjectForCurrentFolder(): Promise<void> {
    const folder = getWorkspaceFolder();
    if (!folder) {
      return;
    }

    const previousProjectId = this._tokenStorage.getProjectId();
    await this._initializeWorkspaceSession();
    const projectId = this._tokenStorage.getProjectId();
    const projectName = resolveWorkspaceProjectName(folder.uri.fsPath);

    if (previousProjectId && previousProjectId !== projectId) {
      this._debugLog(
        `[Workspace] projectId 변경 ${previousProjectId} → ${projectId} (name=${projectName})`,
      );
      this._projectSyncCache = null;
    }
  }

  private async _initializeWorkspaceSession() {
    const folder = getWorkspaceFolder();
    const workspaceName = folder
      ? resolveWorkspaceProjectName(folder.uri.fsPath)
      : "clog-extension-workspace";

    this._debugLog(`[Workspace] CLOG project name=${workspaceName}`);

    const project = await ensureWorkspaceProject(
      this._apiClient,
      workspaceName,
    );
    await this._tokenStorage.setProjectId(project.id);
  }

  private async _syncEntireWorkspace(): Promise<void> {
    if (this._syncWorkspacePromise) {
      this._debugLog("[Initial Sync] 이미 진행 중 — 기존 작업 대기");
      return this._syncWorkspacePromise;
    }

    this._syncWorkspacePromise = this._runInitialSync();
    try {
      await this._syncWorkspacePromise;
    } finally {
      this._syncWorkspacePromise = undefined;
    }
  }

  private async _runInitialSync(): Promise<void> {
    const projectId = this._tokenStorage.getProjectId();
    if (!projectId) {
      this._debugLog("[Initial Sync] SKIP — projectId 없음");
      return;
    }

    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      this._debugLog("[Initial Sync] SKIP — 워크스페이스 폴더 없음");
      return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    let existing = this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);
    if (
      !isProjectSyncCacheValid(existing, projectId, workspaceRoot)
    ) {
      this._debugLog(
        "[Initial Sync] 캐시 무효화 (다른 워크스페이스 또는 프로젝트)",
      );
      existing = null;
      this._projectSyncCache = null;
    }

    try {
      const { cache, created, skipped, failed, fileQuotaExceeded } =
        await syncEntireWorkspaceToServer(
          this._apiClient,
          projectId,
          existing,
          (line) => this._debugLog(line),
        );

      saveProjectSyncCache(this._projectSyncCacheUri, cache);
      this._projectSyncCache = cache;

      this._debugLog(
        `[Initial Sync] 완료 POST=${created} cached=${Object.keys(cache.files).length} skipped=${skipped} failed=${failed.length}${fileQuotaExceeded ? " quotaExceeded=true" : ""}`,
      );

      if (fileQuotaExceeded) {
        void vscode.window.showWarningMessage(
          "Clog: 서버 프로젝트당 파일 개수 한도에 도달해 일부 파일을 업로드하지 못했습니다. 웹/관리자에서 오래된 파일을 정리하거나 새 프로젝트로 작업해 주세요.",
        );
      } else if (failed.length > 0) {
        this._debugLog(
          `[Initial Sync] 실패 파일: ${failed.slice(0, 10).join(", ")}${failed.length > 10 ? " …" : ""}`,
        );
        void vscode.window.showWarningMessage(
          `Clog: ${failed.length}개 파일 동기화에 실패했습니다. Output(Clog API Debug)를 확인해주세요.`,
        );
      }

      this._postMessage({
        type: "snapshotReady",
        fileName: `${Object.keys(cache.files).length}개 파일`,
        filePath: cache.workspaceRoot,
        language: "synced",
        savedAt: cache.syncedAt,
      });
    } catch (error) {
      const messageText =
        error instanceof ApiError
          ? error.message
          : "워크스페이스 동기화에 실패했습니다.";
      this._debugLog(`[Initial Sync] error: ${messageText}`);
      this._postMessage({
        type: "snapshotError",
        message: messageText,
      });
    }
  }

  private async _syncSavedDocument(
    document: vscode.TextDocument,
  ): Promise<void> {
    let projectId = this._tokenStorage.getProjectId();
    if (!projectId) {
      const accessToken = await this._tokenStorage.getAccessToken();
      if (!accessToken) {
        this._debugLog("[Ctrl+S] SKIP — CLOG JWT 없음 (사이드바에서 로그인)");
        void vscode.window.showWarningMessage(
          "Clog: 로그인 후 Ctrl+S 동기화를 사용할 수 있습니다.",
        );
        return;
      }
      try {
        await this._initializeWorkspaceSession();
        projectId = this._tokenStorage.getProjectId();
      } catch (error) {
        const messageText =
          error instanceof ApiError
            ? error.message
            : "프로젝트 연결에 실패했습니다.";
        this._debugLog(`[Ctrl+S] SKIP — projectId 없음: ${messageText}`);
        void vscode.window.showWarningMessage(`Clog: ${messageText}`);
        return;
      }
    }

    if (!projectId) {
      this._debugLog("[Ctrl+S] SKIP — projectId 없음");
      return;
    }

    await this._ensureWorkspaceProjectForCurrentFolder();
    projectId = this._tokenStorage.getProjectId() ?? projectId;

    const workspaceFolder = getWorkspaceFolder();
    const workspaceRoot = workspaceFolder?.uri.fsPath;

    let cache =
      this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);
    if (!isProjectSyncCacheValid(cache, projectId, workspaceRoot)) {
      await this._ensureWorkspaceProjectForCurrentFolder();
      const nextProjectId = this._tokenStorage.getProjectId();
      if (!nextProjectId) {
        this._debugLog("[Ctrl+S] SKIP — projectId 없음");
        return;
      }
      this._debugLog("[Ctrl+S] 캐시 없음 → Initial Sync 재시도");
      await this._syncEntireWorkspace();
      cache =
        this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);
      projectId = nextProjectId;
    }

    if (!isProjectSyncCacheValid(cache, projectId, workspaceRoot) || !cache) {
      this._debugLog("[Ctrl+S] SKIP — Initial Sync 후에도 캐시 없음");
      void vscode.window.showWarningMessage(
        "Clog: 워크스페이스 동기화에 실패했습니다. Output(Clog API Debug)를 확인해주세요.",
      );
      return;
    }

    if (!workspaceFolder) {
      this._debugLog("[Ctrl+S] SKIP — 워크스페이스 폴더 없음");
      return;
    }

    const relativePath = resolveRelativePathForDocument(
      workspaceFolder.uri.fsPath,
      document.fileName,
    );
    if (!relativePath) {
      this._debugLog(`[Ctrl+S] SKIP — 워크스페이스 밖 파일: ${document.fileName}`);
      return;
    }

    try {
      if (!getCachedFileEntry(cache, relativePath)) {
        cache = await ensureWorkspaceFileInCache(
          this._apiClient,
          projectId,
          cache,
          relativePath,
          document.getText(),
          document.languageId,
          (line) => this._debugLog(line),
        );
        saveProjectSyncCache(this._projectSyncCacheUri, cache);
        this._projectSyncCache = cache;
      }

      const { cache: nextCache, result } = await syncSavedFileDiffToServer(
        this._apiClient,
        cache,
        relativePath,
        document.getText(),
        document.languageId,
        (line) => this._debugLog(line),
      );

      saveProjectSyncCache(this._projectSyncCacheUri, nextCache);
      this._projectSyncCache = nextCache;

      if (result.patch) {
        this._lastSavePatch = result.patch;
      }
    } catch (error) {
      const messageText =
        error instanceof ApiError
          ? error.message
          : "파일 diff 동기화에 실패했습니다.";
      this._debugLog(`[Ctrl+S] error: ${messageText}`);
      vscode.window.showWarningMessage(`Clog: ${messageText}`);
    }
  }

  private _collectAccumulatedCodeDiff(): string | undefined {
    const cache =
      this._projectSyncCache ?? loadProjectSyncCache(this._projectSyncCacheUri);
    const parts = cache
      ? Object.values(cache.files)
          .map((entry) => entry.lastDiff)
          .filter((diff): diff is string => Boolean(diff))
      : [];

    if (parts.length > 0) {
      return parts.join("\n\n");
    }

    return this._lastSavePatch || undefined;
  }

  private async _publishPreviewMarkdown(markdown: string, htmlContent?: string) {
    const content = (htmlContent?.trim() || markdown.trim());
    if (!content) {
      vscode.window.showErrorMessage("발행할 블로그 내용이 없습니다.");
      return;
    }

    this._debugLog("[Publish] >>> POST /api/blogs/extension/publish");
    this._debugLog(
      `[Publish] content length=${content.length} markdownFallbackLen=${markdown.trim().length}`,
    );

    try {
      const response = await publishExtensionBlog(this._apiClient, {
        title: extractTitleFromMarkdown(markdown || content),
        content,
        visibility: "PUBLIC",
        chatSessionId: this._tokenStorage.getChatSessionId(),
        codeDiff: this._collectAccumulatedCodeDiff(),
      });
      const publicUrl = formatPublishedBlogUrl(
        response.blogId,
        response.blogUrl,
      );
      this._debugLog(
        `[Publish] <<< OK blogId=${response.blogId} url=${publicUrl}`,
      );

      vscode.window
        .showInformationMessage(
          `블로그 포스트가 발행되었습니다.\n${publicUrl}`,
          "열기",
        )
        .then((choice) => {
          if (choice === "열기") {
            void vscode.env.openExternal(vscode.Uri.parse(publicUrl));
          }
        });
    } catch (error) {
      const messageText =
        error instanceof ApiError
          ? error.message
          : "블로그 발행에 실패했습니다.";
      vscode.window.showErrorMessage(messageText);
    }
  }

  private _getGitHubSession(silent: boolean) {
    return vscode.authentication.getSession(
      "github",
      ClogSidebarProvider._githubScopes,
      silent ? { silent: true } : { createIfNone: true },
    );
  }

  private _logAuthDebug(
    session: vscode.AuthenticationSession,
    clogAccessToken: string,
  ) {
    if (!CLOG_API_DEBUG) {
      return;
    }
    this._debugOutput.show(true);
    this._debugLog(`[Clog Auth] GitHub account: ${session.account.label}`);
    this._debugLog(`[Clog Auth] GitHub scopes: ${session.scopes.join(", ")}`);
    this._debugLog(`[Clog Auth] apiBaseUrl: ${getApiBaseUrl()}`);
    // this._debugLog(`[Clog Auth] GitHub accessToken: ${session.accessToken}`);
    // this._debugLog(`[Clog Auth] CLOG JWT accessToken: ${clogAccessToken}`);
    this._debugLog(
      `[Clog Auth] CLOG userId (JWT sub): ${getUserIdFromToken(clogAccessToken) ?? "unknown"}`,
    );
    this._debugLog(
      `[Clog Auth] projectId: ${this._tokenStorage.getProjectId() ?? "(not set)"}`,
    );
    this._debugLog(
      `[Clog Auth] chatSessionId: ${this._tokenStorage.getChatSessionId() ?? "(not set)"}`,
    );
  }

  private async _invalidateAuthState(message: string) {
    await this._tokenStorage.clearAccessToken();
    this._postMessage({ type: "authError", message });
    this._postAuthState(false);
  }

  private _postStreamMessage(
    draftId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    this._postMessage({
      ...payload,
      ...(draftId ? { draftId } : {}),
    });
  }

  private async _handlePromptRequest(message: {
    prompt?: string;
    attachments?: unknown[];
    draftId?: string;
  }) {
    const draftId =
      typeof message.draftId === "string" ? message.draftId : undefined;

    const accessToken = await this._tokenStorage.getAccessToken();
    if (!accessToken) {
      this._postStreamMessage(draftId, {
        type: "llmStreamError",
        message: "로그인이 필요합니다. GitHub로 다시 로그인해주세요.",
      });
      return;
    }

    if (isJwtExpired(accessToken)) {
      await this._invalidateAuthState(
        "CLOG JWT가 만료되었습니다. 다시 로그인해주세요.",
      );
      this._postStreamMessage(draftId, {
        type: "llmStreamError",
        message: "인증이 만료되었습니다. 다시 로그인 후 시도해주세요.",
      });
      return;
    }

    const prompt =
      typeof message.prompt === "string" ? message.prompt.trim() : "";
    if (!prompt) {
      this._postStreamMessage(draftId, {
        type: "llmStreamError",
        message: "보낼 프롬프트가 비어 있습니다.",
      });
      return;
    }

    this._activeRequestController?.abort();
    const controller = new AbortController();
    this._activeRequestController = controller;

    this._postStreamMessage(draftId, { type: "llmStreamStarted" });

    const streamState: SseStreamState = {
      thinking: "",
      assistant: "",
      previewMarkdown: "",
      chatSessionId: this._tokenStorage.getChatSessionId(),
    };

    let streamError: string | undefined;
    let omitChatSessionId = false;
    let retriedStaleSession = false;

    const codeSnippets = mapAttachmentsToCodeSnippets(
      Array.isArray(message.attachments) ? message.attachments : [],
    );

    try {
    streamLoop: while (true) {
      streamError = undefined;
      streamState.thinking = "";
      streamState.assistant = "";
      streamState.previewMarkdown = "";

      const sseBody = buildChatSendBody({
        message: prompt,
        projectId: this._tokenStorage.getProjectId(),
        chatSessionId: omitChatSessionId
          ? undefined
          : this._tokenStorage.getChatSessionId(),
        codeSnippets,
      });

      this._debugLog(`[Clog SSE] POST ${getApiBaseUrl()}/api/blogs/generate`);
      this._debugLog(`[Clog SSE] body: ${JSON.stringify(sseBody)}`);

      try {
        const response = await streamBlogGenerate(
          this._apiClient,
          sseBody,
          controller.signal,
        );

        if (!response.ok) {
          const errorText = await response.text();
          const apiError = new ApiError(
            formatHttpErrorMessage(response.status, errorText),
            response.status,
          );
          if (response.status === 401 || response.status === 403) {
            await this._invalidateAuthState(apiError.message);
          }
          throw apiError;
        }

        if (!response.body) {
          throw new Error("SSE 응답 body가 비어 있습니다.");
        }

        const { serverError } = await consumeSseResponse(
          response.body,
          streamState,
          {
            onEvent: (eventName, data) => {
              const dataText =
                typeof data === "string" ? data : JSON.stringify(data);
              this._debugLog(`[Clog SSE] event: ${eventName} data: ${dataText}`);
            },
            onThinkingDelta: (delta, aggregate) => {
              this._postStreamMessage(draftId, {
                type: "llmThinkingChunk",
                delta,
                aggregate,
              });
            },
            onAssistantDelta: (delta, aggregate) => {
              this._postStreamMessage(draftId, {
                type: "llmAssistantChunk",
                delta,
                aggregate,
              });
            },
            onPreviewDelta: (delta, aggregate) => {
              this._latestPreviewMarkdown = aggregate;
              this._postStreamMessage(draftId, {
                type: "llmPreviewChunk",
                delta,
                aggregate,
              });
              updatePreviewPanelContent(
                this._extensionUri,
                aggregate,
                this._bindPreviewPublish(aggregate),
              );
            },
            onSessionId: (sessionId) => {
              void this._tokenStorage.setChatSessionId(sessionId);
            },
          },
          controller.signal,
        );
        streamError = serverError;

        if (
          streamError &&
          isChatSessionNotFoundMessage(streamError) &&
          !retriedStaleSession
        ) {
          retriedStaleSession = true;
          omitChatSessionId = true;
          await this._tokenStorage.clearChatSessionId();
          this._debugLog(
            "[Clog SSE] stale chatSessionId — cleared, retrying without session id",
          );
          continue streamLoop;
        }

        if (streamError) {
          throw new Error(streamError);
        }

        break streamLoop;
      } catch (error) {
        if (controller.signal.aborted) {
          this._postStreamMessage(draftId, {
            type: "llmStreamError",
            message: "",
            isCanceled: true,
          });
          return;
        }

        if (
          streamError &&
          isChatSessionNotFoundMessage(streamError) &&
          !retriedStaleSession
        ) {
          retriedStaleSession = true;
          omitChatSessionId = true;
          await this._tokenStorage.clearChatSessionId();
          this._debugLog(
            "[Clog SSE] stale chatSessionId — cleared, retrying without session id",
          );
          continue streamLoop;
        }

        let messageText =
          streamError ??
          (error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "알 수 없는 스트림 오류");

        if (!streamError && /terminated/i.test(messageText)) {
          messageText =
            "서버 연결이 끊겼습니다. JWT 만료·인증 실패 또는 서버 SSE 오류일 수 있습니다. 다시 로그인 후 시도해주세요.";
        }

        this._debugLog(`[SSE] stream error: ${messageText}`);
        if (error instanceof ApiError && error.responseBody) {
          this._debugLog(`[SSE] error body: ${error.responseBody}`);
        }
        this._postStreamMessage(draftId, {
          type: "llmStreamError",
          message: messageText,
        });
        return;
      }
    }

    if (streamState.previewMarkdown.trim()) {
      this._latestPreviewMarkdown = streamState.previewMarkdown;
    }

    this._debugLog(
      `[SSE] stream done assistantLen=${streamState.assistant.length} previewLen=${streamState.previewMarkdown.length} sessionId=${streamState.chatSessionId ?? "(none)"}`,
    );
    if (streamState.previewMarkdown.trim()) {
      updatePreviewPanelContent(
        this._extensionUri,
        streamState.previewMarkdown,
        this._bindPreviewPublish(streamState.previewMarkdown),
      );
    }

    this._postStreamMessage(draftId, {
      type: "llmStreamDone",
      thinking: streamState.thinking,
      response: streamState.assistant,
      previewMarkdown: streamState.previewMarkdown,
      previewReady: Boolean(streamState.previewMarkdown.trim()),
    });
    } finally {
      if (this._activeRequestController === controller) {
        this._activeRequestController = undefined;
      }
    }
  }

  /** Command Palette: API 연동 프로브 (Output → Clog API Debug) */
  public async runApiProbe(): Promise<void> {
    this._debugOutput.show(true);
    const probeClient = new ClogApiClient(
      this._tokenStorage,
      (line) => this._probeLog(line),
      true,
    );
    const session = await this._getGitHubSession(true);
    if (!session) {
      this._probeLog("[Probe] GitHub 세션 없음 — 먼저 GitHub 로그인");
      return;
    }

    let jwt = await this._tokenStorage.getAccessToken();
    if (!jwt) {
      this._probeLog("[Probe] JWT 없음 — 교환 시도");
      await this._handleGitHubLogin();
      jwt = await this._tokenStorage.getAccessToken();
    }

    if (!jwt) {
      this._probeLog("[Probe] JWT 교환 실패 — 중단");
      return;
    }

    await runApiIntegrationProbe(
      probeClient,
      session.accessToken,
      this._tokenStorage.getProjectId(),
    );
  }

  /**
   * 선택된 코드를 웹뷰로 전송
   */
  public sendSelectedCode() {
    if (!this.view) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (selectedText) {
      const fileName = path.basename(editor.document.fileName);
      const languageId = editor.document.languageId;

      this.view.webview.postMessage({
        type: "codePending",
        code: selectedText,
        fileName: fileName,
        language: languageId,
        lineStart: selection.start.line + 1,
        lineEnd: selection.end.line + 1,
      });
    }
  }

  public handleDocumentSave(document: vscode.TextDocument) {
    void this._syncSavedDocument(document);
  }

  private _postMessage(message: Record<string, unknown>) {
    this.view?.webview.postMessage(message);
  }

  /**
   * HTML 로드 및 경로 변환
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "dist",
      "index.html",
    );

    let htmlContent: string;
    try {
      htmlContent = fs.readFileSync(htmlPath.fsPath, "utf8");
    } catch (error) {
      return `<!DOCTYPE html>
      <html>
        <body>
          <h3>빌드 파일을 찾을 수 없습니다</h3>
          <p>터미널에서 <code>pnpm run webview:build</code>를 실행해주세요.</p>
        </body>
      </html>`;
    }

    const distUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist"),
    );

    // Asset 경로 변환
    htmlContent = htmlContent.replace(/href="\.\//g, `href="${distUri}/`);
    htmlContent = htmlContent.replace(/src="\.\//g, `src="${distUri}/`);
    htmlContent = htmlContent.replace(/href="\//g, `href="${distUri}/`);
    htmlContent = htmlContent.replace(/src="\//g, `src="${distUri}/`);

    return htmlContent;
  }
}
