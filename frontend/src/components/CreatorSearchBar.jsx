import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, Store, GraduationCap, Loader2, ArrowRight } from 'lucide-react';
import API from '../api';
import SafeImage from './SafeImage';
import VerifiedBadge, { isAppCreator } from './VerifiedBadge';

export default function CreatorSearchBar({
  onSelectUser,
  placeholder = 'Search creators, students & campus vendors...',
  className = ''
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await API.get(`/students?search=${encodeURIComponent(q)}&role=all`);
        setResults(res.data || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Failed to search creators/users:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelect = (user) => {
    setIsOpen(false);
    setSearchQuery('');
    if (onSelectUser) {
      onSelectUser(user);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
        <div className="pl-3.5 pr-2 text-slate-400 flex items-center justify-center shrink-0">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim().length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full py-2.5 pr-8 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 bg-transparent outline-hidden font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Instant Dropdown Search Results */}
      {isOpen && searchQuery.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Creators & Campus Members</span>
            <span>{results.length} found</span>
          </div>

          {isLoading && results.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <Loader2 className="w-5 h-5 text-sky-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Searching creators and campus members...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <Users className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No results found</p>
              <p className="text-[11px] text-slate-400">
                No students or vendors matched "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((u) => {
                const isCreator = isAppCreator({
                  name: u.full_name,
                  email: u.email,
                  id: u.user_id || u.id
                });
                const isVendor = u.role === 'vendor' || u.is_seller;

                return (
                  <div
                    key={u.user_id || u.id}
                    onClick={() => handleSelect(u)}
                    className="p-3 hover:bg-sky-50/60 transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-600 text-xs border border-slate-200">
                        {u.profile_picture_url ? (
                          <SafeImage
                            src={u.profile_picture_url}
                            alt={u.full_name}
                            fallbackType="avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (u.full_name || 'U').charAt(0)
                        )}
                      </div>

                      {/* Name & Academic / Store Info */}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                            {u.full_name}
                          </span>
                          {isCreator && <VerifiedBadge size="xs" />}
                          {isVendor ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center space-x-0.5">
                              <Store className="w-2.5 h-2.5" />
                              <span>Vendor</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center space-x-0.5">
                              <GraduationCap className="w-2.5 h-2.5" />
                              <span>Student</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {u.business_name ? `Store: ${u.business_name} • ` : ''}
                          {u.department ? `${u.department} • ` : ''}
                          {u.university_name || 'Campus University'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      <span className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-sky-500 group-hover:text-white text-slate-400 flex items-center justify-center transition-all">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
