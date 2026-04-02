export interface BlogPostTemplate {
  title: string;
  author: string;
  markdown: string;
}

export const defaultBlogPost: BlogPostTemplate = {
  title: "React Hooks 완벽 가이드",
  author: "Clog User",
  markdown: [
    "## 소개",
    "",
    "React Hooks는 함수형 컴포넌트에서 상태 관리와 생명주기 기능을 사용할 수 있게 해주는 강력한 기능입니다. 이 글에서는 가장 많이 사용되는 Hooks에 대해 알아보겠습니다.",
    "",
    "## useState",
    "",
    "useState는 함수형 컴포넌트에서 상태를 관리할 수 있게 해줍니다.",
    "",
    "```ts",
    "const [count, setCount] = useState(0);",
    "",
    "function increment() {",
    "  setCount(count + 1);",
    "}",
    "```",
    "",
    "## useEffect",
    "",
    "`useEffect`는 컴포넌트의 사이드 이펙트를 처리합니다. API 호출, 구독 설정, DOM 조작 등에 사용됩니다.",
    "",
    "```ts",
    "useEffect(() => {",
    "  // 컴포넌트 마운트 시 실행",
    "  document.title = `Count: ${count}`;",
    "",
    "  // 클린업 함수",
    "  return () => {",
    "    // 언마운트 시 실행",
    "  };",
    "}, [count]); // 의존성 배열",
    "```",
    "",
    "## 마무리",
    "",
    "React Hooks를 잘 활용하면 더 깔끔하고 유지보수하기 쉬운 코드를 작성할 수 있습니다. 이 외에도 useContext, useReducer, useCallback, useMemo 등 다양한 Hooks가 있으니 공식 문서를 참고해보세요!",
  ].join("\n"),
};
