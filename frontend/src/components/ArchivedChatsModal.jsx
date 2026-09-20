import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, ArchiveRestore, X, MessageSquare, Clock, Users, Sparkles } from 'lucide-react';
import SafeImage from './SafeImage';

export default function ArchivedChatsModal({
  isOpen,
  onClose,
  archivedConversations = [],
  onSelectChat,
  onUnarchiveChat
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col h-[85dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden"
      >
        {/* Mobile Drag Pill */}
        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  Archived Chats
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                  {archivedConversations.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                These chats stay hidden until you unarchive them
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 sm:p-3">
          {archivedConversations.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <Archive className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No archived chats</p>
                <p className="text-xs text-slate-400 max-w-[260px]">
                  Archive any 1-on-1 or group conversation to keep your active inbox clean and organized.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {archivedConversations.map((c) => {
                const pid = c.partner_id || c.user_id || c.id;
                const isGroup = Boolean(c.is_group);

                return (
                  <div
                    key={pid}
                    className="group relative flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700"
                  >
                    {/* Chat Item Button */}
                    <button
                      type="button"
                      onClick={() => onSelectChat(c)}
                      className="flex-1 min-w-0 flex items-center space-x-3 text-left cursor-pointer"
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {isGroup ? (
                          c.partner_avatar ? (
                            <img
                              src={c.partner_avatar}
                              alt={c.partner_name}
                              className="w-11 h-11 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                              <Users className="w-5 h-5" />
                            </div>
                          )
                        ) : (
                          <SafeImage
                            src={c.partner_avatar || c.avatar_url}
                            alt={c.partner_name}
                            fallbackType="avatar"
                            className="w-11 h-11 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                        )}
                        {isGroup && (
                          <span className="absolute -bottom-0.5 -right-0.5 px-1 py-0.2 rounded-md bg-sky-500 text-[8px] font-black text-white">
                            GRP
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 truncate">
                            {c.partner_name}
                          </h4>
                          {c.last_timestamp && (
                            <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                              {new Date(c.last_timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {c.last_message || 'No messages yet'}
                        </p>
                      </div>
                    </button>

                    {/* Unarchive Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnarchiveChat(pid);
                      }}
                      className="shrink-0 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/60 dark:hover:text-sky-400 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                      title="Unarchive and return to active chats"
                    >
                      <ArchiveRestore className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span className="hidden sm:inline">Unarchive</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
