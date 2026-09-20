import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, X, Shield, Lock, Unlock, MessageSquare, Edit3,
  UserCheck, UserMinus, Trash2, AlertCircle, Check, Loader2, Search
} from 'lucide-react';
import API, { getMediaUrl } from '../api';
import SafeImage from './SafeImage';

export default function GroupSettingsModal({
  isOpen,
  onClose,
  groupId,
  currentUser,
  onGroupUpdated,
  onGroupDeleted,
  initialGroupData
}) {
  const [group, setGroup] = useState(initialGroupData || null);
  const [loading, setLoading] = useState(!initialGroupData);
  const [updatingSetting, setUpdatingSetting] = useState(false);
  const [memberRoleActionUser, setMemberRoleActionUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const isFetchingRef = React.useRef(false);

  const fetchDetails = async () => {
    if (!groupId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!group) setLoading(true);
    setErrorMessage('');
    try {
      const res = await API.get(`/groups/${groupId}`);
      setGroup(res.data);
    } catch (err) {
      const is429 = err?.response?.status === 429;
      if (is429) {
        setErrorMessage('Server is busy (rate limit). Please tap retry in a moment.');
      } else {
        setErrorMessage(err?.response?.data?.detail || 'Failed to load group settings.');
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (isOpen && groupId) {
      setErrorMessage('');
      setSuccessMessage('');
      setShowDeleteConfirm(false);
      if (initialGroupData) {
        setGroup(initialGroupData);
        setLoading(false);
      }
      fetchDetails();
    }
  }, [isOpen, groupId]);

  if (!isOpen) return null;

  const currentUserId = String(currentUser?.user_id || currentUser?.id || '');
  const isCreator = String(group?.creator_id) === currentUserId;
  const isAdmin = group?.current_user_role === 'admin' || isCreator;

  // Toggle "Send Messages" lock
  const handleToggleOnlyAdminsCanMessage = async (val) => {
    setUpdatingSetting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await API.put(`/groups/${groupId}`, {
        only_admins_can_message: val
      });
      setGroup((prev) => ({ ...prev, only_admins_can_message: res.data.only_admins_can_message }));
      setSuccessMessage(val ? 'Messaging locked to admins only.' : 'All participants can now send messages.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update message permissions.');
    } finally {
      setUpdatingSetting(false);
    }
  };

  // Toggle "Edit Group Info" lock
  const handleToggleOnlyAdminsCanEditInfo = async (val) => {
    setUpdatingSetting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await API.put(`/groups/${groupId}`, {
        only_admins_can_edit_info: val
      });
      setGroup((prev) => ({ ...prev, only_admins_can_edit_info: res.data.only_admins_can_edit_info }));
      setSuccessMessage(val ? 'Info editing locked to admins only.' : 'All participants can now edit group info.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update edit permissions.');
    } finally {
      setUpdatingSetting(false);
    }
  };

  // Promote / Dismiss Admin
  const handleToggleAdminRole = async (targetUser) => {
    const isCurrentlyAdmin = targetUser.group_role === 'admin';
    const targetUid = String(targetUser.user_id);
    const newRole = isCurrentlyAdmin ? 'member' : 'admin';

    setMemberRoleActionUser(targetUid);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await API.post(`/groups/${groupId}/members/${targetUid}/role`, { role: newRole });
      setSuccessMessage(newRole === 'admin' ? `Promoted ${targetUser.full_name} to admin.` : `Dismissed ${targetUser.full_name} as admin.`);
      await fetchDetails();
      if (onGroupUpdated) onGroupUpdated({ id: groupId });
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update member role.');
    } finally {
      setMemberRoleActionUser(null);
    }
  };

  // Delete Group (Creator Only)
  const handleDeleteGroup = async () => {
    setDeletingGroup(true);
    setErrorMessage('');
    try {
      await API.delete(`/groups/${groupId}`);
      if (onGroupDeleted) onGroupDeleted(groupId);
      onClose();
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to delete group.');
    } finally {
      setDeletingGroup(false);
    }
  };

  const filteredMembers = (group?.members || []).filter((m) => {
    const q = adminSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (m.full_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden"
      >
        {/* Mobile Drag Pill */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-500/10 via-sky-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Group Settings
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Manage group permissions and administrators
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
              <span>Loading settings...</span>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate">{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchDetails}
                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-[11px] font-bold cursor-pointer shrink-0 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* SECTION 1: PERMISSION TOGGLES */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                  <Shield className="w-4 h-4 text-sky-600" />
                  <span>Group Permissions</span>
                </div>

                {/* Send Messages Toggle */}
                <div className="flex items-start justify-between gap-3 pt-1 border-t border-slate-200/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                      <span className="text-xs font-bold text-slate-800">Send Messages</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {group?.only_admins_can_message
                        ? 'Only group admins can send messages'
                        : 'All participants can send messages'}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!isAdmin || updatingSetting}
                    onClick={() => handleToggleOnlyAdminsCanMessage(!group?.only_admins_can_message)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      group?.only_admins_can_message ? 'bg-sky-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        group?.only_admins_can_message ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Edit Group Info Toggle */}
                <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-200/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span className="text-xs font-bold text-slate-800">Edit Group Info</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {group?.only_admins_can_edit_info
                        ? 'Only group admins can edit subject and icon'
                        : 'All participants can edit group info'}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!isAdmin || updatingSetting}
                    onClick={() => handleToggleOnlyAdminsCanEditInfo(!group?.only_admins_can_edit_info)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      group?.only_admins_can_edit_info ? 'bg-sky-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        group?.only_admins_can_edit_info ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* SECTION 2: EDIT GROUP ADMINS */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    <span>Manage Admins</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {(group?.members || []).filter((m) => m.group_role === 'admin').length} Admins
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">
                  Appoint or dismiss administrators for this group.
                </p>

                {/* Admin Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                {/* Members List for Admin Assignment */}
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200/70">
                  {filteredMembers.map((m) => {
                    const isTargetCreator = m.is_creator;
                    const isTargetAdmin = m.group_role === 'admin';
                    const isSelf = String(m.user_id) === currentUserId;
                    const isBusy = memberRoleActionUser === String(m.user_id);

                    return (
                      <div
                        key={m.user_id}
                        className="p-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 overflow-hidden shrink-0">
                            {m.avatar_url ? (
                              <SafeImage src={getMediaUrl(m.avatar_url)} alt={m.full_name} className="w-full h-full object-cover" />
                            ) : (
                              (m.full_name || 'U')[0].toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {m.full_name}
                              </span>
                              {isTargetCreator ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0">
                                  Creator
                                </span>
                              ) : isTargetAdmin ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 shrink-0">
                                  Admin
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {isSelf ? 'You' : m.user_role || 'Student'}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isTargetCreator ? (
                            <span className="text-[10px] font-semibold text-slate-400 px-2 py-1">
                              Owner
                            </span>
                          ) : isSelf ? (
                            <span className="text-[10px] font-semibold text-slate-400 px-2 py-1">
                              You
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy || !isAdmin}
                              onClick={() => handleToggleAdminRole(m)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1 ${
                                isTargetAdmin
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                              }`}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isTargetAdmin ? (
                                <span>Dismiss Admin</span>
                              ) : (
                                <span>Make Admin</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: DANGER ZONE (CREATOR ONLY: DELETE GROUP) */}
              {isCreator && (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2.5">
                  <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Group Permanently</span>
                  </div>
                  <p className="text-[11px] text-rose-600/90 leading-relaxed">
                    Deleting this group will remove all participants, settings, and permanent message history. This action cannot be undone.
                  </p>

                  {showDeleteConfirm ? (
                    <div className="pt-2 flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteGroup}
                        disabled={deletingGroup}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1"
                      >
                        {deletingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Yes, Delete</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full py-2 bg-white hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      Delete Group
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
