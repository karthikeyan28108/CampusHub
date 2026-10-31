import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  toggleChatbot,
  closeChatbot,
  clearChat,
  sendChatMessage
} from '../redux/slices/chatbotSlice.js';

const QUICK_PROMPTS = [
  'What placement drives are open?',
  'What notes are available in Notes Hub?',
  'What are the campus guidelines & policies?'
];

export default function ChatbotWidget() {
  const dispatch = useDispatch();
  const { messages, loading, isOpen } = useSelector((state) => state.chatbot);
  const [inputQuestion, setInputQuestion] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages container
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading, isOpen]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const clean = inputQuestion.trim();
    if (!clean || loading) return;

    dispatch(sendChatMessage({ question: clean }));
    setInputQuestion('');
  };

  const handlePromptClick = (promptText) => {
    if (loading) return;
    dispatch(sendChatMessage({ question: promptText }));
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        className="chatbot-float-btn"
        onClick={() => dispatch(toggleChatbot())}
        title="CampusHub AI Assistant (Powered by Gemini)"
        aria-label="Toggle CampusHub AI Chatbot"
      >
        <div className="pulse-ring" />
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Modern AI / Bot icon */}
            <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
            <rect x="4" y="8" width="16" height="12" rx="4" />
            <line x1="9" y1="13" x2="9.01" y2="13" strokeWidth="3" />
            <line x1="15" y1="13" x2="15.01" y2="13" strokeWidth="3" />
            <path d="M9.5 17c1 1 3 1 4 0" />
          </svg>
        )}
      </button>

      {/* Expandable Chatbot Window */}
      {isOpen && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center bg-primary rounded-circle"
                style={{ width: '34px', height: '34px' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <div className="fw-semibold fs-6 lh-1 text-white">CampusHub AI</div>
                <small className="text-secondary opacity-75" style={{ fontSize: '0.72rem' }}>
                  Gemini RAG • Notes & Placements
                </small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                className="btn btn-sm btn-link text-white-50 p-1"
                onClick={() => dispatch(clearChat())}
                title="Clear Chat History"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-link text-white p-1"
                onClick={() => dispatch(closeChatbot())}
                title="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="chatbot-messages-container">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-bubble ${
                  msg.sender === 'user'
                    ? 'chatbot-bubble-user'
                    : msg.isError
                    ? 'chatbot-bubble-assistant chatbot-bubble-error'
                    : 'chatbot-bubble-assistant'
                }`}
              >
                {/* Render Answer as Plain Text with preserved line breaks */}
                <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>

                {/* Render sources as small chips under the answer */}
                {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                  <div className="chatbot-sources-container">
                    <span className="text-muted fw-bold me-1" style={{ fontSize: '0.68rem' }}>
                      Sources:
                    </span>
                    {msg.sources.map((src, i) => (
                      <span key={i} className="chatbot-source-chip">
                        {src.type === 'note' && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                        )}
                        {src.type === 'projectDoc' && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                        {src.type === 'placement' && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                        )}
                        {src.label || src.subject || src.title || 'Knowledge Base'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div className="chatbot-bubble chatbot-bubble-assistant">
                <div className="chatbot-typing-dots">
                  <div className="chatbot-typing-dot" />
                  <div className="chatbot-typing-dot" />
                  <div className="chatbot-typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 pt-2 pb-1 bg-white border-top border-light d-flex gap-1 overflow-auto">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="chatbot-prompt-pill"
                onClick={() => handlePromptClick(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSubmit} className="p-2 bg-white border-top d-flex gap-2">
            <input
              type="text"
              className="form-control form-control-sm border-secondary-subtle"
              placeholder="Ask CampusHub AI..."
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm px-3 d-flex align-items-center justify-content-center"
              disabled={!inputQuestion.trim() || loading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
