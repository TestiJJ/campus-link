// src/CampusAI.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Bot, User, Copy, Check, RotateCcw,
  Zap, X, ChevronRight, MessageSquare,
  Code, ShoppingBag, GraduationCap, Lightbulb, Terminal, AlertCircle,
  ThumbsUp, ThumbsDown, ArrowUp, HelpCircle, BookOpen
} from 'lucide-react';
import API from './api';

export default function CampusAI({ user, isVendor = false, onClose = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : (isVendor ? 'Merchant' : 'Student');

  // Load message history on mount
  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await API.get('/ai/messages');
      if (res.data && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch (err) {
      console.error('Failed to load AI messages:', err);
    }
  };

  const handleSendMessage = async (customText = null) => {
    const textToSend = (typeof customText === 'string' ? customText : input).trim();
    if (!textToSend || loading) return;

    const userMsgObj = {
      id: 'temp-' + Date.now(),
      sender: 'user',
      content: textToSend,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsgObj]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);
    try {
      const res = await API.post('/ai/chat', { 
        content: textToSend,
        message: textToSend
      });

      setMessages(prev => [
        ...prev,
        {
          id: res.data.id || ('ai-' + Date.now()),
          sender: 'ai',
          content: res.data.content || res.data.reply,
          created_at: res.data.created_at || new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('AI chat failed:', err);
      setMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'ai',
          content: "I'm having a brief connection issue reaching the AI network. Please check your internet or retry your prompt!",
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Start a new conversation? This will clear the current chat thread.')) return;
    try {
      await API.post('/ai/clear');
      setMessages([]);
      fetchMessages();
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const handleCopyText = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyCodeSnippet = (codeText, key) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeKey(key);
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  const handleTextareaKeyDown = (e) => {
    const isMobileDevice = typeof navigator !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768));
    if (e.key === 'Enter') {
      if (isMobileDevice) return; // Allow mobile on-screen return key to insert newlines
      if (e.shiftKey || e.altKey) return; // Allow Shift+Enter or Alt+Enter on desktop to insert newlines
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  // Vendor Starter Prompts
  const vendorStarterPrompts = [
    {
      icon: <ShoppingBag className="w-4 h-4 text-blue-600" />,
      title: "Product Listing Copy",
      prompt: "Write an attractive, high-converting product description for brand-new sneakers to post on CampusLink Marketplace."
    },
    {
      icon: <MessageSquare className="w-4 h-4 text-sky-500" />,
      title: "Customer Reply Assistant",
      prompt: "How do I reply to this: 'Hello, is this item still available and can you deliver to New Hall hostel today?'"
    },
    {
      icon: <Zap className="w-4 h-4 text-emerald-500" />,
      title: "Calculate Pricing & Margin",
      prompt: "What is a 25% profit margin if my cost price of an item is ₦12,000? How much should I sell it?"
    },
    {
      icon: <BookOpen className="w-4 h-4 text-blue-500" />,
      title: "Grammar & Definition",
      prompt: "What is a noun? Explain with examples and types."
    }
  ];

  // Student Starter Prompts
  const studentStarterPrompts = [
    {
      icon: <BookOpen className="w-4 h-4 text-blue-600" />,
      title: "Grammar & Definition",
      prompt: "What is a noun? Give examples and explain the types."
    },
    {
      icon: <MessageSquare className="w-4 h-4 text-sky-500" />,
      title: "Message Reply Assistant",
      prompt: "How do I reply to this: 'Are you free to meet up at the library this evening for study group?'"
    },
    {
      icon: <GraduationCap className="w-4 h-4 text-blue-500" />,
      title: "Lecturer Excuse Email",
      prompt: "Draft a formal, respectful email apologizing to my lecturer for missing an 8:00 AM class due to a brief illness."
    },
    {
      icon: <Zap className="w-4 h-4 text-emerald-500" />,
      title: "Calculate & Maintain 5.0 CGPA",
      prompt: "Break down the standard 5.0 CGPA scale and explain the highest-impact study strategy to graduate with a First Class."
    }
  ];

  const starterPrompts = isVendor ? vendorStarterPrompts : studentStarterPrompts;

  // Render Markdown-like text with Code Blocks
  const renderFormattedText = (text, msgIdx) => {
    if (!text) return null;

    // Split by code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'code',
        content: match[2].trim()
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return parts.map((part, pIdx) => {
      if (part.type === 'code') {
        const codeKey = `${msgIdx}-${pIdx}`;
        return (
          <div key={codeKey} className="my-3 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100 shadow-lg text-xs font-mono">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-300">{part.language || 'code'}</span>
              <button
                type="button"
                onClick={() => handleCopyCodeSnippet(part.content, codeKey)}
                className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
              >
                {copiedCodeKey === codeKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              <code>{part.content}</code>
            </pre>
          </div>
        );
      }

      // Format normal text with lists, headers, bold, italics
      const lines = part.content.split('\n');
      return (
        <div key={pIdx} className="space-y-2 leading-relaxed">
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) {
              return <div key={lIdx} className="h-1.5" />;
            }

            // Headers
            if (trimmed.startsWith('### ')) {
              return (
                <h4 key={lIdx} className="font-bold text-sm text-slate-900 mt-3 mb-1">
                  {formatInlineText(trimmed.replace('### ', ''))}
                </h4>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h3 key={lIdx} className="font-extrabold text-base text-slate-900 mt-3.5 mb-1 pb-1 border-b border-slate-100">
                  {formatInlineText(trimmed.replace('## ', ''))}
                </h3>
              );
            }
            if (trimmed.startsWith('# ')) {
              return (
                <h2 key={lIdx} className="font-black text-lg text-slate-900 mt-4 mb-1.5 pb-1 border-b border-slate-200">
                  {formatInlineText(trimmed.replace('# ', ''))}
                </h2>
              );
            }

            // Bullet points
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-1.5">
                  <span className="text-blue-500 font-bold mt-1 text-xs">•</span>
                  <span className="text-slate-700 text-xs sm:text-[13px] flex-1">
                    {formatInlineText(trimmed.substring(2))}
                  </span>
                </div>
              );
            }

            // Numbered lists
            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
            if (numMatch) {
              return (
                <div key={lIdx} className="flex items-start space-x-2.5 pl-1.5">
                  <span className="font-bold text-blue-600 text-xs mt-0.5 min-w-[16px]">{numMatch[1]}.</span>
                  <span className="text-slate-700 text-xs sm:text-[13px] flex-1">
                    {formatInlineText(numMatch[2])}
                  </span>
                </div>
              );
            }

            // Blockquote
            if (trimmed.startsWith('> ')) {
              return (
                <blockquote key={lIdx} className="pl-3 py-1 border-l-2 border-blue-500 bg-blue-50/50 rounded-r-lg text-slate-700 italic text-xs">
                  {formatInlineText(trimmed.substring(2))}
                </blockquote>
              );
            }

            // Regular paragraph
            return (
              <p key={lIdx} className="text-slate-700 text-xs sm:text-[13px]">
                {formatInlineText(trimmed)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  // Helper for inline markdown: bold **text**, code `text`
  const formatInlineText = (text) => {
    if (!text) return '';
    const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    const tokens = text.split(tokenRegex);

    return tokens.map((token, i) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-blue-600 font-mono text-[11px] border border-slate-200">
            {token.slice(1, -1)}
          </code>
        );
      }
      return token;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[580px] bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden relative">
      {/* Top Header Bar */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-black text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>CampusLink AI</span>
                {isVendor ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Vendor Copilot
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Student Assistant
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Online • Always Available</span>
              </span>
              <span>•</span>
              <span className="text-slate-500 font-medium">
                Blue & White Edition
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleClearChat}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Start new chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="max-w-2xl mx-auto py-8 text-center flex flex-col items-center justify-center min-h-full">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 mb-4">
              <Sparkles className="w-8 h-8" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              What can I help you with today, {firstName}?
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-lg leading-relaxed">
              {isVendor
                ? "I am your personal CampusLink business copilot. Ask me to write product descriptions, draft customer replies, calculate margins, or answer any questions."
                : "I am your versatile CampusLink university assistant. Ask me to explain grammar or concepts, draft replies, solve equations, or guide your academics."}
            </p>

            {/* Starter Suggestion Cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              {starterPrompts.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(card.prompt)}
                  className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-md hover:bg-blue-50/20 transition-all text-left flex items-start space-x-3 group cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors shrink-0">
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {card.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {card.prompt}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 self-center" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id || idx}
                  className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[78%]`}>
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      <span className="text-[11px] font-bold text-slate-600">
                        {isUser ? 'You' : 'CampusLink AI'}
                      </span>
                      {msg.created_at && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div
                      className={`p-4 rounded-2xl relative group ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {renderFormattedText(msg.content, idx)}
                        </div>
                      )}

                      {/* Action buttons on AI bubble */}
                      {!isUser && (
                        <div className="flex items-center justify-end space-x-1 mt-3 pt-2 border-t border-slate-100 text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.content, idx)}
                            className="p-1 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors text-[11px] flex items-center space-x-1 cursor-pointer"
                            title="Copy response"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-[10px] text-emerald-600 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-200 rounded-tl-xs shadow-xs flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[11px] font-medium text-slate-500 pl-1">CampusLink AI is formulating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Bottom Input Bar */}
      <div className="p-4 sm:p-5 border-t border-slate-100 bg-white/95 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end space-x-2 bg-slate-50 hover:bg-slate-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 border border-slate-200 rounded-2xl p-2 transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleTextareaKeyDown}
              placeholder={isVendor ? "Ask CampusLink AI to write product copy, draft customer replies, calculate pricing..." : "Ask CampusLink AI anything (what is a noun, how do I reply, math, campus advice)..."}
              className="flex-1 max-h-36 min-h-[38px] p-2 bg-transparent text-xs sm:text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
            />

            <button
              type="button"
              disabled={!input.trim() || loading}
              onClick={() => handleSendMessage()}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm shadow-blue-500/20"
              title="Send Prompt (Enter)"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <p className="text-[10px] text-center text-slate-400 mt-2">
            CampusLink AI Assistant • Powered by Blue & White Campus Engine
          </p>
        </div>
      </div>
    </div>
  );
}
