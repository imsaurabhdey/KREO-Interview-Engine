/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, CheckCircle } from 'lucide-react';
import type { Assessment, Candidate } from '../../types';

interface InterviewFinishedScreenProps {
  candidate: Candidate;
  assessment: Assessment;
}

export default function InterviewFinishedScreen({ candidate, assessment }: InterviewFinishedScreenProps) {
  return (
    <div
      className="w-full h-full overflow-y-auto py-8 md:py-12 flex flex-col items-center bg-slate-900 justify-center text-white"
      id="step-finished-wrapper"
    >
      <div className="max-w-md w-full px-4" id="step-finished">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl"
        >
          {candidate.status === 'Suspended' ? (
            <>
              <div className="w-16 h-16 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                <ShieldAlert className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-xl font-display font-medium text-slate-100 tracking-tight">Assessment Terminated</h3>
              <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                The secure exam proctor engine has halted your session due to recurring workspace focus violations.
              </p>
              <div className="mt-4 p-4 bg-red-950/20 rounded-xl border border-red-500/10 text-left font-mono text-[10px] text-red-400 space-y-1">
                <div>Status: HIGH CHEATING RISK SUSPENSION</div>
                <div>Reason: Workspace Security Violation</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-display font-medium text-emerald-300 tracking-tight">Assessment Completed</h3>
              <p className="text-slate-300 text-xs mt-2.5 leading-relaxed">
                Thank you! Your interview with <strong>kreo Software</strong> has completed successfully. We have captured all assessment transcripts, code sandbox solutions, and proctor parameters securely.
              </p>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mt-4 text-xs text-slate-400 text-left space-y-1">
                <div>
                  Candidate Name: <strong className="text-slate-200">{candidate?.name}</strong>
                </div>
                <div>
                  Mapped Role: <strong className="text-slate-200">{assessment?.title}</strong>
                </div>
                <div>
                  System Link: <strong className="text-slate-200">Connection Closed Safely</strong>
                </div>
              </div>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest animate-pulse">
              Safe To Close This Tab
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              All active monitors have deactivated. Please close your tab or window.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
