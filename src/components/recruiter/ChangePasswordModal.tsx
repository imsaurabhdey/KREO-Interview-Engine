/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, X, ShieldAlert, CheckCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  userEmail: string;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  error: string;
  success: string;
  isSubmitting: boolean;
  onOldPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ChangePasswordModal({
  isOpen,
  userEmail,
  oldPassword,
  newPassword,
  confirmPassword,
  error,
  success,
  isSubmitting,
  onOldPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onClose,
  onSubmit
}: ChangePasswordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div className="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl w-full max-w-md z-20 transition-all duration-350">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>Change Account Password</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Securely update your Recruiter/Admin portal password of {userEmail}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
            disabled={isSubmitting}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4 font-sans">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1.5">
              Old Password
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => onOldPasswordChange(e.target.value)}
              placeholder="Enter current password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Enter new secure password (min 6 chars)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              placeholder="Confirm new secure password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Updating...' : 'Submit & Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
