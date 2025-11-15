import { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import EditorScreen from './components/EditorScreen';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    // TODO: VS Code extension과 통신하여 실제 GitHub 로그인 처리
    console.log('GitHub 로그인 요청');
    setIsLoggedIn(true);
  };

  const handlePublish = () => {
    // TODO: VS Code extension과 통신하여 GitHub에 포스트 발행
    console.log('포스트 발행');
  };

  const handleSave = () => {
    // TODO: VS Code extension과 통신하여 임시저장
    console.log('임시저장');
  };

  return (
    <>
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <EditorScreen onPublish={handlePublish} onSave={handleSave} />
      )}
    </>
  );
}

export default App
