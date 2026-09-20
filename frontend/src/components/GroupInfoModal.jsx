import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, X, Search, Camera, Check, AlertCircle,
  Shield, ShieldCheck, ShieldAlert, UserPlus, UserMinus,
  MessageSquare, Edit3, Lock, Unlock, LogOut, Trash2,
  MoreVertical, Store, GraduationCap, Loader2, Crown
} from 'lucide-react';
import API, { uploadFile, getMediaUrl } from '../api';
import SafeImage from './SafeImage';

export default function GroupInfoModal({
  isOpen,
  onClose,
  groupId,
  currentUser,
  onGroupUpdated,
  onGroupDeleted,
  onOpenDirectChat
}) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Inline Editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Participant search
  const [participantSearch, setParticipantSearch] = useState('');

  // Add Participant Drawer
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  // Active Menu Dropdown for Member Actions
  const [activeMenuMemberId, setActiveMenuMemberId] = useState(null);

  const fileInputRef = useRef(null);

  const fetchGroupDetails = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await API.get(`/groups/${groupId}`);
      setGroup(res.data);
      setEditNameValue(res.data.name || '');
      setEditDescValue(res.data.description || '');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && groupId) {
      setErrorMessage('');
      setSuccessMessage('');
      setShowAddMember(false);
      setIsEditingName(false);
      setIsEditingDesc(false);
      setActiveMenuMemberId(null);
      fetchGroupDetails();
    }
  }, [isOpen, groupId]);

  // Load contacts when "Add Participants" opens
  useEffect(() => {
    if (showAddMember) {
      async function loadContacts() {
        setLoadingContacts(true);
        try {
          const res = await API.get('/community/users?role=student');
          const list = Array.isArray(res.data) ? res.data : [];
          // Filter out users already in the group and keep only students
          const currentMemberUids = new Set((group?.members || []).map((m) => String(m.user_id)));
          setAvailableContacts(list.filter((u) => u.role === 'student' && !currentMemberUids.has(String(u.user_id))));
        } catch (err) {
          console.warn('[GroupInfoModal] Error loading contacts:', err);
        } finally {
          setLoadingContacts(false);
        }
      }
      loadContacts();
    }
  }, [showAddMember, group]);

  if (!isOpen) return null;

  const currentUserId = String(currentUser?.user_id || currentUser?.id || '');
  const isCurrentUserAdmin = group?.current_user_role === 'admin';
  const isCurrentUserCreator = String(group?.creator_id) === currentUserId;

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

  // 4. WhatsApp Permission Toggles (Admins only)
  const handleToggleOnlyAdminsCanMessage = async (val) => {
    if (!isCurrentUserAdmin) return;
    setSavingSettings(true);
    setErrorMessage('');
    try {
      const res = await API.put(`/groups/${groupId}`, { only_admins_can_message: val });
      setGroup((prev) => ({ ...prev, only_admins_can_message: res.data.only_admins_can_message }));
      setSuccessMessage(val ? 'Group locked: Only admins can send messages.' : 'Group opened: All members can send messages.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to change message settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleOnlyAdminsCanEditInfo = async (val) => {
    if (!isCurrentUserAdmin) return;
    setSavingSettings(true);
    setErrorMessage('');
    try {
      const res = await API.put(`/groups/${groupId}`, { only_admins_can_edit_info: val });
      setGroup((prev) => ({ ...prev, only_admins_can_edit_info: res.data.only_admins_can_edit_info }));
      setSuccessMessage(val ? 'Info locked: Only admins can edit group info.' : 'Info opened: All participants can edit group info.');
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to change info settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 5. Promote or Demote Admin
  const handleUpdateRole = async (targetUserId, targetRole) => {
    setActiveMenuMemberId(null);
    setErrorMessage('');
    try {
      await API.post(`/groups/${groupId}/members/${targetUserId}/role`, { role: targetRole });
      setSuccessMessage(`Updated participant role to ${targetRole}.`);
      await fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated({ id: groupId });
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to update role.');
    }
  };

  // 6. Remove Member
  const handleRemoveMember = async (targetUserId, targetName) => {
    setActiveMenuMemberId(null);
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the group?`)) return;

    setErrorMessage('');
    try {
      await API.delete(`/groups/${groupId}/members/${targetUserId}`);
      setSuccessMessage(`Removed ${targetName} from the group.`);
      await fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated({ id: groupId });
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to remove member.');
    }
  };

  // 7. Exit Group
  const handleExitGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    setErrorMessage('');
    try {
      await API.delete(`/groups/${groupId}/members/${currentUserId}`);
      if (onGroupDeleted) onGroupDeleted(groupId);
      onClose();
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to leave group.');
    }
  };

  // 8. Delete Group (Creator Only)
  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this group? All messages will be erased.')) return;
    setErrorMessage('');
    try {
      await API.delete(`/groups/${groupId}`);
      if (onGroupDeleted) onGroupDeleted(groupId);
      onClose();
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to delete group.');
    }
  };

  // 9. Add Participants Submit
  const handleAddSelectedMembers = async () => {
    if (!selectedToAdd.length) return;
    setAddingMembers(true);
    setErrorMessage('');
    try {
      await API.post(`/groups/${groupId}/members`, { member_ids: selectedToAdd });
      setSuccessMessage(`Added ${selectedToAdd.length} participant(s).`);
      setSelectedToAdd([]);
      setShowAddMember(false);
      await fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated({ id: groupId });
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to add participants.');
    } finally {
      setAddingMembers(false);
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
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden"
      >
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-500/10 via-sky-50 to-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">Group Info & Settings</h2>
              <p className="text-[11px] font-medium text-slate-500">
                {group?.member_count || 0} participants • WhatsApp style
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 divide-y divide-slate-100">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
              <span>Loading group settings...</span>
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

              {/* 2. WhatsApp Group Permissions Section (Admins Only) */}
              {isCurrentUserAdmin && (
                <div className="pt-4 space-y-3.5">
                  <div className="flex items-center space-x-1.5">
                    <Shield className="w-4 h-4 text-sky-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Group Settings & Permissions
                    </h4>
                  </div>

                  {/* Lock/Open Group: Send Messages */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {group?.only_admins_can_message ? (
                          <Lock className="w-4 h-4 text-rose-500" />
                        ) : (
                          <Unlock className="w-4 h-4 text-emerald-600" />
                        )}
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Send Messages</span>
                          <span className="text-[10px] text-slate-500">
                            {group?.only_admins_can_message
                              ? 'Only admins can send messages'
                              : 'All participants can send messages'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleOnlyAdminsCanMessage(false)}
                        disabled={savingSettings}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          !group?.only_admins_can_message
                            ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        All Members
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleOnlyAdminsCanMessage(true)}
                        disabled={savingSettings}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          group?.only_admins_can_message
                            ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        🔒 Only Admins
                      </button>
                    </div>
                  </div>

                  {/* Lock/Open Info: Edit Group Info */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Edit3 className="w-4 h-4 text-slate-600" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Edit Group Info</span>
                          <span className="text-[10px] text-slate-500">
                            {group?.only_admins_can_edit_info
                              ? 'Only admins can change icon and subject'
                              : 'All participants can edit info'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleOnlyAdminsCanEditInfo(false)}
                        disabled={savingSettings}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          !group?.only_admins_can_edit_info
                            ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        All Members
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleOnlyAdminsCanEditInfo(true)}
                        disabled={savingSettings}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          group?.only_admins_can_edit_info
                            ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Only Admins
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Participants Section */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-sky-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Participants ({group?.members?.length || 0})
                    </h4>
                  </div>
                  {isCurrentUserAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAddMember(true)}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Members</span>
                    </button>
                  )}
                </div>

                {/* Add Member Drawer */}
                {showAddMember && (
                  <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                      <span>Select Contacts to Add</span>
                      <button
                        type="button"
                        onClick={() => setShowAddMember(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto divide-y divide-sky-100 bg-white rounded-xl border border-sky-100">
                      {loadingContacts ? (
                        <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                          <span>Loading contacts...</span>
                        </div>
                      ) : availableContacts.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          All campus contacts are already in this group.
                        </div>
                      ) : (
                        availableContacts.map((c) => {
                          const cid = String(c.user_id);
                          const isSel = selectedToAdd.includes(cid);
                          return (
                            <div
                              key={cid}
                              onClick={() => {
                                setSelectedToAdd((prev) =>
                                  isSel ? prev.filter((id) => id !== cid) : [...prev, cid]
                                );
                              }}
                              className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                                isSel ? 'bg-sky-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                  {(c.full_name || 'U')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-slate-800 truncate block">
                                    {c.full_name}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">
                                    {c.role === 'vendor' ? 'Vendor' : 'Student'}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSel ? 'bg-sky-500 border-sky-600 text-white' : 'border-slate-300'
                                }`}
                              >
                                {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddMember(false)}
                        className="px-2.5 py-1 text-slate-600 text-xs font-semibold hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSelectedMembers}
                        disabled={addingMembers || selectedToAdd.length === 0}
                        className="px-3.5 py-1 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                      >
                        {addingMembers && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Add ({selectedToAdd.length})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Participants List */}
                <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {filteredMembers.map((m) => {
                    const isSelf = String(m.user_id) === currentUserId;
                    const isMemAdmin = m.group_role === 'admin';
                    const isMemCreator = m.is_creator;
                    const isMenuOpen = activeMenuMemberId === m.user_id;

                    return (
                      <div
                        key={m.user_id}
                        className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors relative"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0 text-xs">
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
                              {m.user_role === 'vendor' ? (
                                <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-amber-100 text-amber-800 shrink-0">
                                  Vendor
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-sky-100 text-sky-800 shrink-0">
                                  Student
                                </span>
                              )}
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
                                  Group Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Triggers */}
                        <div className="relative shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => setActiveMenuMemberId(isMenuOpen ? null : m.user_id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Member Dropdown Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-1 divide-y divide-slate-100 text-xs">
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuMemberId(null);
                                    if (onOpenDirectChat) onOpenDirectChat(m);
                                    onClose();
                                  }}
                                  className="w-full px-3 py-2 text-left text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center space-x-2 cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Message {m.full_name.split(' ')[0]}</span>
                                </button>
                              )}

                              {isCurrentUserAdmin && !isSelf && (
                                <>
                                  {!isMemAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateRole(m.user_id, 'admin')}
                                      className="w-full px-3 py-2 text-left text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 cursor-pointer font-semibold"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Make Group Admin</span>
                                    </button>
                                  ) : (
                                    !isMemCreator && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateRole(m.user_id, 'member')}
                                        className="w-full px-3 py-2 text-left text-amber-700 hover:bg-amber-50 flex items-center space-x-2 cursor-pointer font-semibold"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Dismiss as Admin</span>
                                      </button>
                                    )
                                  )}

                                  {!isMemCreator && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMember(m.user_id, m.full_name)}
                                      className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer font-semibold"
                                    >
                                      <UserMinus className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Remove from Group</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Danger Zone */}
              <div className="pt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleExitGroup}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Group</span>
                </button>

                {isCurrentUserCreator && (
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Group for Everyone</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
