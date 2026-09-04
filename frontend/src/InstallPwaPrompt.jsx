// src/InstallPwaPrompt.jsx
import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if app is already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice);

    // 3. Listen for Android / Desktop beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = sessionStorage.getItem('campuslink_pwa_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 4. App installed callback
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      console.log('CampusLink PWA installed successfully!');
    });

    // For iOS, show after brief initial visit if not dismissed
    if (isAppleDevice && !sessionStorage.getItem('campuslink_pwa_dismissed')) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Browser didn't provide prompt event yet; notify user
      alert('To install CampusLink on your phone, open your browser menu (⋮ or Share) and tap "Install app" or "Add to Home Screen".');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('campuslink_pwa_dismissed', 'true');
  };

  if (isInstalled || !showBanner) return null;

  return (
    <>
      {/* Floating Bottom / Top Install Banner */}
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="bg-white border-2 border-blue-500 rounded-3xl p-4 shadow-2xl shadow-blue-500/20 flex items-center justify-between gap-3 relative">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Install CampusLink App</span>
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">Fast</span>
              </h4>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Instant orders, messages & full-screen phone access.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center relative">
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Share className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900">Install on Your iPhone / iPad</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Apple Safari allows you to install CampusLink as a native app in just two quick taps:
            </p>

            <div className="text-left space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-700">
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Tap the <strong>Share</strong> button (<Share className="w-3.5 h-3.5 inline text-blue-600" />) at the bottom of Safari.</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-blue-600" />).</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner. Done!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIosModal(false);
                handleDismiss();
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
