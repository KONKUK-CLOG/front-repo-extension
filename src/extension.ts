import * as vscode from "vscode";
import { ClogSidebarProvider } from "./providers/ClogSidebarProvider";

/**
 * Extension 활성화
 */
export function activate(context: vscode.ExtensionContext) {
  // 사이드바 프로바이더 등록
  registerSidebarProvider(context);

  // 커맨드 등록
  registerCommands(context);

  // 텍스트 선택 감지 등록
  registerTextSelectionListener(context);
}

/**
 * 사이드바 프로바이더 등록
 */
function registerSidebarProvider(context: vscode.ExtensionContext) {
  const provider = new ClogSidebarProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("clog.sidebarView", provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  // 다른 함수에서 사용할 수 있도록 저장
  (context as any).clogProvider = provider;
}

/**
 * 커맨드 등록
 */
function registerCommands(context: vscode.ExtensionContext) {
  // 사이드바 열기
  context.subscriptions.push(
    vscode.commands.registerCommand("clog.openViteUI", () => {
      vscode.commands.executeCommand("clog.sidebarView.focus");
    })
  );

  // 선택된 코드를 웹뷰로 보내기
  context.subscriptions.push(
    vscode.commands.registerCommand("clog.sendCodeToWebview", () => {
      const provider = (context as any).clogProvider as ClogSidebarProvider;
      provider.sendSelectedCode();
    })
  );
}

/**
 * 텍스트 선택 변경 감지 (자동 코드 전송)
 */
function registerTextSelectionListener(context: vscode.ExtensionContext) {
  let selectionTimeout: NodeJS.Timeout | undefined;

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      const editor = e.textEditor;
      const selection = editor.selection;

      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }

      const provider = (context as any).clogProvider as ClogSidebarProvider;
      if (!selection.isEmpty && provider.view) {
        selectionTimeout = setTimeout(() => {
          provider.sendSelectedCode();
        }, 800);
      }
    })
  );
}

/**
 * Extension 비활성화
 */
export function deactivate() {}
