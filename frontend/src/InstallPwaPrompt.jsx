// src/InstallPwaPrompt.jsx
import React, { useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Sparkles, RefreshCw } from 'lucide-react';
import { usePwa } from './context/PwaContext';

export default function InstallPwaPrompt() {
  const {
    isInstalled,
    isIos,
    isAndroid,
    updateNeeded,
    isUpdating,
    latestVersion,
    showIosGuide,
    setShowIosGuide,
    installApp,
    applyUpdate
  } = usePwa();

  const [dismissedInstall, setDismissedInstall] = useState(
    () => sessionStorage.getItem('campuslink_pwa_dismissed') === 'true'
  );
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const handleDismissInstall = () => {
    setDismissedInstall(true);
    sessionStorage.setItem('campuslink_pwa_dismissed', 'true');
  };

  return (
    <>
      {/* 1. PRIORITY FLOATING UPDATE BANNER (Shows when updateNeeded is true) */}
      {updateNeeded && !dismissedUpdate && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl p-4 shadow-2xl shadow-orange-500/30 flex items-center justify-between gap-3 border-2 border-amber-300">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <h4 className="text-xs font-black tracking-tight text-white uppercase">
                    Update Needed
                  </h4>
                  <span className="text-[9px] bg-white text-orange-600 px-1.5 py-0.2 rounded-full font-black">
                    v{latestVersion}
                  </span>
                </div>
                <p className="text-[11px] text-amber-100 truncate mt-0.5 font-medium">
                  Click to update CampusLink immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={applyUpdate}
                disabled={isUpdating}
                className="px-3.5 py-2 bg-white hover:bg-amber-50 text-orange-700 text-xs font-black rounded-xl shadow-sm transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? 'Updating...' : 'Update Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedUpdate(true)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FLOATING INSTALL BANNER (Shows when not installed and not dismissed) */}
      {!isInstalled && !updateNeeded && !dismissedInstall && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white border-2 border-sky-500 rounded-3xl p-4 shadow-2xl shadow-sky-500/20 flex items-center justify-between gap-3 relative">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/30">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Install CampusLink App</span>
                  <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">
                    {isIos ? 'iOS' : isAndroid ? 'Android' : 'Fast'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  Instant orders, messages & full-screen phone access.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={installApp}
                className="px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                type="button"
                onClick={handleDismissInstall}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. iOS SAFARI INSTRUCTIONS MODAL SHEET */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto shadow-inner">
              <Share className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900">Install on Your iPhone / iPad</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Apple Safari lets you install CampusLink as a native app on your home screen in 3 quick taps:
            </p>

            <div className="text-left space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-700">
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Tap the <strong>Share</strong> button (<Share className="w-3.5 h-3.5 inline text-sky-600" />) at the bottom of Safari.</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-sky-600" />).</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner. Done!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
