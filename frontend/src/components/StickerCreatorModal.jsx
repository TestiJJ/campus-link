import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Sparkles, Image as ImageIcon, Video as VideoIcon,
  Upload, Scissors, Type, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import { uploadFile } from '../api';

export default function StickerCreatorModal({
  isOpen,
  onClose,
  onStickerCreated,
  onSendStickerDirectly
}) {
  const [activeTab, setActiveTab] = useState('photo'); // 'photo' | 'video'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Photo Sticker Customization Options
  const [stickerShape, setStickerShape] = useState('rounded'); // 'original' | 'rounded' | 'circle' | 'badge'
  const [hasWhiteBorder, setHasWhiteBorder] = useState(true);
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');

  // Video Sticker Customization Options
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(3);
  const [isPlaying, setIsPlaying] = useState(true);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // Reset state when opening or closing
  useEffect(() => {
    if (!isOpen) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl('');
      setErrorMessage('');
      setTopText('');
      setBottomText('');
      setTrimStart(0);
      setTrimEnd(3);
      setLoading(false);
    }
  }, [isOpen]);

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setErrorMessage('');
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    if (file.type.startsWith('video/')) {
      setActiveTab('video');
    } else {
      setActiveTab('photo');
    }
  };

  // Video loaded metadata
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 3;
      setVideoDuration(dur);
      setTrimStart(0);
      setTrimEnd(Math.min(dur, 4)); // Default to max 4 seconds
    }
  };

  // Video time update loop for trimming
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      if (videoRef.current.currentTime >= trimEnd || videoRef.current.currentTime < trimStart) {
        videoRef.current.currentTime = trimStart;
        if (isPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }
  };

  // Render Photo Sticker on Canvas
  const renderPhotoStickerToCanvas = () => {
    return new Promise((resolve, reject) => {
      if (!previewUrl) return reject('No preview available');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const size = 512; // Standard sticker canvas dimension
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context not available');

        ctx.clearRect(0, 0, size, size);

        // Aspect fit calculation
        const hRatio = size / img.width;
        const vRatio = size / img.height;
        const ratio = Math.min(hRatio, vRatio) * 0.88; // Leave margin for sticker border/shadow
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        const drawX = (size - drawW) / 2;
        const drawY = (size - drawH) / 2;

        ctx.save();

        // 1. Clip Shape
        if (stickerShape === 'circle') {
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, Math.min(drawW, drawH) / 2, 0, Math.PI * 2);
          ctx.closePath();
          if (hasWhiteBorder) {
            ctx.shadowColor = 'rgba(0,0,0,0.18)';
            ctx.shadowBlur = 14;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
            ctx.lineWidth = 16;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
          }
          ctx.clip();
        } else if (stickerShape === 'rounded') {
          const radius = 32;
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, drawW, drawH, radius);
          ctx.closePath();
          if (hasWhiteBorder) {
            ctx.shadowColor = 'rgba(0,0,0,0.22)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 5;
            ctx.lineWidth = 14;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
          }
          ctx.clip();
        } else if (stickerShape === 'badge') {
          const radius = 48;
          ctx.beginPath();
          ctx.roundRect(drawX + 8, drawY + 8, drawW - 16, drawH - 16, radius);
          ctx.closePath();
          if (hasWhiteBorder) {
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 6;
            ctx.lineWidth = 18;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
          }
          ctx.clip();
        }

        // Draw the image
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();

        // 2. Draw Top & Bottom Meme Text if present
        const drawMemeText = (text, yPos) => {
          if (!text || !text.trim()) return;
          const upper = text.trim().toUpperCase();
          ctx.save();
          ctx.textAlign = 'center';
          ctx.font = '900 36px Impact, "Arial Black", sans-serif';
          ctx.lineWidth = 7;
          ctx.strokeStyle = '#000000';
          ctx.fillStyle = '#FFFFFF';
          ctx.lineJoin = 'round';
          ctx.strokeText(upper, size / 2, yPos);
          ctx.fillText(upper, size / 2, yPos);
          ctx.restore();
        };

        if (topText) drawMemeText(topText, 64);
        if (bottomText) drawMemeText(bottomText, size - 36);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject('Failed to generate sticker blob');
          },
          'image/webp',
          0.92
        );
      };

      img.onerror = () => reject('Failed to load image for sticker processing');
      img.src = previewUrl;
    });
  };

  // Save Sticker (Photo or Video)
  const handleSaveSticker = async (sendImmediately = false) => {
    if (!selectedFile && !previewUrl) {
      setErrorMessage('Please select a photo or video first.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      let finalFileToUpload = selectedFile;
      let isVideoSticker = activeTab === 'video';

      if (!isVideoSticker) {
        // Generate processed WebP sticker blob
        const blob = await renderPhotoStickerToCanvas();
        finalFileToUpload = new File([blob], `sticker_${Date.now()}.webp`, { type: 'image/webp' });
      }

      // Upload sticker to server for permanent URL
      const uploadedUrl = await uploadFile(finalFileToUpload);

      const newSticker = {
        id: `sticker_${Date.now()}`,
        url: uploadedUrl,
        type: isVideoSticker ? 'video' : 'image',
        name: isVideoSticker ? 'Video Sticker' : (topText || bottomText || 'My Sticker'),
        created_at: new Date().toISOString()
      };

      // Save to localStorage vault
      try {
        const raw = localStorage.getItem('campuslink_my_stickers');
        const existing = raw ? JSON.parse(raw) : [];
        const updated = [newSticker, ...existing.filter((s) => s.url !== newSticker.url)];
        localStorage.setItem('campuslink_my_stickers', JSON.stringify(updated.slice(0, 100)));
      } catch (storageErr) {
        console.warn('Could not save sticker to local vault:', storageErr);
      }

      if (onStickerCreated) {
        onStickerCreated(newSticker);
      }

      if (sendImmediately && onSendStickerDirectly) {
        onSendStickerDirectly(newSticker);
      }

      onClose();
    } catch (err) {
      console.error('Sticker creation failed:', err);
      setErrorMessage(err?.message || 'Failed to create sticker. Please try another file.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 dark:border-slate-800 flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden z-[121]"
      >
        {/* Mobile Drag Pill */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-500/10 via-sky-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Create Custom Sticker
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Transform any photo, meme, or short video clip into a chat sticker
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 pt-3 flex items-center space-x-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('photo');
              if (selectedFile?.type.startsWith('video/')) {
                setSelectedFile(null);
                setPreviewUrl('');
              }
            }}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'photo'
                ? 'border-sky-500 text-sky-600 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo Sticker</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('video');
              if (selectedFile && !selectedFile.type.startsWith('video/')) {
                setSelectedFile(null);
                setPreviewUrl('');
              }
            }}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'video'
                ? 'border-sky-500 text-sky-600 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>Video Sticker (Loop)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={activeTab === 'video' ? 'video/mp4,video/webm,video/quicktime,image/gif' : 'image/*'}
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Sticker Preview / Upload Area */}
          {!previewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-sky-400 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-sky-50/30 flex flex-col items-center justify-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-800">
                  {activeTab === 'video' ? 'Select a short video clip or GIF' : 'Select a picture or meme photo'}
                </p>
                <p className="text-xs text-slate-400">
                  {activeTab === 'video' ? 'MP4, WebM, MOV, or GIF (max 5s)' : 'JPG, PNG, or WebP'}
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Browse Files
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Interactive Preview Canvas / Video */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-900/5 rounded-3xl border border-slate-100 relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-700 text-[11px] font-bold rounded-lg shadow-xs border border-slate-200 transition-all flex items-center space-x-1 cursor-pointer z-10"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Change File</span>
                </button>

                {activeTab === 'photo' ? (
                  <div className="relative flex items-center justify-center w-56 h-56">
                    {/* Simulated Sticker Container with Die-cut Shadow */}
                    <div
                      className={`relative overflow-hidden flex items-center justify-center transition-all ${
                        stickerShape === 'circle'
                          ? 'rounded-full'
                          : stickerShape === 'badge'
                          ? 'rounded-3xl'
                          : 'rounded-2xl'
                      } ${
                        hasWhiteBorder
                          ? 'ring-4 ring-white shadow-xl shadow-slate-900/20'
                          : 'shadow-md shadow-slate-900/10'
                      }`}
                      style={{ width: '180px', height: '180px' }}
                    >
                      <img
                        src={previewUrl}
                        alt="Sticker Preview"
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />

                      {/* Top Meme Text */}
                      {topText && (
                        <span className="absolute top-2 inset-x-2 text-center text-xs font-black uppercase text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] tracking-wider">
                          {topText}
                        </span>
                      )}

                      {/* Bottom Meme Text */}
                      {bottomText && (
                        <span className="absolute bottom-2 inset-x-2 text-center text-xs font-black uppercase text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] tracking-wider">
                          {bottomText}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center w-56 h-56">
                    <div className="relative overflow-hidden rounded-2xl ring-4 ring-white shadow-xl shadow-slate-900/20 w-44 h-44 bg-black">
                      <video
                        ref={videoRef}
                        src={previewUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={handleVideoTimeUpdate}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                <p className="text-[11px] font-medium text-slate-400 mt-2">
                  Preview as rendered in chat
                </p>
              </div>

              {/* Photo Customization Options */}
              {activeTab === 'photo' && (
                <div className="space-y-3">
                  {/* Shape Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Sticker Shape</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'rounded', label: 'Rounded' },
                        { id: 'circle', label: 'Circle' },
                        { id: 'badge', label: 'Badge' }
                      ].map((shape) => (
                        <button
                          key={shape.id}
                          type="button"
                          onClick={() => setStickerShape(shape.id)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            stickerShape === shape.id
                              ? 'bg-sky-50 border-sky-500 text-sky-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {shape.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* White Border Toggle */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800">White Sticker Outline</span>
                      <p className="text-[11px] text-slate-500">Adds classic die-cut white outline & soft drop shadow</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasWhiteBorder(!hasWhiteBorder)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        hasWhiteBorder ? 'bg-sky-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          hasWhiteBorder ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Top & Bottom Meme Captions */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Type className="w-3.5 h-3.5 text-slate-500" />
                      <span>Meme Text / Caption (Optional)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Top Text..."
                        value={topText}
                        onChange={(e) => setTopText(e.target.value)}
                        maxLength={30}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-bold uppercase"
                      />
                      <input
                        type="text"
                        placeholder="Bottom Text..."
                        value={bottomText}
                        onChange={(e) => setBottomText(e.target.value)}
                        maxLength={30}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-bold uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Video Customization Options */}
              {activeTab === 'video' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Scissors className="w-3.5 h-3.5 text-sky-600" />
                      <span>Loop Duration</span>
                    </span>
                    <span className="text-[11px] font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-md">
                      {Math.max(1, Math.round(trimEnd - trimStart))}s (Max 4s)
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Video stickers automatically loop silently in chat like WhatsApp and Telegram animated stickers.
                  </p>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span>Start: {trimStart.toFixed(1)}s</span>
                      <span>End: {trimEnd.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, videoDuration - 1)}
                      step={0.2}
                      value={trimStart}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTrimStart(val);
                        setTrimEnd(Math.min(val + 3.5, videoDuration));
                        if (videoRef.current) {
                          videoRef.current.currentTime = val;
                        }
                      }}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden Export Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Sticky Action Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={!previewUrl || loading}
              onClick={() => handleSaveSticker(false)}
              className="px-4 py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Save to Vault
            </button>
            <button
              type="button"
              disabled={!previewUrl || loading}
              onClick={() => handleSaveSticker(true)}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send Sticker</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
