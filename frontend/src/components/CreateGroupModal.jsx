import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, X, Search, Camera, Check, AlertCircle,
  Building2, Store, GraduationCap, Loader2, Sparkles
} from 'lucide-react';
import API, { uploadFile, getMediaUrl } from '../api';
import SafeImage from './SafeImage';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated, currentUser }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);

  // Load available students and vendors when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setName('');
    setDescription('');
    setAvatarUrl('');
    setSelectedUserIds([]);
    setSearchQuery('');
    setErrorMessage('');

    async function fetchUsers() {
      setLoadingUsers(true);
      try {
        const res = await API.get('/community/users?role=student');
        const list = Array.isArray(res.data) ? res.data : [];
        const myUid = String(currentUser?.user_id || currentUser?.id || '');
        // Filter strictly to students only and exclude current user
        setUsersList(list.filter((u) => u.role === 'student' && String(u.user_id) !== myUid));
      } catch (err) {
        console.warn('[CreateGroupModal] Error loading contacts:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setAvatarUploading(true);
    setErrorMessage('');
    try {
      const uploadedUrl = await uploadFile(file);
      setAvatarUrl(uploadedUrl);
    } catch (err) {
      setErrorMessage('Failed to upload group icon. You can still create the group.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const toggleSelectUser = (uid) => {
    setErrorMessage('');
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (u.full_name || '').toLowerCase().includes(q);
    const storeMatch = (u.business_name || '').toLowerCase().includes(q);
    const deptMatch = (u.department || '').toLowerCase().includes(q);
    const uniMatch = (u.university_name || '').toLowerCase().includes(q);
    return nameMatch || storeMatch || deptMatch || uniMatch;
  });

  const selectedUsers = usersList.filter((u) => selectedUserIds.includes(String(u.user_id)));

  const handleCreate = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Please enter a group subject / name.');
      return;
    }
    if (cleanName.length > 100) {
      setErrorMessage('Group name cannot exceed 100 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        description: description.trim() || null,
        avatar_url: avatarUrl || null,
        member_ids: selectedUserIds
      };

      const res = await API.post('/groups', payload);
      if (onGroupCreated) {
        onGroupCreated(res.data);
      }
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to create group. Please try again.';
      setErrorMessage(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-500/10 via-sky-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                New Community Group
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Connect students & vendors in a shared campus group
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleCreate} className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Group Subject & Avatar */}
          <div className="flex items-start space-x-3.5 shrink-0">
            <div className="relative shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex flex-col items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer overflow-hidden relative group"
                title="Add group icon"
              >
                {avatarUrl ? (
                  <SafeImage
                    src={getMediaUrl(avatarUrl)}
                    alt="Group Icon"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <Camera className="w-5 h-5 mb-0.5 text-slate-400 group-hover:text-sky-600 transition-colors" />
                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-sky-600">Icon</span>
                  </>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Group Subject <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">{name.length}/100</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 400L Mechanical Engineering or JABU Thrift Market"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-semibold"
                  autoFocus
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Group description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={250}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Selected Members Chips */}
          {selectedUsers.length > 0 && (
            <div className="shrink-0 space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600">
                  Selected Participants ({selectedUsers.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="text-sky-600 font-semibold hover:underline text-[10px] cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                {selectedUsers.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex items-center space-x-1.5 bg-sky-50 border border-sky-200 text-sky-900 px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0"
                  >
                    <span>{u.full_name.split(' ')[0]}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectUser(String(u.user_id))}
                      className="hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participant Search & List */}
          <div className="flex-1 flex flex-col min-h-[180px] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Add Participants (Campus Students)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                {usersList.length} fellow students
              </span>
            </div>

            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student name or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
              />
            </div>

            {/* Scrollable Members List */}
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-52">
              {loadingUsers ? (
                <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                  <span>Loading students...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No students found matching "{searchQuery}".
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const uid = String(u.user_id);
                  const isSelected = selectedUserIds.includes(uid);

                  return (
                    <div
                      key={uid}
                      onClick={() => toggleSelectUser(uid)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0 text-xs">
                          {u.profile_picture_url ? (
                            <SafeImage
                              src={getMediaUrl(u.profile_picture_url)}
                              alt={u.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (u.full_name || 'U')[0].toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {u.full_name}
                            </span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 flex items-center space-x-0.5 shrink-0">
                              <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                              Student
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {u.department || u.university_name || 'Campus Student'}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ml-2 ${
                          isSelected
                            ? 'bg-sky-500 border-sky-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Group...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Group ({selectedUserIds.length + 1})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
