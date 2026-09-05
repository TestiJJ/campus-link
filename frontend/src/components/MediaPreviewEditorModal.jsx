// src/components/MediaPreviewEditorModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RotateCw, Crop, Sliders, Send, Image as ImageIcon,
  Film, Sparkles, Check, RefreshCcw, Type, Eye
} from 'lucide-react';

const FILTERS = [
  { id: 'normal', name: 'Normal', css: 'none', filterStyle: {} },
  { id: 'vivid', name: 'Vivid', css: 'contrast(1.15) saturate(1.25) brightness(1.05)', filterStyle: { filter: 'contrast(1.15) saturate(1.25) brightness(1.05)' } },
  { id: 'warm', name: 'Warm', css: 'sepia(0.25) contrast(1.1) saturate(1.15)', filterStyle: { filter: 'sepia(0.25) contrast(1.1) saturate(1.15)' } },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(185deg) contrast(1.1) saturate(1.1)', filterStyle: { filter: 'hue-rotate(185deg) contrast(1.1) saturate(1.1)' } },
  { id: 'bw', name: 'B&W', css: 'grayscale(1) contrast(1.2)', filterStyle: { filter: 'grayscale(1) contrast(1.2)' } },
];

const ASPECT_RATIOS = [
  { id: 'free', name: 'Original', ratio: null },
  { id: '1:1', name: '1:1 Square', ratio: 1 },
  { id: '4:5', name: '4:5 Portrait', ratio: 4 / 5 },
  { id: '16:9', name: '16:9 Wide', ratio: 16 / 9 },
];

export default function MediaPreviewEditorModal({
  isOpen,
  file,
  onClose,
  onConfirm,
  title = 'Preview & Edit Media',
  confirmLabel = 'Send'
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [selectedRatio, setSelectedRatio] = useState('free');
  const [caption, setCaption] = useState('');
  const [activeTab, setActiveTab] = useState('adjust'); // 'adjust' | 'filters' | 'crop'
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const isVid = file.type?.startsWith('video');
    setIsVideo(isVid);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Reset state on new file
    setRotation(0);
    setSelectedFilter('normal');
    setSelectedRatio('free');
    setCaption('');
    setActiveTab('adjust');

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!isOpen || !file) return null;

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setRotation(0);
    setSelectedFilter('normal');
    setSelectedRatio('free');
    setCaption('');
  };

  const handleConfirmAndProcess = async () => {
    if (isVideo) {
      onConfirm(file, caption.trim());
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      // Export canvas with rotations, filters and crop
      const image = imgRef.current;
      if (!image) {
        onConfirm(file, caption.trim());
        onClose();
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const isRotatedSideways = rotation === 90 || rotation === 270;
      let srcWidth = image.naturalWidth || image.width;
      let srcHeight = image.naturalHeight || image.height;

      // Calculate crop bounds if aspect ratio chosen
      const targetRatioObj = ASPECT_RATIOS.find(r => r.id === selectedRatio);
      let cropX = 0;
      let cropY = 0;
      let cropW = srcWidth;
      let cropH = srcHeight;

      if (targetRatioObj && targetRatioObj.ratio) {
        const desiredRatio = targetRatioObj.ratio;
        const currentRatio = srcWidth / srcHeight;

        if (currentRatio > desiredRatio) {
          // Wider than target ratio -> crop width
          cropW = srcHeight * desiredRatio;
          cropX = (srcWidth - cropW) / 2;
        } else {
          // Taller than target ratio -> crop height
          cropH = srcWidth / desiredRatio;
          cropY = (srcHeight - cropH) / 2;
        }
      }

      // Canvas dimensions based on rotation
      if (isRotatedSideways) {
        canvas.width = cropH;
        canvas.height = cropW;
      } else {
        canvas.width = cropW;
        canvas.height = cropH;
      }

      // Apply CSS filter on Canvas
      const filterObj = FILTERS.find(f => f.id === selectedFilter);
      if (filterObj && filterObj.css && filterObj.css !== 'none') {
        ctx.filter = filterObj.css;
      }

      // Rotate canvas center
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Draw image
      ctx.drawImage(
        image,
        cropX, cropY, cropW, cropH,
        isRotatedSideways ? -cropH / 2 : -cropW / 2,
        isRotatedSideways ? -cropW / 2 : -cropH / 2,
        isRotatedSideways ? cropH : cropW,
        isRotatedSideways ? cropW : cropH
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            onConfirm(file, caption.trim());
          } else {
            const editedFile = new File([blob], file.name || 'edited_image.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            onConfirm(editedFile, caption.trim());
          }
          setIsProcessing(false);
          onClose();
        },
        'image/jpeg',
        0.88
      );
    } catch (err) {
      console.error('Failed to process image:', err);
      onConfirm(file, caption.trim());
      setIsProcessing(false);
      onClose();
    }
  };

  const currentFilterObj = FILTERS.find(f => f.id === selectedFilter);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400">
                {isVideo ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              </span>
              <h3 className="text-sm font-bold tracking-tight">{title}</h3>
            </div>
            <div className="flex items-center space-x-2">
              {!isVideo && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1 text-slate-400 hover:text-white text-xs font-semibold hover:bg-slate-800 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Reset edits"
                >
                  <RefreshCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Viewport */}
          <div className="relative flex-1 bg-slate-950 flex items-center justify-center p-4 min-h-[260px] max-h-[380px] overflow-hidden">
            {isVideo ? (
              <video
                src={previewUrl}
                controls
                className="max-h-[360px] w-full object-contain rounded-xl"
              />
            ) : (
              <div
                className="relative flex items-center justify-center max-w-full max-h-full transition-transform duration-300"
                style={{
                  aspectRatio: selectedRatio === '1:1' ? '1/1' : selectedRatio === '4:5' ? '4/5' : selectedRatio === '16:9' ? '16/9' : 'auto'
                }}
              >
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[340px] max-w-full object-contain rounded-xl transition-all duration-300 shadow-lg"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    filter: currentFilterObj?.css !== 'none' ? currentFilterObj?.css : undefined
                  }}
                />
              </div>
            )}
          </div>

          {/* Editing Tools Bar (Images only) */}
          {!isVideo && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 shrink-0">
              <div className="flex items-center justify-center space-x-3 mb-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('adjust')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    activeTab === 'adjust' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('filters')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    activeTab === 'filters' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('crop')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    activeTab === 'crop' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>Aspect Ratio</span>
                </button>
              </div>

              {/* Sub-toolbar Controls */}
              <div className="flex items-center justify-center gap-2 py-1 min-h-[38px]">
                {activeTab === 'adjust' && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 90° ({rotation}°)</span>
                    </button>
                  </div>
                )}

                {activeTab === 'filters' && (
                  <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-full">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFilter(f.id)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          selectedFilter === f.id
                            ? 'bg-sky-500 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'crop' && (
                  <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-full">
                    {ASPECT_RATIOS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRatio(r.id)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          selectedRatio === r.id
                            ? 'bg-sky-500 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Caption Input & Action Footer */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Add a caption or note (optional)..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmAndProcess();
                  }
                }}
                className="w-full p-2.5 px-3.5 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmAndProcess}
                className="flex-1 max-w-[200px] px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{confirmLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
