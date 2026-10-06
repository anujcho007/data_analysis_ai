import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Terminal, 
  Play, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Table, 
  BarChart2, 
  X, 
  Maximize2, 
  Minimize2, 
  RefreshCw,
  Lightbulb,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { chatWithCopilot, executeCopilotSql, fetchCopilotPrompts } from '../api/client';

export default function CopilotDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am your **DataForge AI Copilot**. Ask me anything about your warehouse datasets in plain English, and I will analyze the schema, synthesize insights, write safe SQL, and visualize results.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [isCopied, setIsCopied] = useState({});
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [activeSqlExecution, setActiveSqlExecution] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Load starter prompts
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const prompts = await fetchCopilotPrompts();
        if (prompts && prompts.length > 0) {
          setSuggestedPrompts(prompts);
        }
      } catch (err) {
        console.warn('Failed to load copilot prompts:', err);
      }
    };
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const newMessages = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      // Prepare message history
      const history = newMessages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const res = await chatWithCopilot(query, history);

      const botMsgId = `bot_${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          thought: res.thought,
          sql: res.sql,
          text: res.explanation || 'Analysis complete.',
          data: res.data,
          suggestedChart: res.suggested_chart,
          followups: res.followup_questions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // Expand thought process by default for transparency
      if (res.thought) {
        setExpandedThoughts(prev => ({ ...prev, [botMsgId]: false }));
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: 'bot',
          isError: true,
          text: `⚠️ Copilot encountered an issue: ${err.message || 'Unable to process query.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySql = (msgId, sql) => {
    navigator.clipboard.writeText(sql);
    setIsCopied(prev => ({ ...prev, [msgId]: true }));
    setTimeout(() => {
      setIsCopied(prev => ({ ...prev, [msgId]: false }));
    }, 2000);
  };

  const handleReExecuteSql = async (msgId, sql) => {
    setActiveSqlExecution(msgId);
    try {
      const res = await executeCopilotSql(sql);
      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return { ...m, data: res };
        }
        return m;
      }));
    } catch (err) {
      alert(`SQL Execution Failed: ${err.message}`);
    } finally {
      setActiveSqlExecution(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
      height: '680px',
      maxHeight: 'calc(100vh - 48px)',
      background: '#ffffff',
      borderRadius: '20px',
      border: '1.5px solid #e0e7ff',
      boxShadow: '0 20px 50px -10px rgba(79, 70, 229, 0.28), 0 10px 25px -5px rgba(15, 23, 42, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      overflow: 'hidden',
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}>
            <Sparkles size={18} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '800', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>DataForge AI Copilot</span>
              <span style={{ fontSize: '0.65rem', background: '#22c55e', color: '#ffffff', padding: '1px 6px', borderRadius: '999px', fontWeight: '700' }}>
                LIVE
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
              Chief Analytics Officer & Data Engineer
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Close Copilot"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#f8fafc'
      }}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              gap: '6px',
              maxWidth: '100%'
            }}
          >
            {/* Bubble */}
            <div style={{
              maxWidth: '92%',
              padding: '12px 16px',
              borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.sender === 'user' 
                ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' 
                : (msg.isError ? '#fef2f2' : '#ffffff'),
              color: msg.sender === 'user' ? '#ffffff' : (msg.isError ? '#991b1b' : '#0f172a'),
              border: msg.sender === 'user' ? 'none' : (msg.isError ? '1px solid #fecaca' : '1px solid #e2e8f0'),
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              wordBreak: 'break-word'
            }}>
              {/* Header Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
                fontSize: '0.72rem',
                opacity: 0.75,
                fontWeight: '600'
              }}>
                {msg.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
                <span>{msg.sender === 'user' ? 'You' : 'DataForge Copilot'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Chain of Thought Toggle */}
              {msg.thought && (
                <div style={{ marginBottom: '10px' }}>
                  <button
                    onClick={() => setExpandedThoughts(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      color: '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Lightbulb size={12} color="#f59e0b" />
                    <span>Thought Process</span>
                    {expandedThoughts[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {expandedThoughts[msg.id] && (
                    <div style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.75rem',
                      color: '#64748b',
                      fontStyle: 'italic',
                      lineHeight: 1.4
                    }}>
                      {msg.thought}
                    </div>
                  )}
                </div>
              )}

              {/* Main Text Content */}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {msg.text}
              </div>

              {/* Generated SQL Code Box */}
              {msg.sql && (
                <div style={{
                  marginTop: '12px',
                  background: '#0f172a',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{
                    padding: '6px 10px',
                    background: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                    fontWeight: '600'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={12} color="#38bdf8" />
                      <span>Generated Safe SQLite</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleCopySql(msg.id, msg.sql)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.68rem'
                        }}
                      >
                        {isCopied[msg.id] ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        <span>{isCopied[msg.id] ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => handleReExecuteSql(msg.id, msg.sql)}
                        disabled={activeSqlExecution === msg.id}
                        style={{
                          background: '#4f46e5',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.68rem',
                          fontWeight: '700'
                        }}
                      >
                        <Play size={10} />
                        <span>{activeSqlExecution === msg.id ? 'Running...' : 'Run'}</span>
                      </button>
                    </div>
                  </div>
                  <pre style={{
                    margin: 0,
                    padding: '10px 12px',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    lineHeight: 1.4
                  }}>
                    {msg.sql}
                  </pre>
                </div>
              )}

              {/* Data Table Mini Preview */}
              {msg.data && msg.data.rows && msg.data.rows.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '6px 10px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    color: '#475569'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Table size={12} color="#4f46e5" />
                      <span>Result Preview ({msg.data.row_count} rows)</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: '160px' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.72rem',
                      textAlign: 'left'
                    }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          {msg.data.columns.slice(0, 4).map((col) => (
                            <th key={col} style={{ padding: '6px 10px', fontWeight: '700', color: '#1e293b' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.data.rows.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {msg.data.columns.slice(0, 4).map((col) => (
                              <td key={col} style={{ padding: '6px 10px', color: '#334155' }}>
                                {String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Follow-up Prompts */}
              {msg.followups && msg.followups.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {msg.followups.map((fPrompt, fIdx) => (
                    <button
                      key={fIdx}
                      onClick={() => handleSendMessage(fPrompt)}
                      style={{
                        background: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '0.7rem',
                        color: '#4338ca',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s'
                      }}
                    >
                      {fPrompt} &rarr;
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', color: '#4f46e5' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid #c7d2fe',
              borderTopColor: '#4f46e5',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Copilot is analyzing warehouse data...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts Carousel (Shown if chat is short) */}
      {messages.length <= 2 && suggestedPrompts.length > 0 && (
        <div style={{
          padding: '8px 16px',
          background: '#f1f5f9',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          {suggestedPrompts.slice(0, 3).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.7rem',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              💡 {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
        style={{
          padding: '14px 18px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Copilot a question (e.g. 'top 5 products by revenue')..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1.5px solid #cbd5e1',
            fontSize: '0.85rem',
            outline: 'none',
            transition: 'border-color 0.2s',
            color: '#0f172a'
          }}
          onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          style={{
            background: inputText.trim() && !isLoading ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : '#e2e8f0',
            color: inputText.trim() && !isLoading ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: inputText.trim() && !isLoading ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none'
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
