import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, X, AlertTriangle, CheckCircle, ShieldAlert, Loader2 } from 'lucide-react';
import API from '../api';
import SafeImage from './SafeImage';

const REPORT_REASONS = [
  { id: 'spam_scam', label: 'Spam, scam, or commercial fraud' },
  { id: 'harassment', label: 'Harassment, bullying, or intimidation' },
  { id: 'inappropriate', label: 'Inappropriate, explicit, or offensive content' },
  { id: 'impersonation', label: 'Impersonation or fake campus identity' },
  { id: 'hate_speech', label: 'Hate speech, discrimination, or threats' },
  { id: 'academic_dishonesty', label: 'Academic dishonesty or exam misconduct' },
  { id: 'other', label: 'Other (specify in details below)' }
];

export default function ReportUserModal({
  isOpen,
  onClose,
  targetUser,
  onSuccessToast
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen || !targetUser) return null;

  const handleClose = () => {
    setSelectedReason('');
    setNotes('');
    setErrorMessage('');
    setIsSubmitted(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedReason) {
      setErrorMessage('Please select a reason for this report.');
      return;
    }

    if (selectedReason === 'Other' && !notes.trim()) {
      setErrorMessage('Please provide a note explaining the reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetUserId = targetUser.user_id || targetUser.id;
      const targetVendorId = targetUser.vendor_id || (targetUser.role === 'vendor' ? targetUser.id : null);

      await API.post('/reports', {
        reported_user_id: targetUserId ? String(targetUserId) : null,
        reported_vendor_id: targetVendorId ? Number(targetVendorId) : null,
        reason: selectedReason,
        notes: notes.trim() || null
      });

      setIsSubmitted(true);
      if (onSuccessToast) {
        onSuccessToast(`Report submitted for ${targetUser.full_name || 'user'}. Our safety team has been notified.`);
      }
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to submit report. Please try again.';
      setErrorMessage(typeof detail === 'string' ? detail : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                <Flag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">Report User</h3>
                <p className="text-[11px] text-slate-500 font-medium">Flag account for safety or guideline violations</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {isSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">Report Submitted</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Thank you for keeping CampusLink safe. Our moderation and safety team has received your report and will take appropriate action.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Target User Info Card */}
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-600">
                    {targetUser.profile_picture_url ? (
                      <SafeImage
                        src={targetUser.profile_picture_url}
                        alt={targetUser.full_name}
                        fallbackType="avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (targetUser.full_name || 'U').charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">
                      {targetUser.full_name || targetUser.business_name || 'Campus Member'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {targetUser.department || targetUser.role || 'Member'} • {targetUser.university_name || 'Campus University'}
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Reason Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Why are you reporting this user? <span className="text-rose-500">*</span>
                  </label>
                  <div className="space-y-1.5">
                    {REPORT_REASONS.map((r) => {
                      const isSelected = selectedReason === r.label;
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-rose-50/70 border-rose-300 text-rose-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="report_reason"
                            value={r.label}
                            checked={isSelected}
                            onChange={(e) => setSelectedReason(e.target.value)}
                            className="text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 accent-rose-600"
                          />
                          <span className="flex-1">{r.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Notes Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Additional Details / Context {selectedReason.startsWith('Other') && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide specific details, timestamps, or links that will help our safety team investigate..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-hidden resize-none text-slate-800 placeholder:text-slate-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    All reports are confidential. The reported user will not be told who submitted the report.
                  </p>
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="pt-2 flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedReason}
                    className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Submit Report</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
