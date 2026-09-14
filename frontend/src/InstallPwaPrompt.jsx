// src/InstallPwaPrompt.jsx
import React, { useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { usePwa } from './context/PwaContext';

export default function InstallPwaPrompt() {
  const {
    isInstalled,
    isIos,
    isAndroid,
    showIosGuide,
    setShowIosGuide,
    installApp
  } = usePwa();

  const [dismissedInstall, setDismissedInstall] = useState(
    () => sessionStorage.getItem('campuslink_pwa_dismissed') === 'true'
  );

  const handleDismissInstall = () => {
    setDismissedInstall(true);
    sessionStorage.setItem('campuslink_pwa_dismissed', 'true');
  };

  return (
    <>
      {/* FLOATING INSTALL BANNER (Shows when not installed and not dismissed) */}
      {!isInstalled && !dismissedInstall && (
        <div className="fixed bottom-18 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm md:max-w-md z-40 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white/95 backdrop-blur-md border border-sky-300 rounded-2xl p-2.5 sm:p-3 shadow-xl shadow-sky-500/15 flex items-center justify-between gap-2.5 relative">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                  <span className="truncate">Install CampusLink</span>
                  <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                    {isIos ? 'iOS' : isAndroid ? 'App' : 'Fast'}
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500 truncate mt-0.2">
                  Full-screen orders, chat & alerts
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={installApp}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Install</span>
              </button>
              <button
                type="button"
                onClick={handleDismissInstall}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
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
