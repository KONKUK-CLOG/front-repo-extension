import styled from '@emotion/styled';
import { useState, useEffect, useRef, useCallback } from 'react';
import { markdownToHtml } from '../../utils/markdown';

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

  p,
  ul,
  ol,
  blockquote,
  pre {
    margin: 0.4rem 0;
  }

  strong {
    font-weight: 700;
    color: #ffffff;
  }

  em {
    font-style: italic;
  }

  code {
    background: #0f111a;
    border: 1px solid #2d333b;
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.82rem;
  }

  pre {
    background: #0f111a;
    border: 1px solid #2d333b;
    border-radius: 8px;
    padding: 0.7rem;
    overflow: auto;
  }

  pre code {
    border: none;
    padding: 0;
    background: transparent;
  }

  a {
    color: #54aeff;
  }
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

const PreviewBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #2da44e;
  background: rgba(45, 164, 78, 0.12);
  color: #d4d4d4;
  font-size: 0.82rem;
`;

const PreviewOpenButton = styled.button`
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  background: #2da44e;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: #3fb950;
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
}

interface Attachment {
  id: string;
  type: 'image' | 'code';
  name: string;
  data: string;
  fileName?: string;
  language?: string;
  lineStart?: number;
  lineEnd?: number;
}

function upsertAssistantMessage(
  prev: Message[],
  draftId: string,
  content: string,
): Message[] {
  const exists = prev.some(msg => msg.id === draftId);
  if (!exists) {
    return [
      ...prev,
      {
        id: draftId,
        role: 'assistant' as const,
        content,
        timestamp: new Date(),
      },
    ];
  }

  return prev.map(msg =>
    msg.id === draftId ? { ...msg, content } : msg,
  );
}

export default function EditorScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingCode, setPendingCode] = useState<Attachment | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const assistantDraftIdRef = useRef<string | null>(null);
  const isComposingRef = useRef(false);
  const sendLockRef = useRef(false);

  const syncAssistantMessage = useCallback((draftId: string, content: string) => {
    if (!content) {
      return;
    }
    setMessages(prev => upsertAssistantMessage(prev, draftId, content));
  }, []);

  const openPreview = () => {
    if (!previewMarkdown.trim()) {
      return;
    }
    window.vscode?.postMessage({
      type: 'openPreview',
      markdown: previewMarkdown,
    });
  };

  // VS Code API 초기화
  useEffect(() => {
    if (typeof window.acquireVsCodeApi === 'function' && !window.vscode) {
      window.vscode = window.acquireVsCodeApi();
    }
  }, []);

  // VS Code extension으로부터 메시지 받기
  useEffect(() => {
    const matchesDraft = (msg: { draftId?: string }) => {
      const id = typeof msg.draftId === 'string' ? msg.draftId : undefined;
      return !id || id === assistantDraftIdRef.current;
    };

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'codePending') {
        // Extension에서 보낸 코드를 임시 칩으로 표시 (아직 추가 안됨)
        const tempAttachment: Attachment = {
          id: 'pending-' + Date.now(),
          type: 'code',
          name: `${message.fileName} (줄 ${message.lineStart}-${message.lineEnd})`,
          data: message.code,
          fileName: message.fileName,
          language: message.language,
          lineStart: message.lineStart,
          lineEnd: message.lineEnd,
        };
        setPendingCode(tempAttachment);
        return;
      }

      if (message.type === 'llmStreamStarted') {
        if (!matchesDraft(message)) {
          return;
        }
        setPreviewMarkdown('');
        setIsThinking(true);
        setIsStreaming(true);
        setThinkingText('');
        return;
      }

      if (message.type === 'llmThinkingChunk') {
        if (!matchesDraft(message)) {
          return;
        }
        if (typeof message.aggregate === 'string') {
          setThinkingText(message.aggregate);
        }
        return;
      }

      if (message.type === 'llmAssistantChunk') {
        if (!matchesDraft(message)) {
          return;
        }
        if (typeof message.aggregate !== 'string' || !message.aggregate) {
          return;
        }

        const draftId = assistantDraftIdRef.current;
        if (!draftId) {
          return;
        }

        setIsThinking(false);
        syncAssistantMessage(draftId, message.aggregate);
        return;
      }

      if (message.type === 'llmPreviewChunk') {
        if (!matchesDraft(message)) {
          return;
        }
        if (typeof message.aggregate === 'string' && message.aggregate.trim()) {
          setPreviewMarkdown(message.aggregate);
        }
        return;
      }

      if (message.type === 'llmStreamDone') {
        if (!matchesDraft(message)) {
          return;
        }
        const draftId = assistantDraftIdRef.current;
        const finalResponse =
          typeof message.response === 'string' ? message.response : '';
        const finalPreview =
          typeof message.previewMarkdown === 'string'
            ? message.previewMarkdown
            : '';

        if (draftId && finalResponse.trim()) {
          syncAssistantMessage(draftId, finalResponse);
        }
        if (finalPreview.trim()) {
          setPreviewMarkdown(finalPreview);
        }

        setIsThinking(false);
        setIsStreaming(false);
        setThinkingText('');
        assistantDraftIdRef.current = null;
        sendLockRef.current = false;
        return;
      }

      if (message.type === 'llmStreamError') {
        if (!matchesDraft(message)) {
          return;
        }
        setIsThinking(false);
        setIsStreaming(false);
        setThinkingText('');

        if (message.isCanceled) {
          const draftId = assistantDraftIdRef.current;
          setMessages(prev =>
            prev.filter(msg => msg.id !== draftId || msg.content.trim().length > 0),
          );
          assistantDraftIdRef.current = null;
          sendLockRef.current = false;
          return;
        }

        const errorText =
          typeof message.message === 'string' && message.message
            ? message.message
            : '스트림 처리 중 오류가 발생했습니다.';
        const draftId = assistantDraftIdRef.current;
        if (draftId) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === draftId
                ? {
                    ...msg,
                    content: `오류: ${errorText}`,
                  }
                : msg,
            ),
          );
        }

        assistantDraftIdRef.current = null;
        sendLockRef.current = false;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [syncAssistantMessage]);

  const handleSend = () => {
    if (sendLockRef.current || isStreaming) {
      return;
    }
    if (!input.trim() && attachments.length === 0) {
      return;
    }

    const fallbackPrompt = '첨부된 내용을 참고해 블로그 글을 작성해주세요.';
    const prompt = input.trim() || fallbackPrompt;

    const attachmentPayload = attachments.map(att => ({
      type: att.type,
      name: att.name,
      data: att.data,
      fileName: att.fileName,
      language: att.language,
      lineStart: att.lineStart,
      lineEnd: att.lineEnd,
    }));

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() || '(첨부 코드 기반 요청)',
      timestamp: new Date(),
    };

    const draftId = `assistant-${Date.now()}`;

    sendLockRef.current = true;
    setPreviewMarkdown('');
    setMessages(prev => [...prev, userMessage]);
    assistantDraftIdRef.current = draftId;
    setInput('');
    setAttachments([]);
    setPendingCode(null);
    setIsThinking(true);
    setThinkingText('');
    setIsStreaming(true);

    window.vscode?.postMessage({
      type: 'sendPrompt',
      prompt,
      attachments: attachmentPayload,
      draftId,
    });
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
              {messages
                .filter(
                  msg => msg.role !== 'assistant' || msg.content.trim().length > 0,
                )
                .map(msg => (
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
                  {msg.role === 'assistant' ? (
                    msg.content.trim() ? (
                    <MessageContent
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(msg.content),
                      }}
                    />
                    ) : null
                  ) : (
                    <MessageContent>{msg.content}</MessageContent>
                  )}
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
                  {(thinkingText.split('\n').filter(Boolean).length > 0
                    ? thinkingText.split('\n').filter(Boolean)
                    : ['스트림 이벤트 대기 중...']
                  ).map((step, index) => (
                    <ThinkingStep key={`${step}-${index}`}>
                      <span>→</span>
                      <span>{step}</span>
                    </ThinkingStep>
                  ))}
                </ThinkingIndicator>
              )}
            </>
          )}
        </ConversationArea>
        
        {previewMarkdown.trim() ? (
          <PreviewBar>
            <span>블로그 초안이 준비되었습니다. 미리보기에서 편집 후 발행하세요.</span>
            <PreviewOpenButton type="button" onClick={openPreview}>
              블로그 미리보기 · 만들기
            </PreviewOpenButton>
          </PreviewBar>
        ) : null}

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
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (
                    e.nativeEvent.isComposing ||
                    isComposingRef.current ||
                    sendLockRef.current ||
                    isStreaming
                  ) {
                    return;
                  }
                  handleSend();
                }
              }}
              placeholder="블로그 주제나 코드를 입력하세요... (Shift+Enter로 줄바꿈)"
            />
            <SendButton
              onClick={handleSend}
              disabled={
                isStreaming || (!input.trim() && attachments.length === 0)
              }
            >
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
