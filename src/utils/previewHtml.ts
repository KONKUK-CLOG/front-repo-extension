/**
 * 블로그 포스트 미리보기 HTML 생성
 */
export function getPreviewHtml(): string {
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
        border-bottom: 1px solid #d0d7de;
        padding: 1rem 2rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        z-index: 100;
      }
      .btn {
        padding: 0.5rem 1.25rem;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-primary {
        background-color: #2da44e;
        color: white;
        border-color: #2da44e;
      }
      .btn-primary:hover {
        background-color: #2c974b;
      }
      .btn-secondary {
        background-color: white;
        color: #24292e;
      }
      .btn-secondary:hover {
        background-color: #f3f4f6;
      }
      .content {
        flex: 1;
        overflow-y: auto;
        max-width: 900px;
        margin: 0 auto;
        padding: 3rem 2rem;
        width: 100%;
      }
      h1 {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid #e1e4e8;
        padding-bottom: 0.5rem;
      }
      .meta {
        color: #586069;
        font-size: 0.9rem;
        margin-bottom: 2rem;
      }
      h2 {
        font-size: 1.8rem;
        font-weight: 600;
        margin-top: 2rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid #e1e4e8;
        padding-bottom: 0.3rem;
      }
      p {
        margin-bottom: 1rem;
      }
      code {
        background-color: #f6f8fa;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
      }
      pre {
        background-color: #f6f8fa;
        padding: 1rem;
        border-radius: 6px;
        overflow-x: auto;
        margin: 1rem 0;
      }
      pre code {
        background: none;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button class="btn btn-secondary" onclick="window.close()">닫기</button>
      <button class="btn btn-primary" onclick="createBlog()">블로그 만들기</button>
    </div>
    
    <div class="content">
      <h1>React Hooks 완벽 가이드</h1>
      <div class="meta">
        작성일: ${new Date().toLocaleDateString("ko-KR")} | 작성자: Clog User
      </div>
      
      <h2>소개</h2>
      <p>
        React Hooks는 함수형 컴포넌트에서 상태 관리와 생명주기 기능을 사용할 수 있게 해주는 
        강력한 기능입니다. 이 글에서는 가장 많이 사용되는 Hooks에 대해 알아보겠습니다.
      </p>

      <h2>useState</h2>
      <p>
        <code>useState</code>는 함수형 컴포넌트에서 상태를 관리할 수 있게 해줍니다.
      </p>
      <pre><code>const [count, setCount] = useState(0);

function increment() {
  setCount(count + 1);
}</code></pre>

      <h2>useEffect</h2>
      <p>
        <code>useEffect</code>는 컴포넌트의 사이드 이펙트를 처리합니다.
        API 호출, 구독 설정, DOM 조작 등에 사용됩니다.
      </p>
      <pre><code>useEffect(() => {
  // 컴포넌트 마운트 시 실행
  document.title = \`Count: \${count}\`;
  
  // 클린업 함수
  return () => {
    // 언마운트 시 실행
  };
}, [count]); // 의존성 배열</code></pre>

      <h2>마무리</h2>
      <p>
        React Hooks를 잘 활용하면 더 깔끔하고 유지보수하기 쉬운 코드를 작성할 수 있습니다.
        이 외에도 useContext, useReducer, useCallback, useMemo 등 다양한 Hooks가 있으니
        공식 문서를 참고해보세요!
      </p>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      
      function createBlog() {
        vscode.postMessage({ type: 'createBlog' });
      }
    </script>
  </body>
  </html>`;
}
