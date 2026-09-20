import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Plus, Upload, Trash2, Clock, Star,
  GraduationCap, Loader2, X, AlertCircle, Check
} from 'lucide-react';
import { uploadFile } from '../api';
import StickerCreatorModal from './StickerCreatorModal';

// Built-in starter sticker pack representing campus life
const CAMPUS_DEFAULT_STICKERS = [
  {
    id: 'pack_exam_mood',
    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=256&auto=format&fit=crop&q=80',
    type: 'image',
    name: 'Exam Mood 📚'
  },
  {
    id: 'pack_night_class',
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=256&auto=format&fit=crop&q=80',
    type: 'image',
    name: 'Night Reading 🌙'
  },
  {
    id: 'pack_cafeteria',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=256&auto=format&fit=crop&q=80',
    type: 'image',
    name: 'Food Ready 🍲'
  },
  {
    id: 'pack_celebration',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=256&auto=format&fit=crop&q=80',
    type: 'image',
    name: 'Semester Done 🎉'
  },
  {
    id: 'pack_coffee_grind',
    url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=256&auto=format&fit=crop&q=80',
    type: 'image',
    name: 'Coffee Boost ☕'
  },
  {
    id: 'pack_group_study',
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=256&auto=format&fit=crop&q=80',
    type: 'image',
    name: 'Study Squad 🤝'
  }
];

export default function StickerPickerDrawer({
  isOpen,
  onClose,
  onSelectSticker
}) {
  const [activeTab, setActiveTab] = useState('my_stickers'); // 'recent' | 'my_stickers' | 'campus_pack'
  const [myStickers, setMyStickers] = useState([]);
  const [recentStickers, setRecentStickers] = useState([]);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');

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
    setImportFeedback('');

    try {
      let importedCount = 0;
      const newItems = [];

      for (const file of files) {
        try {
          const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');
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
        localStorage.setItem('campuslink_my_stickers', JSON.stringify(combined.slice(0, 150)));
        setMyStickers(combined);
        setActiveTab('my_stickers');
        setImportFeedback(`Imported ${importedCount} WhatsApp sticker(s) successfully!`);
      } else {
        setImportFeedback('Could not import selected files. Please check connection.');
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
    onClose();
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
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 inset-x-0 sm:bottom-4 sm:right-4 sm:left-auto sm:w-[420px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col h-[460px] max-h-[75vh] overflow-hidden z-50"
        >
          {/* Mobile Handle Pill */}
          <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2 sm:hidden shrink-0" />

          {/* Drawer Header & Actions */}
          <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-black text-slate-900">Sticker Studio</span>
            </div>

            <div className="flex items-center space-x-1.5">
              {/* Import from WhatsApp Button */}
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[11px] font-bold border border-emerald-200 flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
                title="Import .webp / animated stickers directly from WhatsApp"
              >
                {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                <span>{importing ? 'Importing...' : 'Import WhatsApp'}</span>
              </button>

              {/* Create Sticker Button */}
              <button
                type="button"
                onClick={() => setIsCreatorOpen(true)}
                className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                title="Create a new custom sticker from a photo or video"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Create</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Hidden WhatsApp Sticker File Input */}
          <input
            ref={importInputRef}
            type="file"
            multiple
            accept=".webp,image/webp,.png,.gif,video/mp4,video/webm"
            onChange={handleImportWhatsAppStickers}
            className="hidden"
          />

          {/* Import Feedback Banner */}
          {importFeedback && (
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-semibold border-b border-emerald-100 flex items-center justify-between shrink-0">
              <span>{importFeedback}</span>
              <button
                type="button"
                onClick={() => setImportFeedback('')}
                className="text-emerald-600 hover:text-emerald-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center px-3 border-b border-slate-100 bg-white shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('my_stickers')}
              className={`py-2 px-3 text-xs font-bold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'my_stickers'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
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
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('campus_pack')}
              className={`py-2 px-3 text-xs font-bold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'campus_pack'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Campus Pack</span>
            </button>
          </div>

          {/* Stickers Grid Display */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'my_stickers' && (
              myStickers.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
                    <Star className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-700">No custom stickers yet</p>
                    <p className="text-[11px] text-slate-400 max-w-[240px]">
                      Create stickers from your photos/videos or import saved stickers from WhatsApp.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatorOpen(true)}
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Create Sticker
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs border border-emerald-200 transition-colors cursor-pointer"
                    >
                      Import WhatsApp
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
                  {myStickers.map((sticker) => (
                    <div
                      key={sticker.id}
                      onClick={() => handlePickSticker(sticker)}
                      className="group relative aspect-square rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-100 hover:border-sky-300 p-1.5 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs"
                    >
                      {sticker.type === 'video' ? (
                        <video
                          src={sticker.url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      ) : (
                        <img
                          src={sticker.url}
                          alt={sticker.name || 'Sticker'}
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      )}

                      {/* Video indicator badge */}
                      {sticker.type === 'video' && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-[8px] text-white font-black px-1 rounded">
                          VID
                        </span>
                      )}

                      {/* Quick Delete action button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSticker(e, sticker.id)}
                        className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-600 shadow-xs items-center justify-center cursor-pointer z-10 transition-colors"
                        title="Delete sticker from my collection"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'recent' && (
              recentStickers.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
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
                      className="aspect-square rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-100 hover:border-sky-300 p-1.5 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs"
                    >
                      {sticker.type === 'video' ? (
                        <video
                          src={sticker.url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      ) : (
                        <img
                          src={sticker.url}
                          alt={sticker.name || 'Sticker'}
                          className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'campus_pack' && (
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
                {CAMPUS_DEFAULT_STICKERS.map((sticker) => (
                  <div
                    key={sticker.id}
                    onClick={() => handlePickSticker(sticker)}
                    className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-100 hover:border-sky-300 cursor-pointer transition-all hover:scale-102 active:scale-95 shadow-2xs space-y-1.5"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden shadow-xs ring-2 ring-white">
                      <img
                        src={sticker.url}
                        alt={sticker.name}
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[90px] text-center">
                      {sticker.name}
                    </span>
                  </div>
                ))}
              </div>
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
