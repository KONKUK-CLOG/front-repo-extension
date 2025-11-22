import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Global, css } from '@emotion/react'
import App from './App.tsx'

const globalStyles = css`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :root {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif;
    line-height: 1.5;
    font-weight: 400;

    color-scheme: dark;
    color: rgba(255, 255, 255, 0.87);
    background-color: #1e1e1e;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
  }

  #root {
    width: 100%;
    height: 100vh;
  }

  button {
    font-family: inherit;
  }
`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Global styles={globalStyles} />
    <App />
  </StrictMode>,
)
