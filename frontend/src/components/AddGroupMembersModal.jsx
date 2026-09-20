import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Check, Loader2, UserPlus, GraduationCap, AlertCircle } from 'lucide-react';
import API, { getMediaUrl } from '../api';
import SafeImage from './SafeImage';

export default function AddGroupMembersModal({
  isOpen,
  onClose,
  groupId,
  existingMemberIds = [],
  onMembersAdded,
  currentUser
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen || !groupId) return;
    setSearchQuery('');
    setSelectedUserIds([]);
    setErrorMessage('');

    async function fetchStudents() {
      setLoading(true);
      try {
        const res = await API.get('/community/users?role=student');
        const list = Array.isArray(res.data) ? res.data : [];
        const existingSet = new Set(existingMemberIds.map((id) => String(id)));
        const myUid = String(currentUser?.user_id || currentUser?.id || '');

        // Only show students who are not already in the group and not current user
        setStudents(
          list.filter((u) => u.role === 'student' && !existingSet.has(String(u.user_id)) && String(u.user_id) !== myUid)
        );
      } catch (err) {
        console.warn('[AddGroupMembersModal] Error loading students:', err);
        setErrorMessage('Failed to load campus students.');
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [isOpen, groupId, existingMemberIds, currentUser]);

  if (!isOpen) return null;

  const toggleSelectUser = (uid) => {
    setErrorMessage('');
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const filteredStudents = students.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (u.full_name || '').toLowerCase().includes(q);
    const deptMatch = (u.department || '').toLowerCase().includes(q);
    const uniMatch = (u.university_name || '').toLowerCase().includes(q);
    return nameMatch || deptMatch || uniMatch;
  });

  const selectedStudents = students.filter((u) => selectedUserIds.includes(String(u.user_id)));

  const handleAddMembers = async () => {
    if (!selectedUserIds.length) return;
    setSubmitting(true);
    setErrorMessage('');

    try {
      await API.post(`/groups/${groupId}/members`, { member_ids: selectedUserIds });
      if (onMembersAdded) {
        onMembersAdded(selectedUserIds);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to add participants to group.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 flex flex-col h-[92dvh] sm:h-auto sm:max-h-[88vh] overflow-hidden"
      >
        {/* Mobile Drag Pill */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-500/10 via-sky-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Add Participants
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Select fellow campus students to add to this group
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

        {/* Modal Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 sm:p-5 space-y-3.5">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Search Box */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student by name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Selected Chips */}
          {selectedStudents.length > 0 && (
            <div className="shrink-0 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600">
                  Selected ({selectedStudents.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="text-sky-600 font-semibold hover:underline text-[10px] cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {selectedStudents.map((u) => (
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

          {/* Students List */}
          <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
                <span>Loading campus students...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {searchQuery ? `No students found matching "${searchQuery}".` : 'No additional students available to add.'}
              </div>
            ) : (
              filteredStudents.map((u) => {
                const uid = String(u.user_id);
                const isSelected = selectedUserIds.includes(uid);

                return (
                  <div
                    key={uid}
                    onClick={() => toggleSelectUser(uid)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0 text-xs">
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
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 flex items-center shrink-0">
                            <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                            Student
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
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

        {/* Sticky Action Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs flex items-center justify-end space-x-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddMembers}
            disabled={submitting || selectedUserIds.length === 0}
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : 'Participants'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
