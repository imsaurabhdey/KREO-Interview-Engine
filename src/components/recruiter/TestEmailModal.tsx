/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, X, ShieldAlert, CheckCircle, AlertCircle } from 'lucide-react';

interface TestEmailResult {
  mode: 'sent' | 'simulated';
  message: string;
}

interface TestEmailModalProps {
  isOpen: boolean;
  userEmail: string;
  testEmailAddress: string;
  error: string;
  result: TestEmailResult | null;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function TestEmailModal({
  isOpen,
  userEmail,
  testEmailAddress,
  error,
  result,
  isSubmitting,
  onEmailChange,
  onClose,
  onSubmit
}: TestEmailModalProps) {
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
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 font-sans">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <span>Test Mail Dispatcher</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Send a demo proctor invitation email instantly to verify your email integration.
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

          {result && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                result.mode === 'sent'
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-805'
                  : 'bg-amber-50 border-amber-100 text-amber-805'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-[13px]">
                {result.mode === 'sent' ? (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                )}
                <span>{result.mode === 'sent' ? 'Real Email Dispatched!' : 'Simulation Mode Active'}</span>
              </div>
              <p className="leading-relaxed">{result.message}</p>
              {result.mode === 'simulated' && (
                <div className="mt-2 p-2.5 bg-amber-950/5 border border-amber-500/20 rounded-lg text-[11px] text-amber-700 space-y-1">
                  <span className="font-semibold block uppercase tracking-wider text-[9px] text-amber-800">
                    How to send real emails via Brevo:
                  </span>
                  <p>
                    To dispatch live emails via Brevo, set your{' '}
                    <code className="bg-white/60 px-1 border rounded text-indigo-600 font-mono text-[10px]">BREVO_API_KEY</code>{' '}
                    (and optional{' '}
                    <code className="bg-white/60 px-1 border rounded text-slate-700 font-mono text-[10px]">BREVO_SENDER_EMAIL</code>)
                    in your project environment secrets. Brevo includes 300 free emails per day with instant delivery.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1.5">
              Target Email Address
            </label>
            <input
              type="email"
              required
              value={testEmailAddress}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="Enter test destination email"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors focus:bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Enter your email (e.g. <span className="font-medium text-slate-600">{userEmail}</span> or{' '}
              <span className="font-medium text-slate-600">imsaurabhdey@gmail.com</span>) to receive the test.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? 'Sending...' : 'Send Test Mail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
