import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { openPreviewPanel } from "../utils/previewPanel";

/**
 * 사이드바 Webview Provider 클래스
 * 코파일럿처럼 사이드바에 표시되는 채팅 UI를 관리
 */
export class ClogSidebarProvider implements vscode.WebviewViewProvider {
  public view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  /**
   * Webview 뷰가 생성될 때 호출
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 웹뷰로부터 메시지 받기
    this._setWebviewMessageListener(webviewView);
  }

  /**
   * 웹뷰 메시지 리스너 등록
   */
  private _setWebviewMessageListener(webviewView: vscode.WebviewView) {
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
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

  /**
   * HTML 로드 및 경로 변환
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "dist",
      "index.html"
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
      vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist")
    );

    // Asset 경로 변환
    htmlContent = htmlContent.replace(/href="\.\//g, `href="${distUri}/`);
    htmlContent = htmlContent.replace(/src="\.\//g, `src="${distUri}/`);
    htmlContent = htmlContent.replace(/href="\//g, `href="${distUri}/`);
    htmlContent = htmlContent.replace(/src="\//g, `src="${distUri}/`);

    return htmlContent;
  }
}
