/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Paperclip,
  Plus,
  ShieldAlert,
  Upload,
  Trash2,
  CheckCircle
} from 'lucide-react';
import type { Assessment } from '../../types';

export interface ExtractedCandidateDraft {
  id?: string;
  name: string;
  email: string;
  phone: string;
  experience: string;
  skills: string;
}

interface CandidateIngestionModalProps {
  isOpen: boolean;
  selectedAsmtForDetail: Assessment | null;
  assessments: Assessment[];
  selectedAssessmentId: string;
  candidateUploadTab: 'file' | 'manual';
  manualName: string;
  manualEmail: string;
  manualPhone: string;
  manualExperience: string;
  duplicateCandidateAlert: { show: boolean; message: string } | null;
  dragActive: boolean;
  isExtractingCandidates: boolean;
  extractedCandidatesList: ExtractedCandidateDraft[];
  onClose: () => void;
  onSelectAssessmentId: (id: string) => void;
  onUploadTabChange: (tab: 'file' | 'manual') => void;
  onManualNameChange: (v: string) => void;
  onManualEmailChange: (v: string) => void;
  onManualPhoneChange: (v: string) => void;
  onManualExperienceChange: (v: string) => void;
  onManualSkillsChange: (skills: string[]) => void;
  onDismissDuplicateAlert: () => void;
  onCreateManualCandidate: () => void;
  onDragActiveChange: (active: boolean) => void;
  onProcessFiles: (files: FileList) => void;
  onUpdateExtractedList: (updater: ExtractedCandidateDraft[] | ((prev: ExtractedCandidateDraft[]) => ExtractedCandidateDraft[])) => void;
  onClearExtractedFiles: () => void;
  onSaveAllExtractedCandidates: () => void;
}

export default function CandidateIngestionModal({
  isOpen,
  selectedAsmtForDetail,
  assessments,
  selectedAssessmentId,
  candidateUploadTab,
  manualName,
  manualEmail,
  manualPhone,
  manualExperience,
  duplicateCandidateAlert,
  dragActive,
  isExtractingCandidates,
  extractedCandidatesList,
  onClose,
  onSelectAssessmentId,
  onUploadTabChange,
  onManualNameChange,
  onManualEmailChange,
  onManualPhoneChange,
  onManualExperienceChange,
  onManualSkillsChange,
  onDismissDuplicateAlert,
  onCreateManualCandidate,
  onDragActiveChange,
  onProcessFiles,
  onUpdateExtractedList,
  onClearExtractedFiles,
  onSaveAllExtractedCandidates
}: CandidateIngestionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isExtractingCandidates) onClose();
        }}
      />

      <div className="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl w-full max-w-2xl z-20 transition-all duration-350 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">
              Add Candidates to Requisition
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {selectedAsmtForDetail ? `Add new candidates for "${selectedAsmtForDetail.title}".` : 'Add new candidates for assessment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
            disabled={isExtractingCandidates}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selectedAsmtForDetail && (
          <div className="mt-4">
            <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-2">
              Target Job Assessment
            </label>
            <select
              value={selectedAssessmentId || assessments[0]?.id || ''}
              onChange={(e) => onSelectAssessmentId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500/50"
            >
              {assessments.filter((a) => a.status !== 'Closed').length === 0 ? (
                <option value="">-- No active assessments yet --</option>
              ) : (
                assessments
                  .filter((a) => a.status !== 'Closed')
                  .map((asmt) => (
                    <option key={asmt.id} value={asmt.id}>
                      {asmt.title}
                    </option>
                  ))
              )}
            </select>
          </div>
        )}

        <div className="flex border-b border-slate-200 text-xs my-4 font-mono font-bold uppercase tracking-wider font-semibold">
          <button
            type="button"
            onClick={() => {
              onUploadTabChange('file');
              onUpdateExtractedList([]);
            }}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
              candidateUploadTab === 'file'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-4 h-4" /> Upload Resume
          </button>
          <button
            type="button"
            onClick={() => {
              onUploadTabChange('manual');
              onUpdateExtractedList([]);
            }}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
              candidateUploadTab === 'manual'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" /> Add Manually
          </button>
        </div>

        {candidateUploadTab === 'manual' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreateManualCandidate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => onManualNameChange(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Amit Kumar"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">
                  Email Destination
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => onManualEmailChange(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. amit.kumar@organisation.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">
                  Contact Reference
                </label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => onManualPhoneChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. +91 98765 XXXXX"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">
                  Experience Level
                </label>
                <select
                  value={manualExperience}
                  onChange={(e) => onManualExperienceChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-sans"
                >
                  <option value="Fresh Graduate">Fresh Graduate</option>
                  <option value="1-2 Years">1-2 Years</option>
                  <option value="2-4 Years">2-4 Years</option>
                  <option value="5-7 Years">5-7 Years</option>
                  <option value="8+ years">8+ Years</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">
                Extracted Core Skills (Comma Separated)
              </label>
              <input
                type="text"
                onChange={(e) =>
                  onManualSkillsChange(
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="e.g. React, Node.js, TypeScript"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {duplicateCandidateAlert?.show && (
              <div className="mb-4 p-3.5 bg-rose-900 text-white border border-rose-700 rounded-xl shadow-lg flex items-start gap-3 animate-in fade-in duration-200">
                <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 text-xs">
                  <span className="font-bold font-mono text-[10px] text-rose-200 uppercase tracking-wider block">
                    Duplicate Candidate Detected
                  </span>
                  <p className="mt-0.5 leading-relaxed text-rose-100 font-sans">
                    {duplicateCandidateAlert.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismissDuplicateAlert}
                  className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-rose-100 text-[10px] font-bold font-mono rounded-lg border border-rose-600 transition-colors cursor-pointer shrink-0"
                >
                  Close
                </button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  onDismissDuplicateAlert();
                  onClose();
                }}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {duplicateCandidateAlert?.show ? 'Back' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={Boolean(duplicateCandidateAlert?.show)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Save Candidate Link
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {duplicateCandidateAlert?.show && (
              <div className="p-3.5 bg-rose-900 text-white border border-rose-700 rounded-xl shadow-lg flex items-start gap-3 animate-in fade-in duration-200">
                <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 text-xs">
                  <span className="font-bold font-mono text-[10px] text-rose-200 uppercase tracking-wider block">
                    Duplicate Candidate Detected
                  </span>
                  <p className="mt-0.5 leading-relaxed text-rose-100 font-sans">
                    {duplicateCandidateAlert.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismissDuplicateAlert}
                  className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-rose-100 text-[10px] font-bold font-mono rounded-lg border border-rose-600 transition-colors cursor-pointer shrink-0"
                >
                  Close
                </button>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                onDragActiveChange(true);
              }}
              onDragLeave={() => onDragActiveChange(false)}
              onDrop={(e) => {
                e.preventDefault();
                onDragActiveChange(false);
                if (e.dataTransfer.files) onProcessFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center space-y-3 ${
                dragActive ? 'border-indigo-400 bg-indigo-50/15' : 'border-slate-200 bg-slate-50/20'
              }`}
            >
              <Upload className="w-8 h-8 text-indigo-500 animate-pulse" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-slate-700">Drag & drop resume attachments or bulk CSV files</p>
                <p className="text-slate-400 max-w-sm text-[11px] leading-relaxed mx-auto">
                  Supports direct PDF parses, Word documents, or roster CSV logs.
                </p>
              </div>

              <label className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-all">
                Browse Local Files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) onProcessFiles(e.target.files);
                  }}
                />
              </label>
            </div>

            {isExtractingCandidates && (
              <div className="flex items-center gap-3 justify-center p-6 text-slate-500 font-mono text-xs border border-teal-150 rounded-xl bg-indigo-50/10">
                <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full"></span>
                <span>Parsing attachments and structured extracting applicant data...</span>
              </div>
            )}

            {extractedCandidatesList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800">
                    Verified and Review Extracted Candidates ({extractedCandidatesList.length})
                  </h4>
                  <span className="text-[10px] text-slate-500 italic">Fields are 100% editable</span>
                </div>

                <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                  {extractedCandidatesList.map((cand, idx) => (
                    <div key={cand.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-mono text-slate-400">Candidate Name</label>
                          <input
                            type="text"
                            value={cand.name}
                            onChange={(e) => {
                              const copy = [...extractedCandidatesList];
                              copy[idx] = { ...copy[idx], name: e.target.value };
                              onUpdateExtractedList(copy);
                            }}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 font-medium mt-0.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-mono text-slate-400">Email</label>
                          <input
                            type="email"
                            value={cand.email}
                            onChange={(e) => {
                              const copy = [...extractedCandidatesList];
                              copy[idx] = { ...copy[idx], email: e.target.value };
                              onUpdateExtractedList(copy);
                            }}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 mt-0.5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-mono text-slate-400">Phone</label>
                          <input
                            type="text"
                            value={cand.phone}
                            onChange={(e) => {
                              const copy = [...extractedCandidatesList];
                              copy[idx] = { ...copy[idx], phone: e.target.value };
                              onUpdateExtractedList(copy);
                            }}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 mt-0.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-mono text-slate-400">Experience</label>
                          <input
                            type="text"
                            value={cand.experience}
                            onChange={(e) => {
                              const copy = [...extractedCandidatesList];
                              copy[idx] = { ...copy[idx], experience: e.target.value };
                              onUpdateExtractedList(copy);
                            }}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 mt-0.5"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-mono text-slate-400">
                          Skills Benchmarks (comma separated)
                        </label>
                        <input
                          type="text"
                          value={cand.skills}
                          onChange={(e) => {
                            const copy = [...extractedCandidatesList];
                            copy[idx] = { ...copy[idx], skills: e.target.value };
                            onUpdateExtractedList(copy);
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 mt-0.5 font-mono text-[10px]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => onUpdateExtractedList((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-red-500 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                        title="Exclude candidate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-150 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClearExtractedFiles}
                    className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Clear All Extracted
                  </button>
                  <button
                    type="button"
                    onClick={onSaveAllExtractedCandidates}
                    disabled={Boolean(duplicateCandidateAlert?.show)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle className="w-4 h-4" /> Publish and Map Profiles ({extractedCandidatesList.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
