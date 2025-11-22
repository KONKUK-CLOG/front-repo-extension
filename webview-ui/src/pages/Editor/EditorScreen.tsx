import styled from '@emotion/styled';
import { useState, useEffect } from 'react';

// VS Code API 타입 선언
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

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #1e1e1e;
  color: #d4d4d4;
  overflow: hidden;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 0.75rem;
  gap: 0.75rem;
  min-height: 0;
`;

const ConversationArea = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
  background-color: #1e1e1e;
  min-height: 0;
`;

const Message = styled.div<{ role: 'user' | 'assistant' }>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  background-color: transparent;
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #888;
`;

const MessageContent = styled.div`
  color: #d4d4d4;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const ThinkingIndicator = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  color: #888;
  font-size: 0.85rem;
`;

const ThinkingStep = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: #aaa;
  font-size: 0.8rem;
  line-height: 1.4;
`;

const InputSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: #2d2d30;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #3e3e42;
`;

const AttachmentsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  max-height: 120px;
  overflow-y: auto;
`;

const AttachmentChip = styled.div<{ isPending?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background-color: ${props => props.isPending ? '#0e639c' : '#1e1e1e'};
  border: 1px solid ${props => props.isPending ? '#1177bb' : '#3e3e42'};
  border-radius: 4px;
  font-size: 0.75rem;
  color: #d4d4d4;
  flex: 1;
  min-width: 0;
  cursor: ${props => props.isPending ? 'pointer' : 'default'};
  transition: all 0.2s;
  
  ${props => props.isPending && `
    &:hover {
      background-color: #1177bb;
    }
  `}
  
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;


const RemoveButton = styled.button`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  
  &:hover {
    color: #d4d4d4;
  }
`;

const InputRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
`;

const TextInput = styled.textarea`
  flex: 1;
  padding: 0.6rem 0.75rem;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 0.85rem;
  font-family: inherit;
  line-height: 1.4;
  resize: none;
  min-height: 36px;
  max-height: 120px;
  
  &:focus {
    outline: none;
    border-color: #0e639c;
  }
  
  &::placeholder {
    color: #6e6e6e;
  }
`;

const IconButton = styled.button`
  padding: 0.5rem;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  min-width: 32px;
  height: 32px;
  
  &:hover {
    background-color: #3e3e42;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SendButton = styled(IconButton)`
  background-color: #0e639c;
  border-color: #0e639c;
  
  &:hover:not(:disabled) {
    background-color: #1177bb;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6e6e6e;
  gap: 1rem;
  
  svg {
    width: 64px;
    height: 64px;
    opacity: 0.5;
  }
  
  p {
    font-size: 1.1rem;
    margin: 0;
  }
`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinkingSteps?: string[];
}

interface Attachment {
  id: string;
  type: 'image' | 'code';
  name: string;
  data: string;
}

export default function EditorScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingCode, setPendingCode] = useState<Attachment | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);

  // VS Code API 초기화
  useEffect(() => {
    if (typeof window.acquireVsCodeApi === 'function' && !window.vscode) {
      window.vscode = window.acquireVsCodeApi();
    }
  }, []);

  // VS Code extension으로부터 메시지 받기
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'codePending') {
        // Extension에서 보낸 코드를 임시 칩으로 표시 (아직 추가 안됨)
        const tempAttachment: Attachment = {
          id: 'pending-' + Date.now(),
          type: 'code',
          name: `${message.fileName} (줄 ${message.lineStart}-${message.lineEnd})`,
          data: message.code,
        };
        setPendingCode(tempAttachment);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setPendingCode(null);

    // LLM 사고 과정 시뮬레이션
    setIsThinking(true);
    setThinkingSteps([]);

    const steps = [
      '사용자 요청 분석 중...',
      '코드 컨텍스트 이해하기...',
      '블로그 구조 설계 중...',
      '마크다운 형식으로 변환 중...',
      '최종 검토 중...'
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setThinkingSteps(prev => [...prev, step]);
      }, index * 800);
    });

    // 완성 후 미리보기 띄우기
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '블로그 포스트가 생성되었습니다! 미리보기를 확인해주세요.',
        timestamp: new Date(),
        thinkingSteps: steps,
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsThinking(false);
      setThinkingSteps([]);

      // 미리보기 패널 열기 (VS Code extension에 메시지 전송)
      if (window.vscode) {
        window.vscode.postMessage({ type: 'openPreview' });
      }
    }, steps.length * 800 + 500);
  };



  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const addPendingCode = () => {
    if (pendingCode) {
      setAttachments(prev => [...prev, { ...pendingCode, id: Date.now().toString() + Math.random() }]);
      setPendingCode(null);
    }
  };

  const removePendingCode = () => {
    setPendingCode(null);
  };

  return (
    <EditorContainer>
      <Content>
        <ConversationArea>
          {messages.length === 0 ? (
            <EmptyState>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>블로그 포스트 작성을 시작해보세요</p>
              <p style={{ fontSize: '0.9rem' }}>예: "React hooks에 대한 블로그 글을 작성해줘"</p>
            </EmptyState>
          ) : (
            <>
              {messages.map(msg => (
                <Message key={msg.id} role={msg.role}>
                  <MessageHeader>
                    {msg.role === 'user' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="#888" />
                        <path d="M4 20c0-4 4-6 8-6s8 2 8 6v1H4v-1z" fill="#888" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.5c-2.5 1-5-1-4-3.5.8-1.8 3.2-2 4.2-1.2.9.7 1 2.5-.2 4.7z" fill="#888" />
                      </svg>
                    )}
                  </MessageHeader>
                  <MessageContent>{msg.content}</MessageContent>
                </Message>
              ))}
              {isThinking && (
                <ThinkingIndicator>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <svg width="18" height="10" viewBox="0 0 50 10" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="5" cy="5" r="3" fill="#888" />
                      <circle cx="25" cy="5" r="3" fill="#888" />
                      <circle cx="45" cy="5" r="3" fill="#888" />
                    </svg>
                    <span>블로그 포스트를 생성하고 있습니다...</span>
                  </div>
                  {thinkingSteps.map((step, index) => (
                    <ThinkingStep key={index}>
                      <span>→</span>
                      <span>{step}</span>
                    </ThinkingStep>
                  ))}
                </ThinkingIndicator>
              )}
            </>
          )}
        </ConversationArea>
        
        <InputSection>
          {(attachments.length > 0 || pendingCode) && (
            <AttachmentsRow>
              {pendingCode && (
                <AttachmentChip isPending onClick={addPendingCode} title="클릭하여 추가">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 18H8a2 2 0 01-2-2V8" stroke="#d4d4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 6h-8l-2 2v8a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2z" stroke="#d4d4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>{pendingCode.name}</span>
                  </span>
                  <RemoveButton onClick={(e) => { e.stopPropagation(); removePendingCode(); }}>✕</RemoveButton>
                </AttachmentChip>
              )}
              {attachments.map(att => (
                <AttachmentChip key={att.id}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {att.type === 'image' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14h18z" stroke="#d4d4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 18H8a2 2 0 01-2-2V8" stroke="#d4d4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 6h-8l-2 2v8a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2z" stroke="#d4d4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                    <span>{att.name}</span>
                  </span>
                  <RemoveButton onClick={() => removeAttachment(att.id)}>✕</RemoveButton>
                </AttachmentChip>
              ))}
            </AttachmentsRow>
          )}
          
          <InputRow>
            <TextInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="블로그 주제나 코드를 입력하세요... (Shift+Enter로 줄바꿈)"
            />
            <SendButton onClick={handleSend} disabled={!input.trim() && attachments.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="#fff" fillOpacity="0.2"/>
              </svg>
            </SendButton>
          </InputRow>
        </InputSection>
      </Content>
    </EditorContainer>
  );
}
