/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Code, Terminal } from 'lucide-react';

interface CodingWorkspacePanelProps {
  selectedLanguage: string;
  codeContent: string;
  codeExecuting: boolean;
  codeConsole: string[];
  submittingAnswer: boolean;
  onLanguageChange: (language: string) => void;
  onCodeChange: (code: string) => void;
  onExecuteCode: () => void;
  onViolation: (reason: string) => void;
  onSubmitCodeAnswer: () => void;
}

export default function CodingWorkspacePanel({
  selectedLanguage,
  codeContent,
  codeExecuting,
  codeConsole,
  submittingAnswer,
  onLanguageChange,
  onCodeChange,
  onExecuteCode,
  onViolation,
  onSubmitCodeAnswer
}: CodingWorkspacePanelProps) {
  return (
    <div className="w-full flex-1 flex flex-col gap-4 mt-2">
      {/* Live code editor */}
      <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden text-left shadow-xs h-[300px]">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Code className="text-indigo-600 w-4 h-4 shrink-0" />
            <span className="text-xs font-mono text-slate-700 font-bold hidden sm:inline">Runtime:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-800 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="typescript">TypeScript / React</option>
              <option value="python">Python (v3.10+)</option>
              <option value="java">Java (JDK 15+)</option>
              <option value="cpp">C++ (GCC 10+)</option>
              <option value="csharp">C# (.NET Core / Mono)</option>
              <option value="sql">SQL (SQLite 3)</option>
              <option value="go">Go (Golang)</option>
              <option value="rust">Rust</option>
            </select>
          </div>
          <button
            onClick={onExecuteCode}
            disabled={codeExecuting}
            className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-[10px] font-mono rounded cursor-pointer transition-colors font-bold"
          >
            {codeExecuting ? 'Compiling...' : 'Run Simulation'}
          </button>
        </div>

        <textarea
          value={codeContent}
          onChange={(e) => onCodeChange(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            onViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked Inside Editor');
          }}
          onCopy={(e) => {
            e.preventDefault();
            onViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked Inside Editor');
          }}
          onCut={(e) => {
            e.preventDefault();
            onViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked Inside Editor');
          }}
          className="flex-1 w-full bg-slate-50/50 p-4 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:bg-white select-text resize-none"
          placeholder="// Enter your coding solution here..."
          spellCheck={false}
        />
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Code executes in an isolated external sandbox (max 20 KB, 15 runs / 5 min). Do not paste private keys or secrets.</span>
        </div>
      </div>

      {/* Output log terminal console */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden text-left shadow-xs min-h-[140px]">
        <div className="flex items-center gap-2 p-2.5 border-b border-slate-800 bg-slate-950 text-slate-300 text-xs font-mono">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold tracking-wider">Engine Simulation Logs</span>
        </div>

        <div className="flex-1 p-3.5 font-mono text-[11px] text-slate-300 overflow-y-auto space-y-1">
          {codeConsole.slice(-5).map((line, lidx) => (
            <div
              key={lidx}
              className={
                line.startsWith('❌') ? 'text-red-400' : line.startsWith('✅') ? 'text-emerald-400' : 'text-slate-300'
              }
            >
              {line}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onSubmitCodeAnswer}
            disabled={submittingAnswer || !codeContent.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-505 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer"
          >
            {submittingAnswer ? 'Evaluating Workspace...' : 'Submit Code Answer'}
          </button>
        </div>
      </div>
    </div>
  );
}
