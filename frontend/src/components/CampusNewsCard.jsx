import React from 'react';
import { Newspaper, ExternalLink, Share2, Sparkles, Flame, Clock, CheckCircle2 } from 'lucide-react';
import SafeImage from './SafeImage';

export function getCategoryBadge(category) {
  const cat = (category || 'university').toLowerCase();
  switch (cat) {
    case 'jamb':
      return { label: 'JAMB & UTME', color: 'bg-amber-500 text-white border-amber-600' };
    case 'asuu':
      return { label: 'ASUU & Academic', color: 'bg-purple-600 text-white border-purple-700' };
    case 'scholarship':
      return { label: 'Scholarship & Grants', color: 'bg-emerald-600 text-white border-emerald-700' };
    case 'campus':
      return { label: 'Campus Life', color: 'bg-rose-500 text-white border-rose-600' };
    default:
      return { label: 'University News', color: 'bg-sky-600 text-white border-sky-700' };
  }
}

export function formatNewsTime(timestamp) {
  if (!timestamp) return 'Recent update';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Recently';
    const diffHours = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export default function CampusNewsCard({ news, onOpenModal }) {
  if (!news) return null;
  const badge = getCategoryBadge(news.category);

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareData = {
      title: news.title,
      text: `${news.title} - Read more on CampusLink:`,
      url: news.source_url || window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${news.title} - ${news.source_url || window.location.href}`);
        alert('News link copied to clipboard!');
      }
    } catch {
      // Ignored
    }
  };

  return (
    <article
      onClick={() => onOpenModal?.(news)}
      className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer group relative"
    >
      {/* Top Banner Attribution Header */}
      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-2 border-b border-slate-100/80 bg-slate-50/60">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Newspaper className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-slate-900 truncate">
                {news.source_name || 'CampusLink News Desk'}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 fill-sky-100 shrink-0" />
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{formatNewsTime(news.published_at || news.created_at)}</span>
              <span>•</span>
              <span className="font-semibold text-slate-500">Official Campus Feed</span>
            </div>
          </div>
        </div>

        {/* Category Pill */}
        <div className="flex items-center space-x-1 shrink-0">
          {news.is_breaking && (
            <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-xs animate-pulse">
              <Flame className="w-2.5 h-2.5 fill-white" />
              <span>Breaking</span>
            </span>
          )}
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Featured News Graphic / Image */}
      {news.image_url && (
        <div className="relative aspect-[16/9] w-full bg-slate-100 overflow-hidden">
          <SafeImage
            src={news.image_url}
            alt={news.title}
            fallbackType="general"
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-2.5 left-3 right-3 text-white">
            <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-xs border border-white/20">
              Verified Educational Report
            </span>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="p-3.5 sm:p-4 space-y-2">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-sky-600 transition-colors leading-snug line-clamp-2">
          {news.title}
        </h3>
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {news.summary}
        </p>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
          <span className="text-sky-600 font-bold text-xs flex items-center space-x-1 group-hover:underline">
            <span>Read full story</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </span>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center space-x-1 text-slate-400 hover:text-slate-700 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors"
            title="Share news"
            aria-label="Share news"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}
