import styled from '@emotion/styled';

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 2rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #888;
  margin: 0;
`;

const LoginButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 500;
  background-color: #24292e;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #2c3338;
  }

  &:active {
    background-color: #1b1f23;
  }
`;

const GithubIcon = styled.svg`
  width: 20px;
  height: 20px;
  fill: currentColor;
`;

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <LoginContainer>
      <div style={{ textAlign: 'center' }}>
        <Title>Clog</Title>
        <Subtitle>로그인하여 블로그 포스트를 작성하세요</Subtitle>
      </div>
      
      <LoginButton onClick={onLogin}>
        <GithubIcon viewBox="0 0 16 16">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </GithubIcon>
        GitHub로 로그인
      </LoginButton>
    </LoginContainer>
  );
}
