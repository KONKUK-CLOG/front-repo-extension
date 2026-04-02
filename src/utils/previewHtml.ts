import { defaultBlogPost } from "./defaultBlogPost";
import { markdownToHtml } from "./markdownToHtml";

/**
 * 블로그 포스트 미리보기 HTML 생성
 */
export function getPreviewHtml(
  markdown: string = defaultBlogPost.markdown,
): string {
  const initialHtml = [
    `<h1>${defaultBlogPost.title}</h1>`,
    `<div class="meta">작성일: ${new Date().toLocaleDateString("ko-KR")} | 작성자: ${defaultBlogPost.author}</div>`,
    markdownToHtml(markdown),
  ].join("\n");

  return `<!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog Preview</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: #ffffff;
        color: #24292e;
        line-height: 1.6;
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .toolbar {
        position: sticky;
        top: 0;
        background-color: #f6f8fa;
        border-bottom: 1px solid #e1e4e8;
        padding: 0.75rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        z-index: 100;
      }

      .toolbar-left {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .toolbar-right {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        border: 1px solid #d0d7de;
        background: #fff;
        color: #57606a;
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #2da44e;
        box-shadow: 0 0 0 3px rgba(45, 164, 78, 0.12);
      }

      .btn {
        padding: 0.5rem 1.25rem;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
        color: #24292e;
      }
      .btn:hover {
        background-color: #f3f4f6;
      }
      .btn-primary {
        background-color: #2da44e;
        color: white;
        border-color: #2da44e;
      }
      .btn-primary:hover {
        background-color: #2c974b;
      }

      .format-btn {
        border: 1px solid #d0d7de;
        background: white;
        color: #24292e;
        border-radius: 6px;
        padding: 0.35rem 0.6rem;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .format-btn:hover {
        background-color: #f3f4f6;
      }

      .format-btn.is-active {
        background-color: #ddf4ff;
        border-color: #54aeff;
        color: #0550ae;
      }

      .format-hint {
        display: block;
        margin-top: 0.2rem;
        color: #6e7781;
        font-size: 0.72rem;
        line-height: 1.1;
        text-align: center;
        letter-spacing: -0.01em;
      }

      .content {
        flex: 1;
        overflow-y: auto;
        max-width: 900px;
        margin: 0 auto;
        padding: 3rem 2rem 5rem 2rem;
        width: 100%;
        outline: none;
      }
      .content:focus {
        outline: none;
      }

      .ProseMirror {
        outline: none;
      }

      .ProseMirror h1 {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        padding-bottom: 0.5rem;
      }

      .ProseMirror h1.is-editor-empty:first-child::before {
        content: '제목을 입력하세요';
        color: #d0d7de;
        float: left;
        pointer-events: none;
        height: 0;
      }

      .meta {
        color: #586069;
        font-size: 0.9rem;
        margin-bottom: 2rem;
        user-select: none;
      }

      .editor-tip {
        max-width: 900px;
        margin: 0 auto;
        padding: 0.85rem 2rem 0;
        color: #57606a;
        font-size: 0.85rem;
      }

      .editor-tip strong {
        color: #24292e;
      }

      .ProseMirror h2 {
        font-size: 1.8rem;
        font-weight: 600;
        margin-top: 2rem;
        margin-bottom: 1rem;
      }

      .ProseMirror h3 {
        font-size: 1.4rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
      }

      .ProseMirror p {
        margin-bottom: 1rem;
        font-size: 1rem;
      }

      .ProseMirror pre {
        background-color: #f6f8fa;
        padding: 1rem;
        border-radius: 6px;
        overflow-x: auto;
        margin: 1rem 0;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
        white-space: pre-wrap;
      }

      .ProseMirror code {
        background-color: #f6f8fa;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
      }

      .ProseMirror ul,
      .ProseMirror ol {
        margin-left: 2rem;
        margin-bottom: 1rem;
      }

      .ProseMirror li {
        margin-bottom: 0.5rem;
      }

      .ProseMirror blockquote {
        border-left: 4px solid #d0d7de;
        padding-left: 1rem;
        margin: 1rem 0;
        color: #586069;
        font-style: italic;
      }

      .ProseMirror hr {
        border: none;
        border-top: 1px solid #e1e4e8;
        margin: 2rem 0;
      }
      ::selection {
        background-color: rgba(45, 164, 78, 0.2);
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <div class="toolbar-left" id="formatToolbar">
        <button class="format-btn" data-cmd="h1" data-active="heading">H1<span class="format-hint" data-shortcut="h1"></span></button>
        <button class="format-btn" data-cmd="bold" data-active="bold"><strong>B</strong><span class="format-hint" data-shortcut="bold"></span></button>
        <button class="format-btn" data-cmd="italic" data-active="italic"><em>I</em><span class="format-hint" data-shortcut="italic"></span></button>
        <button class="format-btn" data-cmd="strike" data-active="strike"><s>S</s><span class="format-hint" data-shortcut="strike"></span></button>
        <button class="format-btn" data-cmd="h2" data-active="heading">H2<span class="format-hint" data-shortcut="h2"></span></button>
        <button class="format-btn" data-cmd="h3" data-active="heading">H3<span class="format-hint" data-shortcut="h3"></span></button>
        <button class="format-btn" data-cmd="bulletList" data-active="bulletList">List<span class="format-hint" data-shortcut="bulletList"></span></button>
        <button class="format-btn" data-cmd="orderedList" data-active="orderedList">1.<span class="format-hint" data-shortcut="orderedList"></span></button>
        <button class="format-btn" data-cmd="code" data-active="code">InlineCode<span class="format-hint" data-shortcut="code"></span></button>
        <button class="format-btn" data-cmd="blockquote" data-active="blockquote">Quote<span class="format-hint" data-shortcut="blockquote"></span></button>
        <button class="format-btn" data-cmd="codeBlock" data-active="codeBlock">Code<span class="format-hint" data-shortcut="codeBlock"></span></button>
        <button class="format-btn" data-cmd="clear">Clear<span class="format-hint" data-shortcut="clear"></span></button>
        <button class="format-btn" data-cmd="undo">Undo<span class="format-hint" data-shortcut="undo"></span></button>
        <button class="format-btn" data-cmd="redo">Redo<span class="format-hint" data-shortcut="redo"></span></button>
      </div>
      <div class="toolbar-right">
        <div class="status-pill" id="saveStatus"><span class="status-dot"></span><span id="saveStatusText">자동 저장 준비됨</span></div>
        <button class="btn btn-primary" id="createBlogButton">블로그 만들기</button>
      </div>
    </div>

    <div class="editor-tip">
      <strong>팁:</strong> 본문을 선택한 뒤 툴바를 누르거나, <strong id="shortcutTip"></strong> 같은 단축키를 바로 사용할 수 있어요.
    </div>

    <div class="content" id="blogContent"></div>

    <script type="module">
      const vscode = acquireVsCodeApi();
      const content = document.getElementById('blogContent');
      const toolbar = document.getElementById('formatToolbar');
      const createBlogButton = document.getElementById('createBlogButton');
      const saveStatusText = document.getElementById('saveStatusText');
      const shortcutTip = document.getElementById('shortcutTip');

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
      const shortcutMap = isMac
        ? {
            h1: '⌘⌥1',
            h2: '⌘⌥2',
            h3: '⌘⌥3',
            bold: '⌘B',
            italic: '⌘I',
            strike: '⌘⇧X',
            bulletList: '⌘⇧7',
            orderedList: '⌘⇧8',
            code: '⌘E',
            blockquote: '⌘⇧9',
            codeBlock: '⌘⌥C',
            clear: '⌘⇧0',
            undo: '⌘Z',
            redo: '⌘⇧Z',
          }
        : {
            h1: 'Ctrl+Alt+1',
            h2: 'Ctrl+Alt+2',
            h3: 'Ctrl+Alt+3',
            bold: 'Ctrl+B',
            italic: 'Ctrl+I',
            strike: 'Ctrl+Shift+X',
            bulletList: 'Ctrl+Shift+7',
            orderedList: 'Ctrl+Shift+8',
            code: 'Ctrl+E',
            blockquote: 'Ctrl+Shift+9',
            codeBlock: 'Ctrl+Alt+C',
            clear: 'Ctrl+Shift+0',
            undo: 'Ctrl+Z',
            redo: 'Ctrl+Shift+Z',
          };

      document.querySelectorAll('[data-shortcut]').forEach((element) => {
        const key = element.getAttribute('data-shortcut');
        if (!key) return;

        element.textContent = shortcutMap[key] || '';
      });

      shortcutTip.textContent = isMac ? '⌘B / ⌘I / ⌘K' : 'Ctrl+B / Ctrl+I / Ctrl+K';

      const { Editor } = await import('https://esm.sh/@tiptap/core@2.11.5');
      const { default: StarterKit } = await import('https://esm.sh/@tiptap/starter-kit@2.11.5');
      const { default: Placeholder } = await import('https://esm.sh/@tiptap/extension-placeholder@2.11.5');

      const state = vscode.getState() || {};
      const initialContent = state.content || ${JSON.stringify(initialHtml)};

      const editor = new Editor({
        element: content,
        extensions: [
          StarterKit,
          Placeholder.configure({
            placeholder: '내용을 입력하세요...'
          })
        ],
        content: initialContent,
        onSelectionUpdate: () => updateToolbarState(),
        onUpdate: () => {
          updateToolbarState();
          setSaveStatus('변경 내용 저장 중...');
        },
      });

      let saveTimer = null;
      let saveStatusTimer = null;

      function setSaveStatus(message) {
        saveStatusText.textContent = message;
        window.clearTimeout(saveStatusTimer);
        saveStatusTimer = window.setTimeout(() => {
          saveStatusText.textContent = '자동 저장 준비됨';
        }, 1800);
      }

      function updateToolbarState() {
        const buttons = toolbar.querySelectorAll('[data-active]');
        buttons.forEach((button) => {
          const cmd = button.getAttribute('data-cmd');
          if (!cmd) return;

          let active = false;
          if (cmd === 'h1') {
            active = editor.isActive('heading', { level: 1 });
          } else if (cmd === 'h2') {
            active = editor.isActive('heading', { level: 2 });
          } else if (cmd === 'h3') {
            active = editor.isActive('heading', { level: 3 });
          } else {
            active = editor.isActive(cmd);
          }

          button.classList.toggle('is-active', active);
        });
      }

      function runCommand(cmd) {
        switch (cmd) {
          case 'h1':
            editor.chain().focus().toggleHeading({ level: 1 }).run();
            break;
          case 'bold':
            editor.chain().focus().toggleBold().run();
            break;
          case 'italic':
            editor.chain().focus().toggleItalic().run();
            break;
          case 'strike':
            editor.chain().focus().toggleStrike().run();
            break;
          case 'h2':
            editor.chain().focus().toggleHeading({ level: 2 }).run();
            break;
          case 'h3':
            editor.chain().focus().toggleHeading({ level: 3 }).run();
            break;
          case 'bulletList':
            editor.chain().focus().toggleBulletList().run();
            break;
          case 'orderedList':
            editor.chain().focus().toggleOrderedList().run();
            break;
          case 'code':
            editor.chain().focus().toggleCode().run();
            break;
          case 'blockquote':
            editor.chain().focus().toggleBlockquote().run();
            break;
          case 'codeBlock':
            editor.chain().focus().toggleCodeBlock().run();
            break;
          case 'clear':
            editor.chain().focus().clearNodes().unsetAllMarks().run();
            break;
          case 'undo':
            editor.chain().focus().undo().run();
            break;
          case 'redo':
            editor.chain().focus().redo().run();
            break;
          default:
            break;
        }
      }

      toolbar.addEventListener('click', (event) => {
        const target = event.target.closest('[data-cmd]');
        if (!target) return;
        runCommand(target.getAttribute('data-cmd'));
        updateToolbarState();
      });

      document.addEventListener('keydown', (event) => {
        if (!(event.metaKey || event.ctrlKey)) {
          return;
        }

        const key = event.key.toLowerCase();
        if (event.shiftKey && key === 'x') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          runCommand('strike');
          return;
        }

        if (key === 'b') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          runCommand('bold');
          return;
        }

        if (key === 'i') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          runCommand('italic');
          return;
        }

        if (event.shiftKey && key === 'z') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          runCommand('redo');
          return;
        }

        if (key === 'z') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          runCommand('undo');
        }
      }, true);

      createBlogButton.addEventListener('click', () => {
        vscode.postMessage({
          type: 'createBlog',
          content: editor.getHTML()
        });
      });

      setInterval(() => {
        const state = vscode.getState() || {};
        state.content = editor.getHTML();
        vscode.setState(state);
        setSaveStatus('자동 저장 완료');
      }, 5000);

      window.addEventListener('beforeunload', () => {
        const state = vscode.getState() || {};
        state.content = editor.getHTML();
        vscode.setState(state);
      });

      editor.commands.focus('start');

      updateToolbarState();
    </script>
  </body>
  </html>`;
}
