import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Share2, Clock, Newspaper, CheckCircle2, Bookmark, Flame } from 'lucide-react';
import SafeImage from './SafeImage';
import { getCategoryBadge, formatNewsTime } from './CampusNewsCard';

export default function CampusNewsModal({ news, isOpen, onClose }) {
  if (!isOpen || !news) return null;

  const badge = getCategoryBadge(news.category);

  const handleShare = async () => {
    const shareData = {
      title: news.title,
      text: `${news.title} - Read details on CampusLink:`,
      url: news.source_url || window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${news.title}\n${news.source_url || window.location.href}`);
        alert('Story link copied to clipboard!');
      }
    } catch {
      // Ignored
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col border border-slate-200"
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs ${badge.color}`}>
                {badge.label}
              </span>
              {news.is_breaking && (
                <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                  <Flame className="w-2.5 h-2.5 fill-white" />
                  <span>Breaking</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleShare}
                className="w-8 h-8 rounded-full hover:bg-slate-200/70 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Share news"
                aria-label="Share news"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-200/70 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Story Content */}
          <div className="overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-800">
            {/* Title */}
            <h2 className="font-extrabold text-lg sm:text-xl text-slate-900 leading-snug">
              {news.title}
            </h2>

            {/* Attribution Bar */}
            <div className="flex items-center justify-between py-2 border-y border-slate-100 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Newspaper className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-slate-900">{news.source_name || 'CampusLink Desk'}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div className="flex items-center space-x-1 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatNewsTime(news.published_at || news.created_at)}</span>
              </div>
            </div>

            {/* Featured Image */}
            {news.image_url && (
              <div className="rounded-2xl overflow-hidden aspect-[16/9] w-full bg-slate-100 shadow-xs">
                <SafeImage
                  src={news.image_url}
                  alt={news.title}
                  fallbackType="general"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Summary Highlight Box */}
            <div className="p-3.5 bg-sky-50/70 rounded-2xl border border-sky-100 text-sky-950 font-medium text-xs sm:text-sm leading-relaxed">
              <span className="font-bold block text-[11px] text-sky-700 uppercase tracking-wider mb-1">
                Executive Summary
              </span>
              {news.summary}
            </div>

            {/* Full Story Content */}
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed space-y-3 whitespace-pre-line text-xs sm:text-sm">
              {news.content || news.summary}
            </div>

            {/* Official Source Action */}
            {news.source_url && (
              <div className="pt-4 border-t border-slate-100">
                <a
                  href={news.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-sm hover:from-sky-700 hover:to-indigo-700 transition-all cursor-pointer"
                >
                  <span>Read Official Release on {news.source_name || 'Source Website'}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
