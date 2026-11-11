/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Question Bank Management Component (Admin Only).
 * High-density SaaS layout for managing, curating, and importing the internal question bank.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, Plus, Upload, Download, Trash2, Edit2, ChevronDown, ChevronRight, 
  Sparkles, CheckCircle, AlertCircle, FileText, Code2, Layers, Filter, X, RefreshCw,
  Archive, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QuestionBankItem } from '../types';

interface SkillTaxonomyGroup {
  skill: string;
  total: number;
  easy: number;
  moderate: number;
  difficult: number;
  technical: number;
  coding: number;
  category?: string;
}

interface QuestionBankManagerProps {
  userEmail: string;
  notifyUser: (msg: string, type?: 'success' | 'dev') => void;
}

export default function QuestionBankManager({ userEmail, notifyUser }: QuestionBankManagerProps) {
  // State variables
  const [skills, setSkills] = useState<SkillTaxonomyGroup[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [totalRepositoryQuestions, setTotalRepositoryQuestions] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | 'Easy' | 'Moderate' | 'Difficult'>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Technical' | 'Coding'>('All');

  // Modals & Action states
  const [isImportingDefault, setIsImportingDefault] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Form states
  const [formSkill, setFormSkill] = useState<string>('');
  const [formSubTopic, setFormSubTopic] = useState<string>('');
  const [formDifficulty, setFormDifficulty] = useState<'Easy' | 'Moderate' | 'Difficult'>('Moderate');
  const [formCategory, setFormCategory] = useState<'Technical' | 'Coding'>('Technical');
  const [formQuestionText, setFormQuestionText] = useState<string>('');
  const [formSampleAnswer, setFormSampleAnswer] = useState<string>('');
  const [formRubric, setFormRubric] = useState<string>('');
  const [formStarterCode, setFormStarterCode] = useState<string>('');

  // Bulk Upload File states
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Load skill taxonomy and question list from server
  useEffect(() => {
    fetchTaxonomyAndQuestions();
  }, [selectedSkillFilter, selectedDifficulty, selectedCategory, searchQuery]);

  const fetchTaxonomyAndQuestions = async () => {
    setLoading(true);
    try {
      // 1. Fetch skill taxonomy summary
      const skillsRes = await fetch('/api/question-bank/skills');
      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        setSkills(skillsData.skills || []);
        setTotalRepositoryQuestions(skillsData.totalQuestions || 0);

        // Auto expand top 3 skills on first load
        if (skillsData.skills && skillsData.skills.length > 0) {
          const initialMap: Record<string, boolean> = {};
          skillsData.skills.slice(0, 3).forEach((s: any) => {
            initialMap[s.skill] = true;
          });
          setExpandedSkills(prev => Object.keys(prev).length === 0 ? initialMap : prev);
        }
      }

      // 2. Fetch paginated/filtered questions
      const queryParams = new URLSearchParams();
      if (selectedSkillFilter !== 'All') queryParams.set('skill', selectedSkillFilter);
      if (selectedDifficulty !== 'All') queryParams.set('difficulty', selectedDifficulty);
      if (selectedCategory !== 'All') queryParams.set('category', selectedCategory);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
      queryParams.set('limit', '10000'); // Fetch up to 10,000 matching questions for full visibility

      const qRes = await fetch(`/api/question-bank/questions?${queryParams.toString()}`);
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuestions(qData.questions || []);
      }
    } catch (err) {
      console.error('[QUESTION BANK] Error loading data:', err);
      notifyUser('Failed to connect to question bank database', 'dev');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Default Bank Ingestion from server ZIP dataset
  const handleImportDefaultBank = async () => {
    setIsImportingDefault(true);
    notifyUser('Extracting and parsing 1,000+ default questions from ZIP dataset...', 'success');

    try {
      const res = await fetch('/api/question-bank/import-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notifyUser(`Import complete! Ingested ${data.addedCount} new questions. Total Repository: ${data.totalQuestions}`);
        await fetchTaxonomyAndQuestions();
      } else {
        notifyUser(data.error || 'Failed to ingest default dataset.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Error triggering default bank dataset import.', 'dev');
    } finally {
      setIsImportingDefault(false);
    }
  };

  // Open modal to add or edit question
  const openAddOrEditModal = (item?: QuestionBankItem, defaultSkill?: string) => {
    if (item) {
      setEditingItem(item);
      setFormSkill(item.skill || '');
      setFormSubTopic(item.subTopic || '');
      setFormDifficulty(item.difficulty === 'High' ? 'Difficult' : (item.difficulty as any) || 'Moderate');
      setFormCategory(item.category === 'Coding' ? 'Coding' : 'Technical');
      setFormQuestionText(item.question || '');
      setFormSampleAnswer(item.sampleAnswer || '');
      setFormRubric(item.evaluationRubric || '');
      setFormStarterCode(item.starterCode || '');
    } else {
      setEditingItem(null);
      setFormSkill(defaultSkill || (skills[0]?.skill || 'Python'));
      setFormSubTopic('');
      setFormDifficulty('Moderate');
      setFormCategory('Technical');
      setFormQuestionText('');
      setFormSampleAnswer('');
      setFormRubric('');
      setFormStarterCode('');
    }
    setIsAddModalOpen(true);
  };

  // Save single question item (Add or Edit)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSkill.trim() || !formQuestionText.trim()) {
      notifyUser('Please specify both Skill name and Question text.', 'dev');
      return;
    }

    try {
      const payload = {
        skill: formSkill.trim(),
        subTopic: formSubTopic.trim() || undefined,
        difficulty: formDifficulty,
        category: formCategory,
        question: formQuestionText.trim(),
        sampleAnswer: formSampleAnswer.trim() || undefined,
        evaluationRubric: formRubric.trim() || undefined,
        starterCode: formStarterCode.trim() || undefined
      };

      let res;
      if (editingItem) {
        res = await fetch(`/api/question-bank/questions/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/question-bank/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        notifyUser(editingItem ? 'Question updated successfully!' : 'New question saved to bank!');
        setIsAddModalOpen(false);
        await fetchTaxonomyAndQuestions();
      } else {
        notifyUser(data.error || 'Failed to save question item.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Failed to save question to server.', 'dev');
    }
  };

  // Delete question item
  const handleDeleteQuestion = async (id: string, qText: string) => {
    if (!window.confirm(`Are you sure you want to delete this question?\n\n"${qText.substring(0, 80)}..."`)) {
      return;
    }

    try {
      const res = await fetch(`/api/question-bank/questions/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        notifyUser('Question deleted from bank.');
        await fetchTaxonomyAndQuestions();
      } else {
        notifyUser('Failed to delete question item.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Server communication error during deletion.', 'dev');
    }
  };

  // Handle Bulk Upload file submission
  const handleBulkFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      notifyUser('Please select a CSV, JSON, ZIP, DOC, or PDF file to upload.', 'dev');
      return;
    }

    setIsUploading(true);
    notifyUser(`Parsing file "${uploadFile.name}"...`, 'success');

    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const resStr = reader.result as string;
          const commaIdx = resStr.indexOf(',');
          resolve(commaIdx !== -1 ? resStr.substring(commaIdx + 1) : resStr);
        };
        reader.readAsDataURL(uploadFile);
      });

      const res = await fetch('/api/question-bank/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: uploadFile.name,
          fileData: base64Data,
          fileType: uploadFile.type
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notifyUser(`File parsed! Ingested ${data.addedCount} questions into Question Bank.`);
        setIsUploadModalOpen(false);
        setUploadFile(null);
        await fetchTaxonomyAndQuestions();
      } else {
        notifyUser(data.error || 'Failed to parse uploaded file.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Error parsing bulk upload file.', 'dev');
    } finally {
      setIsUploading(false);
    }
  };

  // Group questions by skill for the accordion
  const questionsBySkill = useMemo(() => {
    const map: Record<string, QuestionBankItem[]> = {};
    questions.forEach(q => {
      const skillName = q.skill || 'General';
      if (!map[skillName]) map[skillName] = [];
      map[skillName].push(q);
    });
    return map;
  }, [questions]);

  // Filter skill taxonomy list based on selectedSkillFilter and searchQuery
  const displayedSkills = useMemo(() => {
    let list = skills;
    if (selectedSkillFilter !== 'All') {
      list = list.filter(s => s.skill.toLowerCase() === selectedSkillFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const qLower = searchQuery.trim().toLowerCase();
      list = list.filter(s => 
        s.skill.toLowerCase().includes(qLower) || 
        (questionsBySkill[s.skill] && questionsBySkill[s.skill].length > 0)
      );
    }
    return list;
  }, [skills, selectedSkillFilter, searchQuery, questionsBySkill]);

  // Toggle accordion expansion for a skill header
  const toggleSkillAccordion = (skillName: string) => {
    setExpandedSkills(prev => ({
      ...prev,
      [skillName]: !prev[skillName]
    }));
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 pb-16">
      {/* HEADER BANNER & ACTION BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Question Bank Repository</span>
                </h2>
                <p className="text-xs text-slate-500 font-sans">
                  Centralized repository of role & skill-wise technical and coding assessment questions.
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
              id="btn-bulk-upload-questions"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bulk Upload (CSV, ZIP, DOC, PDF)</span>
            </button>

            <button
              onClick={() => openAddOrEditModal()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
              id="btn-add-single-question"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        {/* METRICS & REPOSITORY STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">Repository Questions</span>
            <span className="text-base font-bold text-slate-900 font-mono tabular-nums">{totalRepositoryQuestions.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">Skills & Tracks</span>
            <span className="text-base font-bold text-indigo-600 font-mono tabular-nums">{skills.length}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">Technical Concept Pool</span>
            <span className="text-base font-bold text-slate-800 font-mono tabular-nums">
              {skills.reduce((acc, s) => acc + s.technical, 0).toLocaleString()}
            </span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">Coding Challenges</span>
            <span className="text-base font-bold text-emerald-600 font-mono tabular-nums">
              {skills.reduce((acc, s) => acc + s.coding, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER CONTROLS WITH DEDICATED SKILL-WISE FILTER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          
          {/* Skill Selector Dropdown */}
          <div className="md:col-span-4 space-y-1">
            <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              <Filter className="w-3 h-3 text-indigo-600" /> Filter By Skill ({skills.length})
            </label>
            <select
              value={selectedSkillFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSkillFilter(val);
                if (val !== 'All') {
                  setExpandedSkills(prev => ({ ...prev, [val]: true }));
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              id="select-qbank-skill-filter"
            >
              <option value="All">⚡ All Skills Track ({skills.length} Skills / {totalRepositoryQuestions.toLocaleString()} Qs)</option>
              {skills.map((s) => (
                <option key={s.skill} value={s.skill}>
                  {s.skill} ({s.total} question{s.total > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="md:col-span-4 space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Search Questions & Concepts
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search question text, answers, subtopics..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
                id="input-qbank-search"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Difficulty & Category Segmented Controls */}
          <div className="md:col-span-4 flex flex-wrap items-center gap-2 justify-start md:justify-end">
            <div className="space-y-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Difficulty
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
                {(['All', 'Easy', 'Moderate', 'Difficult'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-[11px] ${
                      selectedDifficulty === diff 
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Category
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
                {(['All', 'Technical', 'Coding'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-[11px] ${
                      selectedCategory === cat 
                        ? 'bg-white text-indigo-600 shadow-2xs font-semibold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Skill Pills Bar */}
        {skills.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">Popular Skills:</span>
            <button
              onClick={() => setSelectedSkillFilter('All')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedSkillFilter === 'All'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All ({totalRepositoryQuestions.toLocaleString()})
            </button>
            {skills.slice(0, 15).map((s) => (
              <button
                key={s.skill}
                onClick={() => {
                  setSelectedSkillFilter(s.skill);
                  setExpandedSkills(prev => ({ ...prev, [s.skill]: true }));
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  selectedSkillFilter.toLowerCase() === s.skill.toLowerCase()
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {s.skill} <span className="opacity-70 text-[10px]">({s.total})</span>
              </button>
            ))}
          </div>
        )}

        {/* Active Filters Summary Bar */}
        {(selectedSkillFilter !== 'All' || selectedDifficulty !== 'All' || selectedCategory !== 'All' || searchQuery.trim() !== '') && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase font-bold">Active Filters:</span>
              
              {selectedSkillFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-indigo-200">
                  Skill: <strong>{selectedSkillFilter}</strong>
                  <button onClick={() => setSelectedSkillFilter('All')} className="hover:text-indigo-950 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}

              {selectedDifficulty !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-slate-200">
                  Difficulty: <strong>{selectedDifficulty}</strong>
                  <button onClick={() => setSelectedDifficulty('All')} className="hover:text-slate-950 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}

              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-slate-200">
                  Category: <strong>{selectedCategory}</strong>
                  <button onClick={() => setSelectedCategory('All')} className="hover:text-slate-950 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}

              {searchQuery.trim() !== '' && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-amber-200">
                  Search: <strong>"{searchQuery}"</strong>
                  <button onClick={() => setSearchQuery('')} className="hover:text-amber-950 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedSkillFilter('All');
                setSelectedDifficulty('All');
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* SKILL TAXONOMY & QUESTION ACCORDION LIST */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-xs text-slate-500 font-mono">Loading Question Bank repository...</p>
        </div>
      ) : displayedSkills.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-150 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-900">No Questions or Skills Match Current Filters</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try resetting skill or difficulty filters or search keywords.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedSkillFilter('All');
              setSelectedDifficulty('All');
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedSkills.map((skillGroup) => {
            const skillName = skillGroup.skill;
            const isExpanded = Boolean(expandedSkills[skillName]);
            const skillQuestions = questionsBySkill[skillName] || [];

            return (
              <div 
                key={skillName} 
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-2xs"
              >
                {/* SKILL HEADER ROW */}
                <div 
                  onClick={() => toggleSkillAccordion(skillName)}
                  className="p-4 bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer flex items-center justify-between gap-4 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{skillName}</span>
                        <span className="text-[10px] font-mono bg-white text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 font-semibold">
                          {skillGroup.category || 'Technology'}
                        </span>
                      </h3>
                      {/* Quiet unboxed metadata */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{skillGroup.total} questions</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-600 font-medium">{skillGroup.easy} Easy</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-600 font-medium">{skillGroup.moderate} Moderate</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-600 font-medium">{skillGroup.difficult} Difficult</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openAddOrEditModal(undefined, skillName)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Add to {skillName}</span>
                    </button>
                  </div>
                </div>

                {/* EXPANDED QUESTIONS LIST */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-200 divide-y divide-slate-100 p-4 space-y-3"
                    >
                      {skillQuestions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-mono">
                          No matching questions for current filters. Expand or clear search query.
                        </div>
                      ) : (
                        skillQuestions.map((q) => {
                          const diff = q.difficulty === 'High' ? 'Difficult' : q.difficulty;
                          const diffColor = 
                            diff === 'Easy' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : diff === 'Difficult' 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200';

                          return (
                            <div 
                              key={q.id} 
                              className="p-4 bg-white border border-slate-150 rounded-xl space-y-2 hover:border-indigo-200 transition-colors"
                            >
                              {/* Top Question Row Metadata */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border font-bold ${diffColor}`}>
                                    {diff}
                                  </span>
                                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                                    {q.category}
                                  </span>
                                  {q.subTopic && (
                                    <span className="text-xs text-slate-500 font-mono truncate max-w-xs">
                                      {q.subTopic}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openAddOrEditModal(q)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Question"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(q.id, q.question)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Question"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Question Body */}
                              <p className="text-xs font-semibold text-slate-900 leading-relaxed whitespace-pre-line">
                                {q.question}
                              </p>

                              {/* Sample Answer / Rubric */}
                              {q.sampleAnswer && (
                                <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs space-y-1">
                                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 block">
                                    Sample Answer / Evidence Rubric
                                  </span>
                                  <p className="text-slate-700 text-[11px] leading-relaxed">
                                    {q.sampleAnswer}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT QUESTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-150 pb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{editingItem ? 'Edit Question Bank Item' : 'Add Question to Repository'}</span>
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">
                    Skill Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSkill}
                    onChange={(e) => setFormSkill(e.target.value)}
                    placeholder="e.g. Python, React, Java, PostgreSQL..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">
                    Sub-Topic / Competency
                  </label>
                  <input
                    type="text"
                    value={formSubTopic}
                    onChange={(e) => setFormSubTopic(e.target.value)}
                    placeholder="e.g. Concurrency, JVM execution, React hooks..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">
                    Difficulty Tier
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Difficult">Difficult</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">
                    Category Type
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                  >
                    <option value="Technical">Technical Concept</option>
                    <option value="Coding">Coding Challenge</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">
                  Question Text *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formQuestionText}
                  onChange={(e) => setFormQuestionText(e.target.value)}
                  placeholder="Enter the complete question prompt..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">
                  Sample Answer / Evaluation Rubric
                </label>
                <textarea
                  rows={3}
                  value={formSampleAnswer}
                  onChange={(e) => setFormSampleAnswer(e.target.value)}
                  placeholder="Provide key points or expected answer criteria..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                >
                  {editingItem ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-150 pb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Bulk Upload Question Bank File</span>
              </h3>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkFileUpload} className="space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed">
                Upload custom question datasets (.csv, .zip, .json, .jsonl, .doc, .pdf). Questions will be automatically parsed, categorized by skill, and appended to your internal repository.
              </p>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2 hover:border-indigo-400 transition-colors bg-slate-50/50">
                <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto" />
                <div className="text-slate-600 font-medium">
                  {uploadFile ? uploadFile.name : 'Select or drop a question file'}
                </div>
                <input
                  type="file"
                  accept=".csv,.zip,.json,.jsonl,.doc,.docx,.pdf,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white rounded-xl font-semibold shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white animate-spin rounded-full"></span>
                      <span>Parsing & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ingest into Repository</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
