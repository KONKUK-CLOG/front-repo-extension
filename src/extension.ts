import * as vscode from "vscode";
import { ClogSidebarProvider } from "./providers/ClogSidebarProvider";

/**
 * Extension 활성화
 */
export function activate(context: vscode.ExtensionContext) {
  // 사이드바 프로바이더 등록
  const provider = registerSidebarProvider(context);

  // 커맨드 등록
  registerCommands(context, provider);

  // 텍스트 선택 감지 등록
  registerTextSelectionListener(context, provider);

  // 저장 시 diff 생성 등록
  registerSaveListener(context, provider);
}

/**
 * 사이드바 프로바이더 등록
 */
function registerSidebarProvider(
  context: vscode.ExtensionContext,
): ClogSidebarProvider {
  const provider = new ClogSidebarProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("clog.sidebarView", provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
  );

  return provider;
}

/**
 * 커맨드 등록
 */
function registerCommands(
  context: vscode.ExtensionContext,
  provider: ClogSidebarProvider,
) {
  // 사이드바 열기
  context.subscriptions.push(
    vscode.commands.registerCommand("clog.openViteUI", () => {
      vscode.commands.executeCommand("clog.sidebarView.focus");
    }),
  );

  // 선택된 코드를 웹뷰로 보내기
  context.subscriptions.push(
    vscode.commands.registerCommand("clog.sendCodeToWebview", () => {
      provider.sendSelectedCode();
    }),
  );
}

/**
 * 텍스트 선택 변경 감지 (자동 코드 전송)
 */
function registerTextSelectionListener(
  context: vscode.ExtensionContext,
  provider: ClogSidebarProvider,
) {
  let selectionTimeout: NodeJS.Timeout | undefined;

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      const editor = e.textEditor;
      const selection = editor.selection;

      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }

      if (!selection.isEmpty && provider.view) {
        selectionTimeout = setTimeout(() => {
          provider.sendSelectedCode();
        }, 800);
      }
    }),
  );
}

/**
 * 저장 이벤트 감지
 */
function registerSaveListener(
  context: vscode.ExtensionContext,
  provider: ClogSidebarProvider,
) {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      provider.handleDocumentSave(document);
    }),
  );
}

/**
 * Extension 비활성화
 */
export function deactivate() {}
