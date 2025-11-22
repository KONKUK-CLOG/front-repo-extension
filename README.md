# Clog - VS Code Extension

코드를 블로그 포스트로 자동 변환하는 VS Code 확장 프로그램입니다.

## 🎯 Features

- **사이드바 채팅 UI**: GitHub Copilot처럼 사이드바에서 블로그 작성
- **자동 코드 감지**: 코드 선택 시 자동으로 감지하여 전송
- **LLM 생각 과정 시각화**: AI가 블로그를 생성하는 과정을 단계별로 표시
- **실시간 미리보기**: 생성된 블로그 포스트를 즉시 미리보기


## 📁 프로젝트 구조

```
src/
├── extension.ts                    # 메인 진입점
├── providers/
│   └── ClogSidebarProvider.ts     # 사이드바 웹뷰 프로바이더
└── utils/
    ├── previewHtml.ts             # 미리보기 HTML 템플릿
    └── previewPanel.ts            # 미리보기 패널 관리

webview-ui/                         # React 기반 사이드바 UI
├── src/
│   ├── pages/
│   │   ├── Editor/
│   │   │   └── EditorScreen.tsx   # 채팅 UI
│   │   └── Login/
│   │       └── LoginScreen.tsx    # 로그인 UI
│   └── App.tsx
└── dist/                          # 빌드된 정적 파일
```

## 🔧 Architecture

### Extension (src/extension.ts)

메인 진입점으로 3가지 주요 기능을 등록합니다:

#### 1. 사이드바 프로바이더 등록

```typescript
function registerSidebarProvider(context: vscode.ExtensionContext) {
  const provider = new ClogSidebarProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("clog.sidebarView", provider, {
      webviewOptions: {
        retainContextWhenHidden: true, // 사이드바 닫아도 상태 유지
      },
    })
  );
}
```

#### 2. 커맨드 등록

```typescript
function registerCommands(context: vscode.ExtensionContext) {
  // 사이드바 포커스
  vscode.commands.registerCommand("clog.openViteUI", () => {
    vscode.commands.executeCommand("clog.sidebarView.focus");
  });

  // 선택된 코드 전송
  vscode.commands.registerCommand("clog.sendCodeToWebview", () => {
    provider.sendSelectedCode();
  });
}
```

#### 3. 텍스트 선택 감지 (자동 코드 전송)

```typescript
function registerTextSelectionListener(context: vscode.ExtensionContext) {
  let selectionTimeout: NodeJS.Timeout | undefined;

  vscode.window.onDidChangeTextEditorSelection((e) => {
    const selection = e.textEditor.selection;

    // 디바운싱: 800ms 후에 코드 전송
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }

    if (!selection.isEmpty && provider.view) {
      selectionTimeout = setTimeout(() => {
        provider.sendSelectedCode();
      }, 800);
    }
  });
}
```

### Sidebar Provider (src/providers/ClogSidebarProvider.ts)

사이드바의 웹뷰를 관리하는 프로바이더 클래스입니다.

#### resolveWebviewView

```typescript
resolveWebviewView(
  webviewView: vscode.WebviewView,
  context: vscode.WebviewViewResolveContext,
  _token: vscode.CancellationToken
) {
  // 웹뷰 옵션 설정
  webviewView.webview.options = {
    enableScripts: true,
    localResourceRoots: [this._extensionUri],
  };

  // 빌드된 React 앱 로드
  webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

  // 메시지 리스너 등록
  this._setWebviewMessageListener(webviewView);
}
```

#### 메시지 통신

```typescript
// Extension → Webview
view.webview.postMessage({
  type: "codePending",
  code: selectedText,
  fileName: fileName,
  language: languageId,
  lineStart: selection.start.line + 1,
  lineEnd: selection.end.line + 1,
});

// Webview → Extension
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
```

### Preview Panel (src/utils/previewPanel.ts)

생성된 블로그 포스트를 미리보기하는 패널입니다.

```typescript
export function openPreviewPanel(extensionUri: vscode.Uri) {
  const panel = vscode.window.createWebviewPanel(
    "clogPreview",
    "Blog Preview",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getPreviewHtml();

  // "블로그 만들기" 버튼 클릭 처리
  panel.webview.onDidReceiveMessage((message) => {
    if (message.type === "createBlog") {
      vscode.window.showInformationMessage(
        "블로그 포스트가 GitHub에 발행되었습니다!"
      );
      panel.dispose();
    }
  });
}
```

## 🚀 개발 환경 설정

### 필수 요구사항

- Node.js 18+
- pnpm
- VS Code

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# Webview UI 빌드
pnpm run webview:build

# Extension 컴파일
pnpm run compile

# 개발 모드 (자동 리빌드)
pnpm run watch
```

### 디버깅

1. VS Code에서 프로젝트 열기
2. `F5` 키를 눌러 Extension Development Host 실행
3. 새 창에서 `Ctrl+Shift+P` → "Clog: Open Sidebar" 실행

## 📝 워크플로우

1. **코드 선택**: 에디터에서 코드를 드래그하여 선택
2. **자동 감지**: 800ms 후 자동으로 사이드바에 코드 칩 표시
3. **메시지 전송**: 사용자가 추가 입력 후 전송
4. **LLM 처리**: AI가 블로그 생성 과정을 5단계로 시각화
   - 사용자 요청 분석 중...
   - 코드 컨텍스트 이해하기...
   - 블로그 구조 설계 중...
   - 마크다운 형식으로 변환 중...
   - 최종 검토 중...
5. **미리보기 자동 열림**: 완성 후 미리보기 패널 자동 표시
6. **발행**: "블로그 만들기" 버튼 클릭으로 GitHub에 발행

## 🔌 VS Code API 사용

### WebviewViewProvider

```typescript
vscode.window.registerWebviewViewProvider(
  "clog.sidebarView", // package.json의 views.id와 일치
  provider,
  { webviewOptions: { retainContextWhenHidden: true } }
);
```

### WebviewPanel

```typescript
vscode.window.createWebviewPanel(
  "clogPreview", // 패널 ID
  "Blog Preview", // 패널 제목
  vscode.ViewColumn.One, // 표시 위치
  { enableScripts: true } // 스크립트 활성화
);
```

### 메시지 통신

```typescript
// Extension → Webview
webview.postMessage({ type: "codePending", ... });

// Webview → Extension
webview.onDidReceiveMessage((msg) => { ... });
```

## 📦 package.json 설정

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "clog-sidebar",
          "title": "Clog",
          "icon": "$(comment-discussion)"
        }
      ]
    },
    "views": {
      "clog-sidebar": [
        {
          "type": "webview",
          "id": "clog.sidebarView",
          "name": "Chat"
        }
      ]
    },
    "commands": [
      {
        "command": "clog.openViteUI",
        "title": "Clog: Open Sidebar"
      }
    ]
  }
}
```

## 🛠️ 기술 스택

- **Extension**: TypeScript, VS Code Extension API
- **UI**: React 19, Emotion (styled-components), TypeScript
- **Build**: Vite, esbuild
- **Package Manager**: pnpm

## 📄 License

MIT

---

**Enjoy coding with Clog! 🎉**

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
