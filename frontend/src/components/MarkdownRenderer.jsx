import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function MarkdownRenderer({ content, className = '' }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!content) return null;

  const handleCopyCode = (codeText, key) => {
    navigator.clipboard.writeText(codeText);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper for inline markdown: bold **text**, italic *text*, code `text`
  const formatInline = (text) => {
    if (!text) return '';
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    const tokens = text.split(tokenRegex);

    return tokens.map((token, i) => {
      if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        return <strong key={i} className="font-bold text-slate-900">{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
        return <em key={i} className="italic text-slate-800">{token.slice(1, -1)}</em>;
      }
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-blue-600 font-mono text-[11px] border border-slate-200/80">
            {token.slice(1, -1)}
          </code>
        );
      }
      return token;
    });
  };

  // Split content by code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.substring(lastIndex, match.index) });
    }
    blocks.push({
      type: 'code',
      language: match[1] || 'code',
      content: match[2].trim()
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', content: content.substring(lastIndex) });
  }

  return (
    <div className={`space-y-2 text-xs sm:text-[13px] leading-relaxed select-text font-sans ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          const codeKey = `block-${bIdx}`;
          return (
            <div key={codeKey} className="my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100 shadow-md font-mono text-xs">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-slate-300">{block.language || 'code'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.content, codeKey)}
                  className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer py-0.5 px-1 rounded hover:bg-slate-800"
                >
                  {copiedKey === codeKey ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 text-[11px]">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        const lines = block.content.split('\n');
        return (
          <div key={bIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lIdx} className="h-1" />;
              }

              // Headers
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="font-bold text-xs sm:text-sm text-slate-900 mt-2 mb-0.5">
                    {formatInline(trimmed.replace('### ', ''))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="font-extrabold text-sm sm:text-base text-slate-900 mt-2.5 mb-1 pb-0.5 border-b border-slate-100">
                    {formatInline(trimmed.replace('## ', ''))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="font-black text-base sm:text-lg text-slate-900 mt-3 mb-1 pb-0.5 border-b border-slate-200">
                    {formatInline(trimmed.replace('# ', ''))}
                  </h2>
                );
              }

              // Bullet points
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
                const bulletContent = trimmed.replace(/^[-*•]\s+/, '');
                return (
                  <div key={lIdx} className="flex items-start space-x-2 pl-1">
                    <span className="text-blue-500 font-bold text-xs mt-0.5">•</span>
                    <span className="text-slate-800 flex-1">
                      {formatInline(bulletContent)}
                    </span>
                  </div>
                );
              }

              // Numbered lists
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start space-x-2 pl-1">
                    <span className="font-bold text-blue-600 text-xs mt-0.5 shrink-0">{numMatch[1]}.</span>
                    <span className="text-slate-800 flex-1">
                      {formatInline(numMatch[2])}
                    </span>
                  </div>
                );
              }

              // Quotes
              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote key={lIdx} className="pl-2.5 py-1 my-1 border-l-3 border-blue-500 bg-blue-50/60 rounded-r-lg text-slate-700 italic text-xs">
                    {formatInline(trimmed.substring(2))}
                  </blockquote>
                );
              }

              // Regular paragraph
              return (
                <p key={lIdx} className="text-slate-800 break-words">
                  {formatInline(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
