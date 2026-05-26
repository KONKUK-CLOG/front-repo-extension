import * as vscode from "vscode";
import { getPreviewHtml } from "./previewHtml";
import { markdownToHtml } from "./markdownToHtml";

let activePreviewPanel: vscode.WebviewPanel | undefined;
let activeOnPublish: ((htmlContent: string) => void | Promise<void>) | undefined;

export function setPreviewPublishHandler(
  handler: (htmlContent: string) => void | Promise<void>,
): void {
  activeOnPublish = handler;
}

/**
 * 미리보기 패널 열기
 * LLM이 생성한 블로그 포스트를 미리보기하고 발행할 수 있는 패널
 */
export function openPreviewPanel(
  extensionUri: vscode.Uri,
  markdown?: string,
  onPublish?: (htmlContent: string) => void | Promise<void>,
) {
  if (onPublish) {
    activeOnPublish = onPublish;
  }

  if (activePreviewPanel) {
    activePreviewPanel.reveal(vscode.ViewColumn.Beside);

    if (typeof markdown === "string") {
      activePreviewPanel.webview.postMessage({
        type: "previewMarkdown",
        html: markdownToHtml(markdown),
      });
    }

    return activePreviewPanel;
  }

  const panel = vscode.window.createWebviewPanel(
    "clogPreview",
    "Blog Preview",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  activePreviewPanel = panel;
  panel.webview.html = getPreviewHtml(markdown);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type !== "createBlog") {
      return;
    }

    if (!activeOnPublish) {
      void vscode.window.showErrorMessage(
        "블로그 발행 핸들러가 연결되지 않았습니다. Extension을 다시 로드해주세요.",
      );
      return;
    }

    const htmlContent =
      typeof message.content === "string" ? message.content : "";
    await activeOnPublish(htmlContent);
    panel.dispose();
  });

  panel.onDidDispose(() => {
    if (activePreviewPanel === panel) {
      activePreviewPanel = undefined;
    }
  });

  return panel;
}

export function updatePreviewPanelContent(
  extensionUri: vscode.Uri,
  markdown: string,
  onPublish?: (htmlContent: string) => void | Promise<void>,
) {
  const panel = openPreviewPanel(extensionUri, markdown, onPublish);
  panel.webview.postMessage({
    type: "previewMarkdown",
    html: markdownToHtml(markdown),
  });
}
