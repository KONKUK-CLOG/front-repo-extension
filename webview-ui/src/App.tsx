import { useState } from 'react';
import LoginScreen from './pages/Login/LoginScreen';
import EditorScreen from './pages/Editor/EditorScreen';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    // TODO: VS Code extension과 통신하여 실제 GitHub 로그인 처리
    console.log('GitHub 로그인 요청');
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
