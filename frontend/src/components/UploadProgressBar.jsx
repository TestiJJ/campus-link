import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Video, 
  ShoppingBag, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  X, 
  Loader2 
} from 'lucide-react';
import { useUpload } from '../context/UploadContext';

export default function UploadProgressBar() {
  const { tasks, retryTask, dismissTask } = useUpload();

  if (!tasks || tasks.length === 0) return null;

  return (
    <aside 
      aria-label="Upload status notifications"
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[94%] max-w-md pointer-events-none flex flex-col space-y-2"
    >
      <AnimatePresence>
        {tasks.map((task) => {
          const isSuccess = task.status === 'success';
          const isError = task.status === 'error';
          const isProcessing = task.status === 'processing';
          const isUploading = task.status === 'uploading';

          return (
            <motion.div
              key={task.id}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-2xl p-3 text-white flex items-center space-x-3"
            >
              {/* Media Thumbnail or Icon */}
              <div className="relative shrink-0">
                {task.preview ? (
                  <img
                    src={task.preview}
                    alt="Upload thumbnail"
                    className="w-11 h-11 rounded-xl object-cover border border-white/10 ring-2 ring-emerald-500/30"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-slate-300">
                    {task.type === 'story' && <Camera className="w-5 h-5 text-emerald-400" />}
                    {task.type === 'drop' && <Video className="w-5 h-5 text-teal-400" />}
                    {task.type === 'product' && <ShoppingBag className="w-5 h-5 text-amber-400" />}
                    {!['story', 'drop', 'product'].includes(task.type) && (
                      <UploadCloud className="w-5 h-5 text-cyan-400" />
                    )}
                  </div>
                )}

                {/* Status Badge overlay */}
                {isSuccess && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                )}
                {isError && (
                  <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 shadow-sm">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Text & Progress bar */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-100 truncate">
                    {task.title || 'Sharing to campus...'}
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-400 ml-2 shrink-0">
                    {isSuccess && <span className="text-emerald-400 font-bold">Done</span>}
                    {isError && <span className="text-rose-400 font-bold">Failed</span>}
                    {isProcessing && <span className="text-teal-300 animate-pulse">Finalizing...</span>}
                    {isUploading && `${task.progress || 0}%`}
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                  <motion.div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSuccess
                        ? 'bg-emerald-400'
                        : isError
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
                    }`}
                    initial={{ width: '5%' }}
                    animate={{ width: `${task.progress || 5}%` }}
                  />
                </div>

                {/* Helpful status subtitle */}
                <div className="mt-1 text-[10px] text-slate-400 truncate">
                  {isSuccess && 'Visible to your campus circle now.'}
                  {isError && (task.error || 'Check network connection.')}
                  {isProcessing && 'Saving details on campus servers...'}
                  {isUploading && 'Posting in background — feel free to keep browsing.'}
                </div>
              </div>

              {/* Action buttons */}
              <div className="shrink-0 flex items-center space-x-1">
                {isUploading && (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                )}

                {isError && (
                  <>
                    <button
                      type="button"
                      onClick={() => retryTask(task.id)}
                      className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all active:scale-95"
                      title="Retry upload"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissTask(task.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {isSuccess && (
                  <button
                    type="button"
                    onClick={() => dismissTask(task.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-all"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </aside>
  );
}
