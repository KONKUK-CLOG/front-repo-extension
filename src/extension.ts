// src/extension.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("clog.openViteUI", () => {
    // 1. Webview 패널 생성
    const panel = vscode.window.createWebviewPanel(
      "viteFrontendUI",
      "GitHub Blog Creator UI", // 패널 제목
      vscode.ViewColumn.Beside, // 에디터 옆에 새 패널을 띄웁니다.
      {
        enableScripts: true,

        localResourceRoots: [
          vscode.Uri.file(
            path.join(context.extensionPath, "webview-ui", "dist")
          ),
        ],
      }
    );

    // 2. 빌드된 HTML 파일 경로 설정 및 내용 읽기
    const htmlPath = path.join(
      context.extensionPath,
      "webview-ui",
      "dist",
      "index.html"
    );
    if (!fs.existsSync(htmlPath)) {
      vscode.window.showErrorMessage(
        'Vite UI 빌드 파일을 찾을 수 없습니다. "pnpm run webview:build"를 먼저 실행해주세요.'
      );
      return;
    }
    let htmlContent = fs.readFileSync(htmlPath, "utf8");

    // 3. Webview URI 변환 (가장 중요)
    // Vite 빌드 자산의 상대 경로('./assets...')를 Webview가 이해하는 절대 URI로 변환
    const distPath = path.join(context.extensionPath, "webview-ui", "dist");
    const distUri = panel.webview
      .asWebviewUri(vscode.Uri.file(distPath))
      .toString();

    // HTML 내용 내의 모든 상대 경로('./')를 Webview URI로 변경합니다.
    htmlContent = htmlContent.replace(/href="\.\//g, `href="${distUri}/`);
    htmlContent = htmlContent.replace(/src="\.\//g, `src="${distUri}/`);

    // Vite 빌드가 절대 경로('/assets/...')를 생성하는 경우도 있으므로
    // 절대 경로로 시작하는 asset 경로도 Webview URI로 변환합니다.
    // 예: href="/assets/..."  -> href="${distUri}/assets/..."
    htmlContent = htmlContent.replace(/href="\//g, `href="${distUri}/`);
    htmlContent = htmlContent.replace(/src="\//g, `src="${distUri}/`);

    panel.webview.html = htmlContent;

    // ⭐️ 이후 단계: 코어와 Webview 간의 메시징 통신은 여기에 추가됩니다.
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
