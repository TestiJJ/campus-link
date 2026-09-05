// src/components/StoryReplyBubble.jsx
import React from 'react';
import { Sparkles, Play } from 'lucide-react';
import SafeImage from './SafeImage';

/**
 * Parses both modern JSON status_reply payloads and legacy string replies.
 */
export function parseStatusReply(msg) {
  if (!msg) return null;
  const content = msg.content || msg.text || '';

  // 1. Direct JSON status_reply payload
  if (
    msg.message_type === 'status_reply' ||
    (typeof content === 'string' && content.trim().startsWith('{') && content.includes('"type":"status_reply"'))
  ) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (
        parsed &&
        (parsed.type === 'status_reply' ||
          parsed.status_id !== undefined ||
          parsed.reply_text !== undefined ||
          parsed.reaction)
      ) {
        return {
          isStatusReply: true,
          statusId: parsed.status_id,
          mediaUrl: parsed.status_media_url || msg.media_url,
          mediaType: parsed.status_media_type || (parsed.status_media_url ? 'image' : 'text'),
          caption: parsed.status_caption || '',
          bgColor: parsed.status_bg || 'from-sky-600 to-indigo-700',
          authorName: parsed.author_name || 'Story',
          replyText: parsed.reply_text || '',
          reaction: parsed.reaction || null
        };
      }
    } catch {
      // Fallback to text parsing
    }
  }

  // 2. Legacy reaction string: "Reacted ❤️ to your story"
  const reactMatch = typeof content === 'string' && content.match(/^Reacted\s+([^\s]+)\s+to your story/i);
  if (reactMatch) {
    return {
      isStatusReply: true,
      mediaType: 'text',
      caption: 'Status Story',
      authorName: 'Story',
      reaction: reactMatch[1],
      replyText: ''
    };
  }

  // 3. Legacy reply string: "Replying to status: \"...\"" or "Replying to your story: \"...\""
  const replyMatch =
    typeof content === 'string' && content.match(/^Replying to (?:status|your story):\s*"?([^"]*)"?$/i);
  if (replyMatch) {
    return {
      isStatusReply: true,
      mediaType: 'text',
      caption: 'Status Story',
      authorName: 'Story',
      reaction: null,
      replyText: replyMatch[1]
    };
  }

  return null;
}

/**
 * Renders an Instagram/WhatsApp/Facebook style quoted story preview card inside chat bubbles.
 */
export default function StoryReplyBubble({ msg, isMine, onStoryClick }) {
  const story = parseStatusReply(msg);
  if (!story) return null;

  return (
    <div className="space-y-2">
      {/* Quoted Story Card */}
      <div
        onClick={() => onStoryClick && story.statusId && onStoryClick(story.statusId)}
        className={`rounded-2xl overflow-hidden border p-2 flex items-start space-x-2.5 transition-all text-left ${
          isMine
            ? 'bg-sky-600/40 border-white/25 text-white shadow-inner'
            : 'bg-slate-100/90 border-slate-200/90 text-slate-800'
        } ${story.statusId && onStoryClick ? 'cursor-pointer hover:opacity-95 active:scale-[0.99]' : ''}`}
      >
        {/* Left: Thumbnail or Vibrant Mini Gradient Canvas */}
        {story.mediaUrl && story.mediaType === 'image' ? (
          <div className="relative w-12 h-14 rounded-xl overflow-hidden shrink-0 bg-black/20 border border-white/20">
            <SafeImage
              src={story.mediaUrl}
              alt="Story"
              fallbackType="product"
              className="w-full h-full object-cover"
            />
          </div>
        ) : story.mediaUrl && story.mediaType === 'video' ? (
          <div className="relative w-12 h-14 rounded-xl overflow-hidden shrink-0 bg-black flex items-center justify-center border border-white/20">
            <video src={story.mediaUrl} className="w-full h-full object-cover opacity-80" />
            <Play className="w-4 h-4 text-white absolute fill-white" />
          </div>
        ) : (
          <div
            className={`w-12 h-14 rounded-xl shrink-0 flex items-center justify-center p-1.5 text-center bg-gradient-to-tr ${
              story.bgColor || 'from-sky-600 to-indigo-700'
            } text-white shadow-xs`}
          >
            <span className="text-[9px] font-black line-clamp-3 leading-tight drop-shadow-xs">
              {story.caption || 'Status'}
            </span>
          </div>
        )}

        {/* Right: Story details */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center space-x-1 opacity-80 mb-0.5">
            <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider truncate">
              {story.authorName ? `${story.authorName}'s Story` : 'Status Story'}
            </span>
          </div>
          <p
            className={`text-[11px] font-medium line-clamp-2 leading-snug ${
              isMine ? 'text-sky-100' : 'text-slate-600'
            }`}
          >
            {story.caption ||
              (story.mediaType === 'image'
                ? '📷 Photo story'
                : story.mediaType === 'video'
                ? '🎥 Video story'
                : 'Status update')}
          </p>
        </div>
      </div>

      {/* Actual User Reply or Emoji Reaction underneath */}
      {story.reaction ? (
        <div className="flex items-center space-x-2 pt-0.5 pb-1">
          <span className="text-3xl filter drop-shadow-xs select-none animate-bounce">
            {story.reaction}
          </span>
          <span className={`text-[11px] font-semibold ${isMine ? 'text-sky-100' : 'text-slate-500'}`}>
            Reacted to story
          </span>
        </div>
      ) : story.replyText ? (
        <p className="text-xs font-medium whitespace-pre-wrap pt-0.5 leading-relaxed">
          {story.replyText}
        </p>
      ) : null}
    </div>
  );
}
