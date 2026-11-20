/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Cpu,
  ArrowRight,
  Camera,
  Mic,
  Monitor,
  AlertTriangle,
  Play
} from 'lucide-react';
import type { Assessment, Candidate } from '../../types';

interface WelcomeScreenProps {
  candidate: Candidate;
  assessment: Assessment;
  onProceed: () => void;
}

export function WelcomeScreen({ candidate, assessment, onProceed }: WelcomeScreenProps) {
  return (
    <div className="w-full h-full overflow-y-auto py-8 md:py-12 flex flex-col items-center" id="step-welcome-wrapper">
      <div className="max-w-3xl w-full px-4 md:px-8" id="step-welcome">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex gap-2 items-center mb-6 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
            <Cpu className="w-4 h-4" /> Assessment Portal
          </div>

          <h1 className="text-3xl font-display font-bold text-slate-800 leading-tight">
            Welcome, {candidate.name}
          </h1>

          <p className="text-slate-600 text-sm mt-3">You have an interview scheduled.</p>

          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 mt-4 shadow-sm">
            <p className="text-[10px] text-indigo-500 font-mono font-bold tracking-wider uppercase">For the Role</p>
            <h3 className="text-xl font-bold text-indigo-950 mt-1">{assessment.title}</h3>
            <div className="flex items-center gap-2 mt-3 text-xs text-indigo-700">
              <span className="px-2.5 py-0.5 bg-white border border-indigo-100 rounded-full font-semibold shadow-xs">
                Level: L1 interview
              </span>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-3.5">
              Assessment Section Structure:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between text-left">
                <div>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold rounded-md">
                    Step 01
                  </span>
                  <h5 className="text-xs font-bold text-slate-800 mt-2">1. Technical Depth</h5>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Comprehensive inquiry targeting core engineering principles, system design paradigms, and domain-specific knowledge.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between text-left">
                <div>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold rounded-md">
                    Step 02
                  </span>
                  <h5 className="text-xs font-bold text-slate-800 mt-2">2. Coding Challenge</h5>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Practical problem solving exercise containing starter code templates to assess syntax implementation, logic, and test safety.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
              Security & Proctor Rules:
            </h4>
            <ul className="text-xs text-slate-600 space-y-2.5 font-sans pl-1 text-left">
              <li className="flex gap-2 items-start">
                <span className="text-indigo-500 shrink-0 mt-0.5">●</span>
                <span>Ensure your web camera is turned on and fully active during the entire assessment.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-indigo-500 shrink-0 mt-0.5">●</span>
                <span>You must remain positioned directly in front of the camera at all times during the session.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-indigo-500 shrink-0 mt-0.5">●</span>
                <span className="font-semibold text-slate-700">
                  Do not change tabs or minimize windows. Doing so triggers a proctor security log with immediate auto-failure safeguards.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={onProceed}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-colors"
              id="btn-confirm-start"
            >
              Proceed to Security Checks <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PermissionsScreenProps {
  hasCam: boolean | null;
  hasMic: boolean | null;
  hasScreenShare: boolean | null;
  isSyntheticCamera: boolean;
  webStream: MediaStream | null;
  bindVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestPermissions: () => void;
  onProceed: () => void;
}

export function PermissionsScreen({
  hasCam,
  hasMic,
  hasScreenShare,
  isSyntheticCamera,
  webStream,
  bindVideoRef,
  onRequestPermissions,
  onProceed
}: PermissionsScreenProps) {
  return (
    <div className="w-full h-full overflow-y-auto py-8 md:py-12 flex flex-col items-center" id="step-permissions-wrapper">
      <div className="max-w-xl w-full px-4" id="step-permissions">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-display font-semibold text-slate-900">System Device Inspection</h2>
          <p className="text-xs text-slate-600 mt-2">
            kreo AI Engine security requires access to high-definition video feeds to track gaze tracking logs and eye-movement flags.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Web Camera Feed</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Required for AI proctor face match</p>
                </div>
              </div>
              <div className="text-xs">
                {hasCam ? (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-mono font-bold">PERMITTED</span>
                ) : (
                  <button
                    onClick={onRequestPermissions}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-mono font-bold"
                  >
                    ALLOW
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Microphone Input</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Required for AI speech transcribe</p>
                </div>
              </div>
              <div className="text-xs">
                {hasMic ? (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-mono font-bold">PERMITTED</span>
                ) : (
                  <button
                    onClick={onRequestPermissions}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-mono font-bold cursor-pointer"
                  >
                    ALLOW
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
                    Screen Sharing Authorization
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Required for workspace proctoring & screen recording</p>
                </div>
              </div>
              <div className="text-xs">
                {hasScreenShare ? (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-mono font-bold">PERMITTED</span>
                ) : hasScreenShare === false ? (
                  <button
                    onClick={onRequestPermissions}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-mono font-bold cursor-pointer"
                  >
                    RE-ALLOW
                  </button>
                ) : (
                  <button
                    onClick={onRequestPermissions}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-mono font-bold cursor-pointer"
                  >
                    ALLOW
                  </button>
                )}
              </div>
            </div>
          </div>

          {hasCam && (
            <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 relative aspect-video shadow-md">
              <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 bg-indigo-600 border border-indigo-400 text-white font-mono text-[9px] font-bold rounded-md tracking-wider flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>SELF CAMERA CALIBRATION</span>
              </div>
              {isSyntheticCamera || !webStream ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 animate-pulse">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                    SIMULATION BACKEND DIRECT FEED
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">Camera Active / Ready for Alignment</p>
                </div>
              ) : (
                <video
                  ref={bindVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                  style={{ filter: 'none' }}
                />
              )}
              <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] bg-slate-900/80 text-slate-300 py-1 px-3 rounded-lg font-mono">
                Sitting Position Check: Mirror View (kreo AI Engine Secured Calibration)
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-500 font-mono mt-4 text-center px-4">
            * Privacy Guard: System operates with local streaming structures. Screen share and video streams are processed exclusively for assessment verification.
          </p>

          <button
            disabled={!hasCam || !hasMic || hasScreenShare === false}
            onClick={onProceed}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-6 transition-colors shadow-sm cursor-pointer"
            id="confirm-permissions"
          >
            Verify Proctored Mode <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProctorCheckScreenProps {
  hasCam: boolean | null;
  isSyntheticCamera: boolean;
  webStream: MediaStream | null;
  bindVideoRef: (el: HTMLVideoElement | null) => void;
  onTriggerFullScreen: () => void;
}

export function ProctorCheckScreen({
  hasCam,
  isSyntheticCamera,
  webStream,
  bindVideoRef,
  onTriggerFullScreen
}: ProctorCheckScreenProps) {
  return (
    <div className="w-full h-full overflow-y-auto py-8 md:py-12 flex flex-col items-center" id="step-proctor-wrapper">
      <div className="max-w-xl w-full px-4" id="step-proctor">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl text-center">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
            <Monitor className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-display font-semibold text-slate-900">Trigger Fullscreen Proctored Space</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto mt-2 leading-relaxed">
            To proceed to the assessment, the platform must take over screen layout focus. Fullscreen mode ensures tab switching constraints are persistent.
          </p>

          {hasCam && (
            <div className="mt-6 mb-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 relative aspect-video shadow-md max-w-sm mx-auto">
              <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 bg-indigo-600 border border-indigo-400 text-white font-mono text-[9px] font-bold rounded-md tracking-wider flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ALIGN YOUR FACE</span>
              </div>

              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-32 h-40 border-2 border-indigo-400/40 border-dashed rounded-[50%/40%] flex items-center justify-center animate-pulse">
                  <div className="w-28 h-36 border border-indigo-400/20 border-dashed rounded-[50%/40%]"></div>
                </div>
              </div>

              {isSyntheticCamera || !webStream ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 animate-pulse">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                    AI STANDBY CALIBRATOR
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">Please align facial features</p>
                </div>
              ) : (
                <video
                  ref={bindVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                  style={{ filter: 'none' }}
                />
              )}
              <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] bg-slate-900/80 text-indigo-200 py-1 px-3 rounded-lg font-mono">
                Ensure your face is centered inside the guides.
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs rounded-xl max-w-sm mx-auto text-left flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <span className="font-semibold">Disclaimer: This assessment requires a full web browser window.</span>
            </div>
            <ul className="list-disc pl-7 space-y-1 text-[11px] text-yellow-800">
              <li>Please close all background browser tabs and apps now.</li>
              <li>Ensure you are in a quiet room with adequate facial lighting.</li>
              <li>
                Attempting to exit the fullscreen secured window, resizing the page, or switching windows will automatically log critical proctor security flags.
              </li>
            </ul>
          </div>

          <button
            onClick={onTriggerFullScreen}
            className="w-full py-3 max-w-xs mx-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-8 transition-colors shadow-sm"
            id="fullscreen-trigger"
          >
            Enter Secured Interface <Play className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
