import React, { useState, useMemo, useEffect } from 'react';
import {
  Globe, MapPin, Search, X, Check, Building2, GraduationCap, Sparkles
} from 'lucide-react';

export default function CampusSelectModal({
  isOpen,
  onClose,
  selectedUniversity,
  onSelectUniversity,
  universities = [],
  currentUserUniversity = null,
  title = "Select Campus / University",
  subtitle = "Filter goods, stores and services by institution"
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Lock body scroll on mobile when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Deduplicate and prepare list of universities
  const availableInstitutions = useMemo(() => {
    const map = new Map();
    (universities || []).forEach((u) => {
      if (u && (u.name || u.abbreviation)) {
        const key = String(u.id || u.name);
        if (!map.has(key)) {
          map.set(key, {
            id: u.id,
            name: u.name,
            abbreviation: u.abbreviation || u.abbr || '',
            state: u.state || '',
            type: u.type || 'University'
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [universities]);

  // Filtered by search query
  const filteredInstitutions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableInstitutions;
    const cleanQ = q.replace(/\buni\b/g, 'university').trim();
    const words = q.split(/\s+/).filter(Boolean);
    return availableInstitutions.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const abbr = (u.abbreviation || '').toLowerCase();
      const state = (u.state || '').toLowerCase();
      if (name.includes(q) || abbr.includes(q) || state.includes(q)) return true;
      if (cleanQ && name.includes(cleanQ)) return true;
      return words.every((token) => {
        const tokenNorm = token === 'uni' ? 'university' : token;
        return name.includes(tokenNorm) || abbr.includes(token) || state.includes(token);
      });
    });
  }, [availableInstitutions, searchQuery]);

  if (!isOpen) return null;

  const isAllSelected = selectedUniversity === 'all' || !selectedUniversity;
  const isMyCampusSelected = selectedUniversity === 'my_campus';

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Container: Bottom Sheet on Mobile, Centered Dialog on Desktop */}
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 sm:p-4 pb-2 border-b border-slate-100 shrink-0 bg-slate-50/70">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search school name or acronym (UNILAG, FUTO, UI)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 focus:border-sky-500 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 shadow-2xs transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2.5">
          {/* Quick Primary Actions: All Campuses & My Campus */}
          {!searchQuery && (
            <div className="space-y-2 mb-3">
              {/* Option: All Campuses */}
              <button
                type="button"
                onClick={() => {
                  onSelectUniversity('all', 'All Campuses');
                  onClose();
                }}
                className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 group active:scale-[0.99] ${
                  isAllSelected
                    ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-200 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    isAllSelected ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      All Campuses (Nigeria)
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                      Nationwide
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    Browse all listings, student services & vendor stores across Nigeria
                  </p>
                </div>
                {isAllSelected && (
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Option: My Campus (if user has a school) */}
              {(currentUserUniversity?.name || currentUserUniversity?.abbr) && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectUniversity(
                      'my_campus',
                      currentUserUniversity.abbr || currentUserUniversity.name
                    );
                    onClose();
                  }}
                  className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 group active:scale-[0.99] ${
                    isMyCampusSelected
                      ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-200 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                      isMyCampusSelected ? 'bg-sky-600 text-white shadow-xs' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                        My Campus
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center space-x-0.5 shrink-0">
                        <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                        <span>Registered</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate mt-0.5 font-medium">
                      {currentUserUniversity.abbr ? `${currentUserUniversity.abbr} · ` : ''}
                      {currentUserUniversity.name}
                    </p>
                  </div>
                  {isMyCampusSelected && (
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Section Divider */}
          <div className="flex items-center justify-between pt-1 pb-1 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {searchQuery ? `Search Results (${filteredInstitutions.length})` : 'All Institutions'}
            </span>
            {searchQuery && (
              <span className="text-[11px] text-slate-400">
                Matching "{searchQuery}"
              </span>
            )}
          </div>

          {/* Institution List Cards */}
          {filteredInstitutions.length > 0 ? (
            <div className="space-y-1.5">
              {filteredInstitutions.map((uni) => {
                const isSelected =
                  String(selectedUniversity) === String(uni.id) ||
                  selectedUniversity === uni.name ||
                  (uni.abbreviation && selectedUniversity === uni.abbreviation);

                return (
                  <button
                    key={uni.id || uni.name}
                    type="button"
                    onClick={() => {
                      onSelectUniversity(uni.id ? String(uni.id) : (uni.abbreviation || uni.name), uni.abbreviation || uni.name);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 active:scale-[0.99] ${
                      isSelected
                        ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-200 shadow-2xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* School Acronym Badge */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black text-xs transition-colors ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      <span className="leading-none text-[11px] truncate max-w-[40px] px-1 text-center">
                        {uni.abbreviation || (uni.name ? uni.name.slice(0, 3).toUpperCase() : 'UNI')}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-1">
                        {uni.name}
                      </h4>
                      <div className="flex items-center space-x-2 mt-0.5">
                        {uni.abbreviation && (
                          <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                            {uni.abbreviation}
                          </span>
                        )}
                        {uni.state && (
                          <span className="text-[10px] text-slate-400 flex items-center space-x-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            <span>{uni.state} State</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-200 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-700">
                No institution found
              </h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                No universities matched "{searchQuery}". Try typing another keyword or reset to all campuses.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
            {availableInstitutions.length} institutions available
          </span>

          {selectedUniversity !== 'all' && (
            <button
              type="button"
              onClick={() => {
                onSelectUniversity('all', 'All Campuses');
                onClose();
              }}
              className="text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
            >
              Reset to All Campuses
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
