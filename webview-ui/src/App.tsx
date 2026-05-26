import { useEffect, useState } from 'react';
import LoginScreen from './pages/Login/LoginScreen';
import EditorScreen from './pages/Editor/EditorScreen';

declare global {
  interface Window {
    vscode?: {
      postMessage: (message: { type: string; [key: string]: unknown }) => void;
    };
    acquireVsCodeApi?: () => {
      postMessage: (message: { type: string; [key: string]: unknown }) => void;
    };
  }
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!window.vscode && typeof window.acquireVsCodeApi === 'function') {
      window.vscode = window.acquireVsCodeApi();
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; [key: string]: unknown };

      if (message.type === 'authStateChanged') {
        setIsLoggedIn(Boolean(message.isLoggedIn));
        setIsSigningIn(false);
        setLoginError('');
      }

      if (message.type === 'authError') {
        setIsSigningIn(false);
        setLoginError(
          typeof message.message === 'string'
            ? message.message
            : 'GitHub 로그인에 실패했습니다.',
        );
      }
    };

    window.addEventListener('message', handleMessage);
    window.vscode?.postMessage({ type: 'requestAuthState' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = () => {
    setIsSigningIn(true);
    setLoginError('');
    window.vscode?.postMessage({ type: 'loginRequest' });
  };

  return (
    <>
      {!isLoggedIn ? (
        <LoginScreen
          onLogin={handleLogin}
          isSigningIn={isSigningIn}
          errorMessage={loginError}
        />
      ) : (
        <EditorScreen />
      )}
    </>
  );
}

export default App
