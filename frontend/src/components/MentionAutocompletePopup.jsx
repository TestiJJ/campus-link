import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AtSign, Shield, Crown, Users, BellRing } from 'lucide-react';
import SafeImage from './SafeImage';

export default function MentionAutocompletePopup({
  isOpen,
  members = [],
  query = '',
  currentUserId = null,
  onSelectMember,
  onClose
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  // Derive current user ID if not passed
  const myUid = useMemo(() => {
    if (currentUserId) return String(currentUserId);
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        return String(u.user_id || u.id || '');
      }
    } catch {}
    return '';
  }, [currentUserId]);

  // Clean and prepare query
  const cleanQuery = query.toLowerCase().trim();

  // Generate Special Mention Tags (Only @everyone)
  const specialTags = useMemo(() => {
    const list = [
      {
        id: '__everyone__',
        isSpecial: true,
        display: '@everyone',
        name: 'everyone',
        label: '@everyone',
        description: 'Notify all members of this group',
        icon: Users,
        iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400'
      }
    ];

    if (!cleanQuery) return list;
    return list.filter((t) =>
      t.name.includes(cleanQuery) ||
      t.label.toLowerCase().includes(cleanQuery) ||
      ('all'.includes(cleanQuery) || 'everybody'.includes(cleanQuery))
    );
  }, [cleanQuery]);

  // Filter group members (excluding the current logged-in student)
  const filteredMembers = useMemo(() => {
    const valid = members.filter((m) => {
      const uid = String(m.user_id || m.id || '');
      if (myUid && uid === myUid) return false;
      return true;
    });

    if (!cleanQuery) return valid.slice(0, 8);

    return valid.filter((m) => {
      const name = (m.full_name || m.name || '').toLowerCase();
      const dept = (m.department || '').toLowerCase();
      return name.includes(cleanQuery) || dept.includes(cleanQuery);
    }).slice(0, 10);
  }, [members, cleanQuery, myUid]);

  // Combined selectable list for keyboard navigation
  const allItems = useMemo(() => {
    return [...specialTags, ...filteredMembers];
  }, [specialTags, filteredMembers]);

  // Reset selected index whenever the query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, allItems.length]);

  // Intercept keyboard navigation in capture phase so Enter/Tab doesn't submit chat form
  useEffect(() => {
    if (!isOpen || allItems.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % allItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (allItems[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelectMember(allItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, allItems, selectedIndex, onSelectMember, onClose]);

  // Auto-scroll active item into visible view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  if (allItems.length === 0) {
    if (cleanQuery) {
      return (
        <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto sm:w-80 mb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 p-3 z-40 text-center text-xs text-slate-400 animate-in fade-in slide-in-from-bottom-2 duration-150">
          No group members match "@{cleanQuery}"
        </div>
      );
    }
    return null;
  }

  return (
    <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto sm:w-84 mb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden z-40 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
      {/* Header bar */}
      <div className="px-3.5 py-2 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <div className="flex items-center space-x-1.5 text-sky-600 dark:text-sky-400">
          <AtSign className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Mention in group</span>
        </div>
        <span className="text-[10px] font-medium text-slate-400">↑↓ to navigate, Enter to select</span>
      </div>

      {/* Member & Tag list */}
      <div ref={listRef} className="max-h-60 overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/60 p-1">
        {allItems.map((item, idx) => {
          const isSelected = idx === selectedIndex;

          // Special Tags rendering (@everyone, @admins)
          if (item.isSpecial) {
            const IconComponent = item.icon || BellRing;
            return (
              <button
                key={item.id}
                data-index={idx}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => onSelectMember(item)}
                className={`w-full p-2.5 rounded-xl text-left flex items-center space-x-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 shadow-2xs'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${item.iconBg}`}>
                  <IconComponent className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-xs text-amber-700 dark:text-amber-300 truncate">
                      {item.display}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      All Members
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.description}</p>
                </div>
              </button>
            );
          }

          // Group Member rendering
          const isCreator = Boolean(item.is_creator);
          const isAdmin = item.group_role === 'admin' || item.role === 'admin';

          return (
            <button
              key={item.user_id || item.id}
              data-index={idx}
              type="button"
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => onSelectMember(item)}
              className={`w-full p-2.5 rounded-xl text-left flex items-center space-x-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-950 dark:text-sky-100 shadow-2xs'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
              }`}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <SafeImage
                  src={item.avatar_url || item.profile_picture_url}
                  alt={item.full_name || 'Member'}
                  fallbackType="avatar"
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />
              </div>

              {/* Name & Role */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-xs truncate">
                    {item.full_name || item.name || 'Student'}
                  </span>
                  {isCreator ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      <span>Creator</span>
                    </span>
                  ) : isAdmin ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                      <Shield className="w-2.5 h-2.5 text-amber-600 fill-amber-600" />
                      <span>Admin</span>
                    </span>
                  ) : null}
                </div>
                {item.department && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.department}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
