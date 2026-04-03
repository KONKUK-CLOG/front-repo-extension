import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { createPatch } from "diff";
import { openPreviewPanel } from "../utils/previewPanel";

interface CodeSnapshot {
  fileName: string;
  filePath: string;
  languageId: string;
  content: string;
  savedAt: string;
}

/**
 * 사이드바 Webview Provider 클래스
 * 코파일럿처럼 사이드바에 표시되는 채팅 UI를 관리
 */
export class ClogSidebarProvider implements vscode.WebviewViewProvider {
  public view?: vscode.WebviewView;
  private readonly _snapshotFileUri: vscode.Uri;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this._snapshotFileUri = vscode.Uri.joinPath(
      this._context.storageUri ?? this._context.globalStorageUri,
      "clog-snapshot.json",
    );
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

    const snapshot = this._loadSnapshot();
    if (snapshot) {
      this._postMessage({
        type: "snapshotReady",
        fileName: snapshot.fileName,
        filePath: snapshot.filePath,
        language: snapshot.languageId,
        savedAt: snapshot.savedAt,
      });
    }
  }

  /**
   * 웹뷰 메시지 리스너 등록
   */
  private _setWebviewMessageListener(webviewView: vscode.WebviewView) {
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "loginSuccess":
          this._storeActiveDocumentSnapshot();
          break;
        case "requestSnapshotState": {
          const snapshot = this._loadSnapshot();

          if (snapshot) {
            this._postMessage({
              type: "snapshotReady",
              fileName: snapshot.fileName,
              filePath: snapshot.filePath,
              language: snapshot.languageId,
              savedAt: snapshot.savedAt,
            });
          } else {
            this._postMessage({
              type: "snapshotMissing",
              message: "로그인 후 기준 코드가 아직 저장되지 않았습니다.",
            });
          }
          break;
        }
        case "requestCode":
          this.sendSelectedCode();
          break;
        case "openPreview":
          openPreviewPanel(this._extensionUri);
          break;
      }
    });
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
    const snapshot = this._loadSnapshot();

    if (!snapshot || snapshot.filePath !== document.fileName) {
      return;
    }

    const currentContent = document.getText();

    if (snapshot.content === currentContent) {
      this._postMessage({
        type: "documentUnchanged",
        fileName: snapshot.fileName,
        filePath: snapshot.filePath,
      });
      return;
    }

    const patch = createPatch(
      snapshot.fileName,
      snapshot.content,
      currentContent,
      "stored snapshot",
      "current save",
    );

    this._postMessage({
      type: "documentDiff",
      fileName: snapshot.fileName,
      filePath: snapshot.filePath,
      patch,
      savedAt: new Date().toISOString(),
    });
  }

  private _storeActiveDocumentSnapshot() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      this._postMessage({
        type: "snapshotError",
        message:
          "저장할 활성 편집기가 없습니다. 코드 파일을 연 뒤 다시 로그인해주세요.",
      });
      return;
    }

    const document = editor.document;
    const snapshot: CodeSnapshot = {
      fileName: path.basename(document.fileName),
      filePath: document.fileName,
      languageId: document.languageId,
      content: document.getText(),
      savedAt: new Date().toISOString(),
    };

    this._saveSnapshot(snapshot);

    this._postMessage({
      type: "snapshotReady",
      fileName: snapshot.fileName,
      filePath: snapshot.filePath,
      language: snapshot.languageId,
      savedAt: snapshot.savedAt,
    });
  }

  private _saveSnapshot(snapshot: CodeSnapshot) {
    fs.mkdirSync(path.dirname(this._snapshotFileUri.fsPath), {
      recursive: true,
    });
    fs.writeFileSync(
      this._snapshotFileUri.fsPath,
      JSON.stringify(snapshot, null, 2),
      "utf8",
    );
  }

  private _loadSnapshot(): CodeSnapshot | null {
    if (!fs.existsSync(this._snapshotFileUri.fsPath)) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(this._snapshotFileUri.fsPath, "utf8");
      return JSON.parse(fileContent) as CodeSnapshot;
    } catch {
      return null;
    }
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
