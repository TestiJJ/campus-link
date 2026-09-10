// src/components/InstallAppButton.jsx
import React from 'react';
import { Download, Sparkles, RefreshCw, Smartphone, Check, ArrowUpCircle } from 'lucide-react';
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
    updateNeeded,
    isUpdating,
    latestVersion,
    installApp,
    applyUpdate
  } = usePwa();

  // 1. UPDATE NEEDED: Highlighted everywhere with top priority
  if (updateNeeded) {
    if (variant === 'settings') {
      return (
        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-emerald-500/15 border-2 border-amber-400 shadow-sm ${className}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30">
                <Sparkles className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                    Update Needed
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wide animate-pulse">
                    v{latestVersion} READY
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  A fresh update with new features and fixes is ready. Tap below to apply it immediately.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={applyUpdate}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black rounded-xl shadow-md shadow-orange-500/25 transition-all active:scale-95 flex items-center justify-center space-x-2 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Applying Update...' : 'Update CampusLink Now'}</span>
            </button>
          </div>
        </div>
      );
    }

    // Header / Compact / Pill Variant
    return (
      <button
        type="button"
        onClick={applyUpdate}
        disabled={isUpdating}
        title="New update needed! Click to apply immediately"
        className={`relative inline-flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/30 transition-all active:scale-95 cursor-pointer shrink-0 border border-amber-300 animate-pulse ${className}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
        <span className="truncate">
          {isUpdating ? 'Updating...' : customLabel || 'Update Needed'}
        </span>
      </button>
    );
  }

  // 2. APP NOT YET INSTALLED (Android, iPhone, Desktop)
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
        <div className={`p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 ${className}`}>
          <div className="flex items-center space-x-2.5">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">CampusLink App is installed & up to date (v{latestVersion})</span>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
            Latest
          </span>
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
