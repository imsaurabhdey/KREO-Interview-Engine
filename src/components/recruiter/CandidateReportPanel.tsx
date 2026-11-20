/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Mail,
  Phone,
  Users,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Video,
  Download
} from 'lucide-react';
import type { Assessment, Candidate } from '../../types';
import { apiFetch } from '../../utils/authFetch';

interface CandidateReportPanelProps {
  selectedCandidate: Candidate | null;
  assessments: Assessment[];
  reportActiveTab: 'overview' | 'coding' | 'transcripts';
  demoRecordingUrl: string | null;
  getExactUserName: (email?: string, fallbackName?: string) => string;
  onReportTabChange: (tab: 'overview' | 'coding' | 'transcripts') => void;
  onForceCompileReport: () => void;
  onNotifyUser: (message: string, type?: 'success' | 'dev') => void;
}

export default function CandidateReportPanel({
  selectedCandidate,
  assessments,
  reportActiveTab,
  demoRecordingUrl,
  getExactUserName,
  onReportTabChange,
  onForceCompileReport,
  onNotifyUser
}: CandidateReportPanelProps) {
  const [resolvedRecordingSrc, setResolvedRecordingSrc] = useState<string>('');
  const [recordingLoadError, setRecordingLoadError] = useState<string>('');

  const rawRecordingUrl = selectedCandidate?.recordingUrl || demoRecordingUrl || '';

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setRecordingLoadError('');

    if (!rawRecordingUrl) {
      setResolvedRecordingSrc('');
      return;
    }

    if (rawRecordingUrl.startsWith('/recordings/')) {
      setResolvedRecordingSrc('');
      apiFetch(rawRecordingUrl)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Unable to load recording (HTTP ${res.status})`);
          }
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (active) setResolvedRecordingSrc(objectUrl);
        })
        .catch((err) => {
          if (active) {
            setRecordingLoadError(err?.message || 'Unable to load protected recording.');
          }
        });
    } else {
      setResolvedRecordingSrc(rawRecordingUrl);
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rawRecordingUrl]);

  if (!selectedCandidate) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center text-slate-400 min-h-[350px] flex flex-col items-center justify-center">
        <CheckCircle className="w-12 h-12 text-slate-300 mb-4 shrink-0" />
        <h3 className="text-sm font-semibold text-slate-700">No Candidate Selected</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">
          Select a candidate card from the directory on the left to view their complete multi-dimension scorecard, dual screen recording, and downloadable transcript report.
        </p>
      </div>
    );
  }

  if (selectedCandidate.feedbackReport?.decision === 'Review Pending') {
    return (
      <div
        className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[420px] text-center space-y-6"
        id="candidate-fetching-report"
      >
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-sm font-bold text-slate-800 font-mono tracking-wide uppercase">
            Processing Active Evaluation...
          </h3>
          <p className="text-xs text-slate-500 font-sans leading-relaxed">
            AI evaluation engine is analyzing candidate transcripts, coding correctness, speech fluency, and proctoring telemetry logs.
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={onForceCompileReport}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all flex items-center gap-2 mx-auto"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" /> Force View Report Now
          </button>
        </div>
      </div>
    );
  }

  const appliedRoleTitle =
    assessments.find((a) => a.id === selectedCandidate.assessmentId)?.title || 'Applied Role';

  const fitScoreHeader =
    selectedCandidate.aiAssessmentScore !== undefined
      ? selectedCandidate.aiAssessmentScore
      : (selectedCandidate.feedbackReport?.technicalScore ?? 0);

  let computedStatus = 'Processing';
  if (selectedCandidate.status === 'In Progress' || selectedCandidate.status === 'Ongoing') {
    computedStatus = 'In Progress';
  } else if (selectedCandidate.status === 'Completed') {
    computedStatus = fitScoreHeader >= 75 ? 'Selected' : 'Not Selected';
  } else if (selectedCandidate.status === 'Suspended') {
    computedStatus = 'Not Selected';
  }

  const isCompleted = selectedCandidate.status === 'Completed';
  const fitScore = isCompleted ? fitScoreHeader : 0;
  const codingScore = isCompleted
    ? (selectedCandidate.feedbackReport?.technicalScore !== undefined
        ? selectedCandidate.feedbackReport.technicalScore
        : 0)
    : 0;
  const commScore = isCompleted
    ? (selectedCandidate.feedbackReport?.communicationScore !== undefined
        ? selectedCandidate.feedbackReport.communicationScore
        : 0)
    : 0;

  const pSum = selectedCandidate.proctoringSummary;
  const copyPaste = pSum?.copyPasteAttempts || 0;
  const tabSwitches = pSum?.tabSwitches || 0;
  const focusViolations = pSum?.browserFocusViolations || 0;
  const phoneViolations = pSum?.phoneViolations || 0;
  const exitFullscreen = pSum?.exitFullscreenCount || 0;
  const cameraOff = pSum?.cameraOffViolations || 0;
  const notVisible = pSum?.notVisibleViolations || 0;

  const penalty =
    copyPaste * 1.5 +
    tabSwitches * 1.0 +
    focusViolations * 0.5 +
    phoneViolations * 2.0 +
    exitFullscreen * 1.5 +
    cameraOff * 2.0;
  const proctoringRating = Math.max(0, Math.min(10, Math.round((10 - penalty) * 10) / 10));

  const cheatingLogs = selectedCandidate.feedbackReport?.cheatingLogs || [];
  const totalInstances =
    cheatingLogs.length +
    tabSwitches +
    focusViolations +
    exitFullscreen +
    notVisible +
    phoneViolations +
    cameraOff +
    copyPaste;

  const codingTranscripts =
    selectedCandidate.feedbackReport?.transcripts?.filter((t) => t.category === 'coding') || [];

  const handleDownloadTranscriptDoc = () => {
    const report = selectedCandidate.feedbackReport;
    if (!report || !report.transcripts) {
      onNotifyUser('No transcript data available for download yet.', 'dev');
      return;
    }

    const exportFitScore =
      selectedCandidate.aiAssessmentScore !== undefined
        ? selectedCandidate.aiAssessmentScore
        : (report.technicalScore || 75);
    const selectionLabel =
      selectedCandidate.selectionStatus || (exportFitScore >= 75 ? 'Selected' : 'Not Selected');

    let docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>`;
    docHtml += `<head><meta charset='utf-8'><title>Interview Transcript - ${selectedCandidate.name}</title>`;
    docHtml += `<style>body{font-family:Arial,sans-serif;line-height:1.5;} h1{color:#312e81;} h2{color:#4338ca;} .q{font-weight:bold;color:#1e1b4b;} .a{background:#f8fafc;padding:8px;border-left:3px solid #6366f1;margin-bottom:12px;}</style></head><body>`;
    docHtml += `<h1>kreo AI ASSESSMENT - CANDIDATE TRANSCRIPT REPORT</h1>`;
    docHtml += `<hr/>`;
    docHtml += `<p><strong>Candidate Name:</strong> ${selectedCandidate.name}</p>`;
    docHtml += `<p><strong>Email Address:</strong> ${selectedCandidate.email}</p>`;
    docHtml += `<p><strong>Phone:</strong> ${selectedCandidate.phone || 'N/A'}</p>`;
    docHtml += `<p><strong>Added By:</strong> ${getExactUserName(selectedCandidate.createdByEmail, selectedCandidate.createdByName)}</p>`;
    docHtml += `<p><strong>Overall Fitment Score:</strong> ${exportFitScore}%</p>`;
    docHtml += `<p><strong>Selection Status:</strong> ${selectionLabel}</p>`;
    docHtml += `<p><strong>Created Date:</strong> ${selectedCandidate.createdAt ? new Date(selectedCandidate.createdAt).toLocaleString() : 'N/A'}</p>`;
    docHtml += `<p><strong>Completed Date:</strong> ${selectedCandidate.completedAt ? new Date(selectedCandidate.completedAt).toLocaleString() : 'N/A'}</p>`;
    docHtml += `<hr/>`;
    docHtml += `<h2>TRANSCRIPT DIALOGUES:</h2>`;

    report.transcripts.forEach((t, i) => {
      docHtml += `<div style="margin-bottom:20px;">`;
      docHtml += `<p class="q"><strong>Question ${i + 1} [${t.category.toUpperCase()}]:</strong> ${t.questionText}</p>`;
      docHtml += `<div class="a"><strong>Candidate Answer:</strong> ${t.candidateAnswer}</div>`;
      if (t.crossQuestionText) {
        docHtml += `<p><strong>AI Follow-up Question:</strong> ${t.crossQuestionText}</p>`;
        docHtml += `<p><strong>Candidate Follow-up Answer:</strong> ${t.crossAnswerText || 'Skipped'}</p>`;
      }
      docHtml += `<p><em>Score: ${t.score}% | Evaluation: ${t.aiEvaluation}</em></p>`;
      docHtml += `</div><hr/>`;
    });

    docHtml += `</body></html>`;

    const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedCandidate.name.replace(/\s+/g, '_')}_Interview_Transcript.doc`;
    link.click();
    URL.revokeObjectURL(url);
    onNotifyUser(`Downloaded Word (.doc) transcript report for ${selectedCandidate.name} successfully.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6" id="candidate-detailed-report">
      {/* Candidate Scorecard Header */}
      <div className="border-b border-slate-100 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{selectedCandidate.name}</h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-medium">
              {appliedRoleTitle}
            </span>
          </div>

          <div className="text-xs text-slate-500 mt-2 space-y-1 font-sans">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedCandidate.email}
              </span>
              {selectedCandidate.phone && selectedCandidate.phone !== 'N/A' && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedCandidate.phone}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1 font-mono">
              <span>
                Created: <strong>{selectedCandidate.createdAt ? new Date(selectedCandidate.createdAt).toLocaleString() : 'N/A'}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Completed: <strong>{selectedCandidate.completedAt ? new Date(selectedCandidate.completedAt).toLocaleString() : 'N/A'}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-indigo-700 font-semibold flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Added by:{' '}
                {getExactUserName(selectedCandidate.createdByEmail, selectedCandidate.createdByName)}
              </span>
            </div>
          </div>
        </div>

        {/* Automated System Progress Status Display */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
              <span className="text-[10px] font-mono font-bold text-slate-500 px-2 uppercase tracking-wider">STATUS :</span>

              <div className="flex items-center gap-1 font-sans">
                <span
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                    computedStatus === 'Processing'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200/60 opacity-60'
                  }`}
                >
                  Processing
                </span>

                <span
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                    computedStatus === 'In Progress'
                      ? 'bg-blue-600 text-white border-blue-700 font-extrabold shadow-xs animate-pulse'
                      : 'bg-slate-50 text-slate-400 border-slate-200/60 opacity-60'
                  }`}
                >
                  In Progress
                </span>

                <span
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                    computedStatus === 'Selected'
                      ? 'bg-emerald-600 text-white border-emerald-700 font-extrabold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200/60 opacity-60'
                  }`}
                >
                  Selected (≥75%)
                </span>

                <span
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                    computedStatus === 'Not Selected'
                      ? 'bg-rose-600 text-white border-rose-700 font-extrabold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200/60 opacity-60'
                  }`}
                >
                  Not Selected
                </span>
              </div>
            </div>
            <span className="font-mono text-[9.5px] text-slate-400">
              System automated status based on candidate progress & <strong>75% Benchmark</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4 Main Parallel Rating Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" id="main-4-rating-cards">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
            Overall Fitment Score
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-extrabold text-indigo-600 tracking-tight">{fitScore}%</span>
            <span className="text-[10px] text-slate-400">/100</span>
          </div>
          <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${fitScore}%` }}></div>
          </div>
          <p className="text-[8px] text-slate-400 mt-1 font-mono">transcript & JD fit judgment</p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
            Coding Score
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{codingScore}%</span>
            <span className="text-[10px] text-slate-400">/100</span>
          </div>
          <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-slate-700 rounded-full" style={{ width: `${codingScore}%` }}></div>
          </div>
          <p className="text-[8px] text-slate-400 mt-1 font-mono">technical accuracy & sandbox tests</p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
            Proctoring Rating
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-extrabold tracking-tight ${proctoringRating < 7 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {proctoringRating}
            </span>
            <span className="text-[10px] text-slate-400">/10</span>
          </div>
          <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${proctoringRating < 7 ? 'bg-rose-500' : 'bg-emerald-600'}`}
              style={{ width: `${proctoringRating * 10}%` }}
            ></div>
          </div>
          <p className="text-[8px] text-slate-400 mt-1 font-mono">tab, focus & copy-paste instances</p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
            Communication Score
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{commScore}%</span>
            <span className="text-[10px] text-slate-400">/100</span>
          </div>
          <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-slate-700 rounded-full" style={{ width: `${commScore}%` }}></div>
          </div>
          <p className="text-[8px] text-slate-400 mt-1 font-mono">vocal fluency & structure</p>
        </div>
      </div>

      {/* Subcategory Tab Bar */}
      <div className="border-b border-slate-200 flex flex-wrap gap-1">
        <button
          onClick={() => onReportTabChange('overview')}
          className={`px-4 py-2 text-xs font-mono tracking-wide font-bold transition-all border-b-2 grow md:grow-0 ${
            reportActiveTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📄 Core Overview
        </button>
        <button
          onClick={() => onReportTabChange('coding')}
          className={`px-4 py-2 text-xs font-mono tracking-wide font-bold transition-all border-b-2 grow md:grow-0 ${
            reportActiveTab === 'coding'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          💻 Coding Evaluation
        </button>
        <button
          onClick={() => onReportTabChange('transcripts')}
          className={`px-4 py-2 text-xs font-mono tracking-wide font-bold transition-all border-b-2 grow md:grow-0 ${
            reportActiveTab === 'transcripts'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🗣️ Transcript
        </button>
      </div>

      {/* Subcategory Tab 1: Core Overview */}
      {reportActiveTab === 'overview' && (
        <div className="space-y-6" id="report-active-overview">
          <div className="bg-indigo-50/50 border border-indigo-150 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-indigo-700 flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-indigo-600" /> AI Core Overview & Suitability Summary
            </h4>
            <p className="text-slate-700 text-xs leading-relaxed font-sans">
              {selectedCandidate.feedbackReport?.summary ||
                `No automated evaluation summary has been compiled yet for ${selectedCandidate.name} (${appliedRoleTitle}).`}
            </p>
            <p className="text-[10px] text-slate-500 pt-1 border-t border-indigo-100/80 font-sans">
              Human Review Notice: Automated scores and summaries are screening aids only. Review the full transcript, code submission, and recording before making final hiring decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-emerald-200 bg-emerald-50/20 p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> Key Strengths
              </h4>
              {selectedCandidate.feedbackReport?.pros && selectedCandidate.feedbackReport.pros.length > 0 ? (
                <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside font-sans">
                  {selectedCandidate.feedbackReport.pros.map((p, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic font-sans">
                  No structured strength highlights were recorded for this session.
                </p>
              )}
            </div>

            <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-700 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" /> Areas of Improvement & Weaknesses
              </h4>
              {selectedCandidate.feedbackReport?.cons && selectedCandidate.feedbackReport.cons.length > 0 ? (
                <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside font-sans">
                  {selectedCandidate.feedbackReport.cons.map((c, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic font-sans">
                  No structured improvement notes were recorded for this session.
                </p>
              )}
            </div>
          </div>

          {/* Potential Gaps & Proctoring Red Flags */}
          {totalInstances === 0 ? (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-900 text-xs font-medium">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="block font-bold">Potential Gaps & Red Flags: None Detected</strong>
                Candidate completed the assessment with zero tab switches, copy-paste flags, or gaze deviations. Integrity status verified clean.
              </div>
            </div>
          ) : (
            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                Potential Gaps & Proctoring Instances Detected ({totalInstances} event{totalInstances > 1 ? 's' : ''})
              </div>
              <div className="space-y-1.5 pt-1">
                {tabSwitches > 0 && (
                  <div className="p-2 bg-white/80 border border-rose-200 rounded text-[11px] font-mono text-rose-800">
                    ⚠️ Window Focus / Tab Switch: <strong>{tabSwitches}</strong> instances logged.
                  </div>
                )}
                {exitFullscreen > 0 && (
                  <div className="p-2 bg-white/80 border border-rose-200 rounded text-[11px] font-mono text-rose-800">
                    ⚠️ Exited Fullscreen Mode: <strong>{exitFullscreen}</strong> instances logged.
                  </div>
                )}
                {copyPaste > 0 && (
                  <div className="p-2 bg-white/80 border border-rose-200 rounded text-[11px] font-mono text-rose-800">
                    ⚠️ Clipboard Action (Copy/Paste): <strong>{copyPaste}</strong> blocked attempts logged.
                  </div>
                )}
                {phoneViolations > 0 && (
                  <div className="p-2 bg-white/80 border border-rose-200 rounded text-[11px] font-mono text-rose-800">
                    🚨 Mobile Device Detected in Camera Feed: <strong>{phoneViolations}</strong> instances logged.
                  </div>
                )}
                {cameraOff > 0 && (
                  <div className="p-2 bg-white/80 border border-rose-200 rounded text-[11px] font-mono text-rose-800">
                    🚨 Camera Feed Stopped / Disabled: <strong>{cameraOff}</strong> instances logged.
                  </div>
                )}
                {notVisible > 0 && (
                  <div className="p-2 bg-white/80 border border-amber-200 bg-amber-50/50 rounded text-[11px] font-mono text-amber-900">
                    ℹ️ Observational Flag (Face Not Visible / Deviation): <strong>{notVisible}</strong> temporary instances logged (score unpenalized).
                  </div>
                )}
                {cheatingLogs.map((log, lidx) => (
                  <div key={lidx} className="p-2 bg-white/80 border border-rose-200 rounded text-[11px] font-mono text-rose-800 flex items-start gap-1.5">
                    <span>⚠️</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Dual Screen + Camera Recording Player */}
          {selectedCandidate.recordingUrl || demoRecordingUrl ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-950 text-white shadow-sm">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                  <span className="font-semibold text-emerald-300">
                    CANDIDATE DUAL RECORDING (SCREEN SHARE + CAMERA PIP OVERLAY)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {selectedCandidate.recordingDuration
                    ? `${Math.floor(selectedCandidate.recordingDuration / 60)}m ${Math.round(selectedCandidate.recordingDuration % 60)}s`
                    : 'Duration unavailable'}
                </span>
              </div>

              <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden aspect-video">
                {recordingLoadError ? (
                  <div className="p-6 text-center text-xs text-rose-300">
                    {recordingLoadError}
                  </div>
                ) : resolvedRecordingSrc ? (
                  <video
                    src={resolvedRecordingSrc}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                    preload="auto"
                  />
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Loading authenticated recording...
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-3">
                <div className="text-[10px] text-slate-400 font-mono">
                  Single composite webm video file containing screen share + camera feed.
                </div>
                {resolvedRecordingSrc && (
                  <a
                    href={resolvedRecordingSrc}
                    download={`${selectedCandidate.name.replace(/\s+/g, '_')}_Dual_Recording.webm`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white transition-all cursor-pointer font-medium shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Video File (.webm)
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 text-slate-500 flex items-center gap-3 text-xs">
              <Video className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-700">No Session Recording Available</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No video/screen recording file was uploaded for this candidate session.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subcategory Tab 2: Coding Evaluation */}
      {reportActiveTab === 'coding' && (
        <div className="space-y-6" id="report-active-coding">
          {codingTranscripts.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 font-sans text-xs">
              No dedicated coding problems were submitted for this candidate assessment.
            </div>
          ) : (
            <div className="space-y-6">
              {codingTranscripts.map((t, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                        CODING PROBLEM {idx + 1}
                        {t.codeLanguage ? ` • ${t.codeLanguage.toUpperCase()}` : ''}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 mt-0.5">{t.questionText}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold bg-indigo-50 px-2.5 py-1 rounded text-indigo-700 border border-indigo-100">
                      Score: {t.score}%
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950 font-mono text-xs text-indigo-200 space-y-1 overflow-x-auto select-all max-h-72 whitespace-pre-wrap">
                    <div className="text-slate-500 text-[10px] pb-2 border-b border-slate-800 mb-2 uppercase select-none">
                      CANDIDATE SUBMITTED CODE SOLUTION:
                    </div>
                    {t.candidateAnswer}
                  </div>

                  <div className="p-3 bg-slate-900 border-t border-slate-800 font-mono text-[10px] text-slate-300 space-y-1 whitespace-pre-wrap">
                    <div className="text-slate-500 uppercase select-none">Recorded Sandbox Execution Output:</div>
                    {t.codeExecutionOutput ? (
                      <div className="text-emerald-300">{t.codeExecutionOutput}</div>
                    ) : (
                      <div className="text-slate-400 italic">
                        No automated sandbox test execution output was recorded for this submission.
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-indigo-50/30 border-t border-slate-200">
                    <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase block mb-1">
                      AI Logic & Correctness Review
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-sans">{t.aiEvaluation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subcategory Tab 3: Transcript */}
      {reportActiveTab === 'transcripts' && (
        <div className="space-y-4" id="report-active-transcripts">
          <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-bold">
              Full Dialogue Interview Transcript
            </h4>

            <button
              onClick={handleDownloadTranscriptDoc}
              className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-mono text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto"
            >
              <Download className="w-3.5 h-3.5" /> Download Transcript (.doc)
            </button>
          </div>

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {selectedCandidate.feedbackReport?.transcripts?.map((t, idx) => (
              <div key={idx} className="p-4 bg-slate-50/60 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-indigo-600 font-bold uppercase">
                    Q{idx + 1} ({t.category.toUpperCase()})
                  </span>
                  <span className="text-slate-500">
                    Correctness Score: <strong>{t.score}%</strong>
                  </span>
                </div>
                <p className="text-xs text-slate-900 font-semibold font-sans pl-2 border-l-2 border-indigo-500">
                  "{t.questionText}"
                </p>
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <div className="text-[10px] font-mono text-slate-400 font-bold mb-1">CANDIDATE RESPONSE:</div>
                  <p className="text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
                    {t.candidateAnswer}
                  </p>
                </div>

                {t.crossQuestionText && (
                  <div className="bg-slate-100/60 p-2.5 border border-dashed border-slate-300 rounded-xl space-y-2 mt-2">
                    <div className="text-[10px] font-mono text-indigo-600 font-bold">AI FOLLOW-UP CROSS-QUESTION:</div>
                    <p className="text-xs text-slate-700 italic pl-2 border-l-2 border-indigo-300">
                      "{t.crossQuestionText}"
                    </p>
                    {t.crossAnswerText ? (
                      <>
                        <div className="text-[10px] font-mono text-slate-400 font-bold">CANDIDATE FOLLOW-UP RESPONSE:</div>
                        <p className="text-xs text-slate-700 pl-2">{t.crossAnswerText}</p>
                      </>
                    ) : (
                      <span className="text-[10px] italic text-slate-400">
                        Candidate skipped or did not complete follow-up response.
                      </span>
                    )}
                  </div>
                )}

                <div className="p-2.5 bg-indigo-50/40 border border-indigo-100 rounded-lg">
                  <div className="text-[10px] font-mono text-indigo-700 font-bold mb-1">AI SEGMENT EVALUATION:</div>
                  <p className="text-xs text-indigo-950 font-sans leading-relaxed">{t.aiEvaluation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
