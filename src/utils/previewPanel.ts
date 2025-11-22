import * as vscode from "vscode";
import { getPreviewHtml } from "./previewHtml";

/**
 * 미리보기 패널 열기
 * LLM이 생성한 블로그 포스트를 미리보기하고 발행할 수 있는 패널
 */
export function openPreviewPanel(extensionUri: vscode.Uri) {
  const panel = vscode.window.createWebviewPanel(
    "clogPreview",
    "Blog Preview",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  panel.webview.html = getPreviewHtml();

  // 미리보기에서 메시지 받기
  panel.webview.onDidReceiveMessage((message) => {
    if (message.type === "createBlog") {
      vscode.window.showInformationMessage(
        "블로그 포스트가 GitHub에 발행되었습니다! (추후 구현)"
      );
      panel.dispose();
    }
  });
}
