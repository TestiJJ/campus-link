import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Plus, Upload, Trash2, Clock, Star,
  GraduationCap, Loader2, X, AlertCircle, Check,
  FolderOpen, Clipboard, HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { uploadFile, getMediaUrl } from '../api';
import StickerCreatorModal from './StickerCreatorModal';

// Helper to generate crisp, vibrant vector die-cut campus reaction stickers
const makeStickerSvg = (emoji, label, bg1, bg2) => {
  const safeId = label.replace(/[^a-zA-Z0-9]/g, '_');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="g_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
      <filter id="s_${safeId}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="rgba(0,0,0,0.25)"/>
      </filter>
    </defs>
    <rect x="14" y="14" width="172" height="172" rx="36" fill="#ffffff" filter="url(#s_${safeId})"/>
    <rect x="20" y="20" width="160" height="160" rx="30" fill="url(#g_${safeId})"/>
    <text x="100" y="98" font-size="60" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    <rect x="28" y="138" width="144" height="28" rx="14" fill="#ffffff" fill-opacity="0.95"/>
    <text x="100" y="156" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle" dominant-baseline="central">${label.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Built-in starter sticker pack representing hilarious campus life & reactions
const CAMPUS_DEFAULT_STICKERS = [
  {
    id: 'pack_sapa',
    url: makeStickerSvg('💸', 'Sapa Is Real', '#f59e0b', '#d97706'),
    type: 'image',
    name: 'Sapa Is Real 💸'
  },
  {
    id: 'pack_god_abeg',
    url: makeStickerSvg('🙏', 'God Abeg', '#06b6d4', '#0284c7'),
    type: 'image',
    name: 'God Abeg 🙏'
  },
  {
    id: 'pack_no_gree',
    url: makeStickerSvg('🛑', 'No Gree', '#ef4444', '#b91c1c'),
    type: 'image',
    name: 'No Gree 🛑'
  },
  {
    id: 'pack_wahala',
    url: makeStickerSvg('🚨', 'Wahala Dey', '#f97316', '#c2410c'),
    type: 'image',
    name: 'Wahala Dey 🚨'
  },
  {
    id: 'pack_senior_man',
    url: makeStickerSvg('👑', 'Senior Man', '#8b5cf6', '#6d28d9'),
    type: 'image',
    name: 'Senior Man 👑'
  },
  {
    id: 'pack_exam_shock',
    url: makeStickerSvg('😱', 'Exam Shock', '#ec4899', '#be185d'),
    type: 'image',
    name: 'Exam Shock 😱'
  },
  {
    id: 'pack_tdb',
    url: makeStickerSvg('🌙', 'TDB Reading', '#3b82f6', '#1d4ed8'),
    type: 'image',
    name: 'TDB Reading 🌙'
  },
  {
    id: 'pack_food_ready',
    url: makeStickerSvg('🍲', 'Food Don Done', '#10b981', '#047857'),
    type: 'image',
    name: 'Food Ready 🍲'
  },
  {
    id: 'pack_lit',
    url: makeStickerSvg('🔥', 'Lit Vibes', '#f43f5e', '#e11d48'),
    type: 'image',
    name: 'Lit Vibes 🔥'
  },
  {
    id: 'pack_valid',
    url: makeStickerSvg('💯', '100% Valid', '#14b8a6', '#0f766e'),
    type: 'image',
    name: '100% Valid 💯'
  },
  {
    id: 'pack_shege',
    url: makeStickerSvg('💀', 'Shege Banza', '#64748b', '#334155'),
    type: 'image',
    name: 'Shege Banza 💀'
  },
  {
    id: 'pack_distinction',
    url: makeStickerSvg('🎓', 'A+ Scholar', '#6366f1', '#4338ca'),
    type: 'image',
    name: 'A+ Scholar 🎓'
  }
];

export default function StickerPickerDrawer({
  isOpen,
  onClose,
  onSelectSticker
}) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('campuslink_my_stickers') || '[]');
      return saved.length > 0 ? 'my_stickers' : 'campus_pack';
    } catch {
      return 'campus_pack';
    }
  });

  const [myStickers, setMyStickers] = useState([]);
  const [recentStickers, setRecentStickers] = useState([]);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');
  const [showFolderHelp, setShowFolderHelp] = useState(false);

  const importInputRef = useRef(null);

  // Load custom stickers from localStorage
  const loadVaultStickers = () => {
    try {
      const rawMy = localStorage.getItem('campuslink_my_stickers');
      if (rawMy) {
        setMyStickers(JSON.parse(rawMy) || []);
      }
      const rawRecent = localStorage.getItem('campuslink_recent_stickers');
      if (rawRecent) {
        setRecentStickers(JSON.parse(rawRecent) || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      loadVaultStickers();
      setImportFeedback('');
    }
  }, [isOpen]);

  // Handle Importing WhatsApp Stickers (.webp, .png, .gif, .mp4)
  const handleImportWhatsAppStickers = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setImporting(true);
    setImportFeedback(`Uploading ${files.length} sticker(s)...`);

    try {
      let importedCount = 0;
      const newItems = [];

      for (const file of files) {
        try {
          const isVideo = file.type?.startsWith('video/') || file.name?.endsWith('.mp4') || file.name?.endsWith('.webm');
          const uploadedUrl = await uploadFile(file);

          newItems.push({
            id: `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            url: uploadedUrl,
            type: isVideo ? 'video' : 'image',
            name: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || 'WhatsApp Sticker',
            created_at: new Date().toISOString()
          });
          importedCount++;
        } catch (uploadErr) {
          console.warn('Failed to upload sticker file:', file.name, uploadErr);
        }
      }

      if (newItems.length > 0) {
        const raw = localStorage.getItem('campuslink_my_stickers');
        const existing = raw ? JSON.parse(raw) : [];
        const combined = [...newItems, ...existing];
        localStorage.setItem('campuslink_my_stickers', JSON.stringify(combined.slice(0, 200)));
        setMyStickers(combined);
        setActiveTab('my_stickers');
        setImportFeedback(`🎉 Imported ${importedCount} sticker(s) to your collection!`);
      } else {
        setImportFeedback('Could not import selected files. Please check network connection.');
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportFeedback('Sticker import encountered an error.');
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  // Direct Clipboard Paste for WhatsApp Stickers / Images
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        setImportFeedback('Clipboard image reading not supported on this browser. Use Import button.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          setImporting(true);
          setImportFeedback('Processing clipboard sticker...');
          const blob = await item.getType(imageType);
          const ext = imageType.includes('webp') ? 'webp' : 'png';
          const file = new File([blob], `pasted_sticker_${Date.now()}.${ext}`, { type: imageType });
          const uploadedUrl = await uploadFile(file);
          const newStk = {
            id: `pasted_${Date.now()}`,
            url: uploadedUrl,
            type: 'image',
            name: 'Pasted Sticker',
            created_at: new Date().toISOString()
          };
          const raw = localStorage.getItem('campuslink_my_stickers');
          const existing = raw ? JSON.parse(raw) : [];
          const updated = [newStk, ...existing];
          localStorage.setItem('campuslink_my_stickers', JSON.stringify(updated.slice(0, 200)));
          setMyStickers(updated);
          setActiveTab('my_stickers');
          setImportFeedback('Pasted sticker imported successfully! ✨');
          setImporting(false);
          return;
        }
      }
      setImportFeedback('No sticker or image found in your clipboard. Copy a sticker from WhatsApp first!');
    } catch (err) {
      console.warn('Clipboard paste error:', err);
      setImportFeedback('Could not read clipboard. Please tap "Import WhatsApp" button to select files.');
      setImporting(false);
    }
  };

  // Dispatch sticker selection and update Recents
  const handlePickSticker = (sticker) => {
    try {
      const rawRecent = localStorage.getItem('campuslink_recent_stickers');
      const existingRecent = rawRecent ? JSON.parse(rawRecent) : [];
      const updatedRecent = [sticker, ...existingRecent.filter((s) => s.url !== sticker.url)].slice(0, 24);
      localStorage.setItem('campuslink_recent_stickers', JSON.stringify(updatedRecent));
      setRecentStickers(updatedRecent);
    } catch (_) {}

    if (onSelectSticker) {
      onSelectSticker(sticker);
    }
    if (onClose) {
      onClose();
    }
  };

  // Delete Custom Sticker from Vault
  const handleDeleteSticker = (e, stickerId) => {
    e.stopPropagation();
    try {
      const filtered = myStickers.filter((s) => s.id !== stickerId);
      localStorage.setItem('campuslink_my_stickers', JSON.stringify(filtered));
      setMyStickers(filtered);
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <>
      {/* High z-index [100] so it ALWAYS displays cleanly above full-screen mobile chat (z-50) */}
      <div
        className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-xs flex flex-col justify-end sm:justify-end animate-in fade-in duration-150"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-[440px] sm:ml-auto sm:mr-4 sm:mb-4 bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col h-[520px] max-h-[85vh] overflow-hidden z-[101] safe-nav-bottom"
        >
          {/* Mobile Handle Pill */}
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />

          {/* Drawer Header & Actions */}
          <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-800/60">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">Sticker Studio</span>
            </div>

            <div className="flex items-center space-x-1.5">
              {/* Import from WhatsApp Button */}
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
                title="Import .webp stickers from WhatsApp folder"
              >
                {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                <span>{importing ? 'Importing...' : 'Import WhatsApp'}</span>
              </button>

              {/* Create Sticker Button */}
              <button
                type="button"
                onClick={() => setIsCreatorOpen(true)}
                className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                title="Create a new custom sticker from photo or video"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Create</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Hidden WhatsApp Sticker File Input - Accepts .webp, images, videos */}
          <input
            ref={importInputRef}
            type="file"
            multiple
            accept=".webp,image/webp,application/octet-stream,image/*,video/*"
            onChange={handleImportWhatsAppStickers}
            className="hidden"
          />

          {/* Quick Helper Bar: WhatsApp Directory Tip & Clipboard Paste */}
          <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => setShowFolderHelp((prev) => !prev)}
              className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center space-x-1 hover:underline cursor-pointer"
            >
              <FolderOpen className="w-3 h-3" />
              <span>Where are WhatsApp stickers?</span>
              {showFolderHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="text-slate-600 dark:text-slate-300 hover:text-sky-600 font-bold flex items-center space-x-1 cursor-pointer"
              title="Paste copied sticker from clipboard"
            >
              <Clipboard className="w-3 h-3" />
              <span>Paste Sticker</span>
            </button>
          </div>

          {/* Expandable Folder Guide */}
          <AnimatePresence>
            {showFolderHelp && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 px-3.5 py-2 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1 shrink-0"
              >
                <p className="font-bold">📱 How to import all your WhatsApp stickers:</p>
                <p className="text-[10.5px] leading-relaxed opacity-90">
                  When you tap <strong>"Import WhatsApp"</strong>, choose <strong>Files / Documents</strong>, then go to:
                </p>
                <p className="font-mono text-[10px] bg-white/70 dark:bg-black/40 p-1 rounded-md border border-emerald-300 dark:border-emerald-700 select-all">
                  Internal Storage ➔ Android ➔ media ➔ com.whatsapp ➔ WhatsApp ➔ Media ➔ WhatsApp Stickers
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Select any or all <span className="font-bold">.webp</span> files — they will all be imported directly into CampusLink!
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import Feedback Banner */}
          {importFeedback && (
            <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-[11px] font-semibold border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between shrink-0">
              <span className="truncate">{importFeedback}</span>
              <button
                type="button"
                onClick={() => setImportFeedback('')}
                className="text-emerald-600 hover:text-emerald-900 ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center px-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('campus_pack')}
              className={`py-2 px-3 text-xs font-bold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'campus_pack'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Campus Reactions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my_stickers')}
              className={`py-2 px-3 text-xs font-bold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'my_stickers'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>My Stickers ({myStickers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recent')}
              className={`py-2 px-3 text-xs font-bold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'recent'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent</span>
            </button>
          </div>

          {/* Stickers Grid Display */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Campus Reactions Pack Tab */}
            {activeTab === 'campus_pack' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {CAMPUS_DEFAULT_STICKERS.map((sticker) => (
                  <div
                    key={sticker.id}
                    onClick={() => handlePickSticker(sticker)}
                    className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-sky-50/70 dark:hover:bg-sky-900/30 border border-slate-100 dark:border-slate-700/60 hover:border-sky-300 dark:hover:border-sky-500 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs group"
                  >
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center">
                      <img
                        src={sticker.url}
                        alt={sticker.name}
                        className="w-full h-full object-contain select-none pointer-events-none drop-shadow-sm"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px] text-center mt-1">
                      {sticker.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* My Stickers (Custom & Imported) Tab */}
            {activeTab === 'my_stickers' && (
              myStickers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-500 flex items-center justify-center">
                    <Star className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-700 dark:text-slate-200">No custom stickers yet</p>
                    <p className="text-[11px] text-slate-400 max-w-[240px]">
                      Import WhatsApp stickers (.webp) or create custom meme stickers from photos/videos!
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      Import WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatorOpen(true)}
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      Create Sticker
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
                  {myStickers.map((sticker) => (
                    <div
                      key={sticker.id}
                      onClick={() => handlePickSticker(sticker)}
                      className="group relative aspect-square rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-sky-50/60 dark:hover:bg-sky-900/30 border border-slate-100 dark:border-slate-700/60 hover:border-sky-300 p-1.5 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs"
                    >
                      {sticker.type === 'video' || sticker.url?.endsWith('.mp4') || sticker.url?.endsWith('.webm') ? (
                        <video
                          src={getMediaUrl(sticker.url)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      ) : (
                        <img
                          src={getMediaUrl(sticker.url)}
                          alt={sticker.name || 'Sticker'}
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      )}

                      {/* Video indicator badge */}
                      {(sticker.type === 'video' || sticker.url?.endsWith('.mp4') || sticker.url?.endsWith('.webm')) && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-[8px] text-white font-black px-1 rounded">
                          VID
                        </span>
                      )}

                      {/* Quick Delete action button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSticker(e, sticker.id)}
                        className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-rose-600 shadow-xs items-center justify-center cursor-pointer z-10 transition-colors"
                        title="Delete sticker from my collection"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Recents Tab */}
            {activeTab === 'recent' && (
              recentStickers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-300" />
                  <span className="font-medium text-slate-500">No recently sent stickers</span>
                  <span className="text-[11px] text-slate-400">Stickers you send will appear here for fast access.</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
                  {recentStickers.map((sticker) => (
                    <div
                      key={sticker.id}
                      onClick={() => handlePickSticker(sticker)}
                      className="aspect-square rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-sky-50/60 dark:hover:bg-sky-900/30 border border-slate-100 dark:border-slate-700/60 hover:border-sky-300 p-1.5 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs"
                    >
                      {sticker.type === 'video' || sticker.url?.endsWith('.mp4') || sticker.url?.endsWith('.webm') ? (
                        <video
                          src={getMediaUrl(sticker.url)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      ) : (
                        <img
                          src={getMediaUrl(sticker.url)}
                          alt={sticker.name || 'Sticker'}
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      {/* Embedded Sticker Creator Modal */}
      <StickerCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onStickerCreated={(newSticker) => {
          loadVaultStickers();
        }}
        onSendStickerDirectly={(newSticker) => {
          handlePickSticker(newSticker);
        }}
      />
    </>
  );
}
