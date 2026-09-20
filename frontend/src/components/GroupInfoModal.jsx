import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, X, Search, Camera, Check, AlertCircle,
  Shield, ShieldCheck, ShieldAlert, UserPlus, UserMinus,
  MessageSquare, Edit3, LogOut, Settings,
  MoreVertical, GraduationCap, Loader2, Crown, User
} from 'lucide-react';
import API, { uploadFile, getMediaUrl } from '../api';
import SafeImage from './SafeImage';

export default function GroupInfoModal({
  isOpen,
  onClose,
  groupId,
  currentUser,
  onGroupUpdated,
  onGroupLeft,
  onGroupDeleted,
  onOpenDirectChat,
  onOpenAddMembers,
  onOpenSettings,
  initialGroupData
}) {
  const [group, setGroup] = useState(initialGroupData || null);
  const [loading, setLoading] = useState(!initialGroupData);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Inline Editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(initialGroupData?.name || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState(initialGroupData?.description || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Participant search
  const [participantSearch, setParticipantSearch] = useState('');

  // Dedicated Member Action Sheet Modal (solves clipped dropdowns & poor touch responsiveness)
  const [activeActionMember, setActiveActionMember] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fileInputRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchGroupDetails = async () => {
    if (!groupId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!group) setLoading(true);
    setErrorMessage('');
    try {
      const res = await API.get(`/groups/${groupId}`);
      setGroup(res.data);
      setEditNameValue(res.data.name || '');
      setEditDescValue(res.data.description || '');
    } catch (err) {
      const is429 = err?.response?.status === 429;
      if (is429) {
        setErrorMessage('Network is busy. Showing cached group information.');
      } else {
        setErrorMessage(err?.response?.data?.detail || 'Failed to load group details.');
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
      setIsEditingName(false);
      setIsEditingDesc(false);
      setActiveActionMember(null);
      if (initialGroupData) {
        setGroup(initialGroupData);
        setEditNameValue(initialGroupData.name || '');
        setEditDescValue(initialGroupData.description || '');
      }
      fetchGroupDetails();
    }
  }, [isOpen, groupId]);

  if (!isOpen) return null;

  const currentUserId = String(currentUser?.user_id || currentUser?.id || '');
  const isCurrentUserCreator = String(group?.creator_id) === currentUserId;
  const isCurrentUserAdmin = group?.current_user_role === 'admin' || isCurrentUserCreator;

  const canEditInfo = isCurrentUserAdmin || !group?.only_admins_can_edit_info;

  // 1. Update Group Name
  const handleSaveName = async () => {
    if (!editNameValue.trim()) return;
    setSavingSettings(true);
    setErrorMessage('');
    try {
      const res = await API.put(`/groups/${groupId}`, { name: editNameValue.trim() });
      setGroup((prev) => ({ ...prev, name: res.data.name }));
      setIsEditingName(false);
      setSuccessMessage('Group name updated.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update name.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 2. Update Group Description
  const handleSaveDesc = async () => {
    setSavingSettings(true);
    setErrorMessage('');
    try {
      const res = await API.put(`/groups/${groupId}`, { description: editDescValue.trim() });
      setGroup((prev) => ({ ...prev, description: res.data.description }));
      setIsEditingDesc(false);
      setSuccessMessage('Group description updated.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update description.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 3. Upload & Update Icon
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setErrorMessage('');
    try {
      const uploadedUrl = await uploadFile(file);
      const res = await API.put(`/groups/${groupId}`, { avatar_url: uploadedUrl });
      setGroup((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
      setSuccessMessage('Group icon updated.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update group icon.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 4. Promote or Demote Admin
  const handleUpdateRole = async (targetUserId, targetRole) => {
    setActionLoading(true);
    setErrorMessage('');
    try {
      await API.post(`/groups/${groupId}/members/${targetUserId}/role`, { role: targetRole });
      setSuccessMessage(`Updated participant role to ${targetRole}.`);
      setActiveActionMember(null);
      await fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated({ id: groupId });
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update role.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Remove Member
  const handleRemoveMember = async (targetUserId, targetName) => {
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the group?`)) return;

    setActionLoading(true);
    setErrorMessage('');
    try {
      await API.delete(`/groups/${groupId}/members/${targetUserId}`);
      setSuccessMessage(`Removed ${targetName} from the group.`);
      setActiveActionMember(null);
      await fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated({ id: groupId });
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Exit Group
  const handleExitGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    setErrorMessage('');
    try {
      await API.delete(`/groups/${groupId}/members/${currentUserId}`);
      if (onGroupLeft) onGroupLeft(groupId);
      else if (onGroupDeleted) onGroupDeleted(groupId);
      onClose();
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to leave group.');
    }
  };

  const filteredMembers = (group?.members || []).filter((m) => {
    const q = participantSearch.toLowerCase().trim();
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
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 flex flex-col h-[92dvh] sm:h-auto sm:max-h-[88vh] overflow-hidden"
      >
        {/* Mobile Drag Pill */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-500/10 via-sky-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">Group Info</h2>
              <p className="text-[11px] font-medium text-slate-500">
                {group?.member_count || group?.members?.length || 0} participants
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

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
              <span>Loading group information...</span>
            </div>
          ) : (
            <>
              {/* Notifications */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* 1. Group Header & Avatar */}
              <div className="flex flex-col items-center text-center pt-1 pb-2">
                <div className="relative group/avatar mb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <div className="w-20 h-20 rounded-3xl bg-sky-100 border-2 border-sky-200 flex items-center justify-center text-sky-700 font-black text-2xl overflow-hidden shadow-md shadow-sky-500/10">
                    {group?.avatar_url ? (
                      <SafeImage
                        src={getMediaUrl(group.avatar_url)}
                        alt={group.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (group?.name || 'G')[0].toUpperCase()
                    )}
                  </div>
                  {canEditInfo && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105"
                      title="Change group icon"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Group Name */}
                {isEditingName ? (
                  <div className="flex items-center space-x-1.5 w-full max-w-xs mb-1">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      maxLength={100}
                      className="flex-1 px-3 py-1 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={savingSettings || !editNameValue.trim()}
                      className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-1.5 mb-0.5">
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {group?.name}
                    </h3>
                    {canEditInfo && (
                      <button
                        type="button"
                        onClick={() => setIsEditingName(true)}
                        className="text-slate-400 hover:text-sky-600 p-1 cursor-pointer transition-colors"
                        title="Edit group name"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Group Description */}
                {isEditingDesc ? (
                  <div className="flex flex-col space-y-1.5 w-full max-w-sm mt-1">
                    <textarea
                      value={editDescValue}
                      onChange={(e) => setEditDescValue(e.target.value)}
                      rows={2}
                      maxLength={250}
                      placeholder="Add group description..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setIsEditingDesc(false)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDesc}
                        disabled={savingSettings}
                        className="px-3 py-1 bg-sky-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-500 max-w-sm mt-0.5">
                    <span className="italic">{group?.description || 'No description added yet.'}</span>
                    {canEditInfo && (
                      <button
                        type="button"
                        onClick={() => setIsEditingDesc(true)}
                        className="text-slate-400 hover:text-sky-600 p-0.5 cursor-pointer transition-colors"
                        title="Edit description"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-slate-400 mt-1">
                  Created by <span className="font-semibold text-slate-600">{group?.creator_name || 'Admin'}</span>
                </p>
              </div>

              {/* 2. Quick Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {isCurrentUserAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenAddMembers) {
                        onOpenAddMembers();
                      }
                    }}
                    className="py-2.5 px-3 bg-sky-50 hover:bg-sky-100 active:scale-98 border border-sky-200/80 rounded-2xl text-sky-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-4 h-4 text-sky-600" />
                    <span>Add Members</span>
                  </button>
                )}

                {isCurrentUserAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenSettings) {
                        onOpenSettings();
                      }
                    }}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 active:scale-98 border border-slate-200 rounded-2xl text-slate-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span>Group Settings</span>
                  </button>
                )}
              </div>

              {/* Group Policy Badges */}
              {(group?.only_admins_can_message || group?.only_admins_can_edit_info) && (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                  {group?.only_admins_can_message && (
                    <div className="flex items-center space-x-2 text-[11px] text-amber-800 font-semibold">
                      <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Only administrators can send messages in this group.</span>
                    </div>
                  )}
                  {group?.only_admins_can_edit_info && (
                    <div className="flex items-center space-x-2 text-[11px] text-amber-800 font-semibold">
                      <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Only administrators can edit group info and photo.</span>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Participants Section */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-sky-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Participants ({group?.members?.length || 0})
                    </h4>
                  </div>
                </div>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 font-medium"
                  />
                  {participantSearch && (
                    <button
                      type="button"
                      onClick={() => setParticipantSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Participants List */}
                <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {filteredMembers.map((m) => {
                    const isSelf = String(m.user_id) === currentUserId;
                    const isMemAdmin = m.group_role === 'admin';
                    const isMemCreator = m.is_creator;

                    return (
                      <div
                        key={m.user_id}
                        onClick={() => setActiveActionMember(m)}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0 text-xs">
                            {m.avatar_url ? (
                              <SafeImage
                                src={getMediaUrl(m.avatar_url)}
                                alt={m.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (m.full_name || 'U')[0].toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {m.full_name} {isSelf && <span className="text-slate-400 font-normal">(You)</span>}
                              </span>
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 flex items-center shrink-0">
                                <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                                Student
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {isMemCreator && (
                                <span className="text-[10px] font-bold text-amber-600 flex items-center space-x-0.5">
                                  <Crown className="w-2.5 h-2.5 mr-0.5" />
                                  Group Creator
                                </span>
                              )}
                              {isMemAdmin && !isMemCreator && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Trigger Button (Explicit 44px Touch Target) */}
                        <div className="shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMember(m);
                            }}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                            title="Member options"
                            aria-label="Member options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Exit Group Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExitGroup}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Group</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* --- TACTILE MEMBER ACTION SHEET / MODAL --- */}
        <AnimatePresence>
          {activeActionMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveActionMember(null)}
              className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
              <motion.div
                initial={{ y: '100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200/80 space-y-4"
              >
                {/* Member Profile Header */}
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0 text-base">
                    {activeActionMember.avatar_url ? (
                      <SafeImage
                        src={getMediaUrl(activeActionMember.avatar_url)}
                        alt={activeActionMember.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (activeActionMember.full_name || 'U')[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {activeActionMember.full_name}
                    </h3>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      {activeActionMember.is_creator ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center space-x-1">
                          <Crown className="w-3 h-3" />
                          <span>Group Creator</span>
                        </span>
                      ) : activeActionMember.group_role === 'admin' ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Group Admin</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center space-x-1">
                          <GraduationCap className="w-3 h-3" />
                          <span>Campus Student</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveActionMember(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Actions List */}
                <div className="space-y-2">
                  {/* Message Member Privately */}
                  {String(activeActionMember.user_id) !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeActionMember;
                        setActiveActionMember(null);
                        onClose();
                        if (onOpenDirectChat) {
                          onOpenDirectChat(target);
                        }
                      }}
                      className="w-full p-3 rounded-xl bg-slate-50 hover:bg-sky-50 active:bg-sky-100 text-slate-800 hover:text-sky-800 text-xs font-bold flex items-center space-x-3 transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block font-bold">Message {activeActionMember.full_name.split(' ')[0]}</span>
                        <span className="text-[10px] text-slate-500 font-normal">Start a private 1-on-1 direct conversation</span>
                      </div>
                    </button>
                  )}

                  {/* Admin Controls */}
                  {isCurrentUserAdmin && String(activeActionMember.user_id) !== currentUserId && (
                    <>
                      {/* Promote / Dismiss Admin */}
                      {activeActionMember.group_role !== 'admin' ? (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateRole(activeActionMember.user_id, 'admin')}
                          className="w-full p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-3 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <span className="block font-bold">Make Group Admin</span>
                            <span className="text-[10px] text-emerald-700 font-normal">Allow this student to manage settings and participants</span>
                          </div>
                        </button>
                      ) : (
                        !activeActionMember.is_creator && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleUpdateRole(activeActionMember.user_id, 'member')}
                            className="w-full p-3 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 text-xs font-bold flex items-center space-x-3 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                            </div>
                            <div className="text-left">
                              <span className="block font-bold">Dismiss as Admin</span>
                              <span className="text-[10px] text-amber-700 font-normal">Demote this participant back to regular member</span>
                            </div>
                          </button>
                        )
                      )}

                      {/* Remove Member */}
                      {!activeActionMember.is_creator && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleRemoveMember(activeActionMember.user_id, activeActionMember.full_name)}
                          className="w-full p-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-3 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <span className="block font-bold">Remove from Group</span>
                            <span className="text-[10px] text-rose-600 font-normal">Remove {activeActionMember.full_name} from this group</span>
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={() => setActiveActionMember(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
