// src/components/InstallAppButton.jsx
import React from 'react';
import { Download, Smartphone, Check } from 'lucide-react';
import { usePwa } from '../context/PwaContext';

export default function InstallAppButton({
  variant = 'header', // 'header' | 'settings' | 'compact' | 'pill'
  className = '',
  showInstalled = false,
  customLabel = null
}) {
  const {
    isInstalled,
    isIos,
    isAndroid,
    installApp
  } = usePwa();

  // APP NOT YET INSTALLED (Android, iPhone, Desktop)
  if (!isInstalled) {
    if (variant === 'settings') {
      return (
        <div className={`p-4 sm:p-5 rounded-2xl bg-sky-50/80 border border-sky-200 ${className}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Install CampusLink on {isIos ? 'iPhone / iPad' : isAndroid ? 'Android' : 'Your Device'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold">
                    PWA
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Get full-screen speed, instant background alerts, and one-tap access from your home screen.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={installApp}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center space-x-2 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Install CampusLink App</span>
            </button>
          </div>
        </div>
      );
    }

    // Header / Compact / Pill Variant
    return (
      <button
        type="button"
        onClick={installApp}
        title={isIos ? 'Install on iPhone / iPad' : isAndroid ? 'Install on Android' : 'Install CampusLink App'}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-sky-50 hover:bg-sky-100/80 text-sky-700 border border-sky-200 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0 ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        <span className="truncate">
          {customLabel || (
            <>
              <span className="hidden min-[380px]:inline">Install </span>App
            </>
          )}
        </span>
      </button>
    );
  }

  // 3. APP ALREADY INSTALLED & UP TO DATE
  if (showInstalled) {
    if (variant === 'settings') {
      return (
        <div className={`p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center space-x-2.5 text-xs text-emerald-800 ${className}`}>
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-900 block">CampusLink App Installed</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Running progressive web application.</p>
          </div>
        </div>
      );
    }

    return (
      <span className={`inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 ${className}`}>
        <Check className="w-3 h-3" />
        <span>Installed</span>
      </span>
    );
  }

  return null;
}
