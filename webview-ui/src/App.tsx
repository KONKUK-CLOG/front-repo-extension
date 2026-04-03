import { useState } from 'react';
import LoginScreen from './pages/Login/LoginScreen';
import EditorScreen from './pages/Editor/EditorScreen';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    if (!window.vscode && typeof window.acquireVsCodeApi === 'function') {
      window.vscode = window.acquireVsCodeApi();
    }

    window.vscode?.postMessage({ type: 'loginSuccess' });
    setIsLoggedIn(true);
  };

  return (
    <>
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <EditorScreen />
      )}
    </>
  );
}

export default App
