/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, Plus, Copy, Check, FileText, ChevronRight, UserMinus, 
  Trash2, ShieldAlert, Cpu, Sparkles, CheckCircle, Clock, Search, ExternalLink,
  BookOpen, BarChart3, Star, AlertCircle, ShieldCheck, ChevronDown, Eye, X,
  Lock, Unlock, ArrowLeft, Upload, ArrowRight, Edit2, MoreVertical, Mail,
  Phone, MapPin, Download, FileSpreadsheet, Paperclip, Monitor, LogOut,
  Play, Pause, Video
} from 'lucide-react';
import { motion } from 'motion/react';
import { Assessment, Candidate, Question, QuestionCategory } from '../types';
import CandidateExperience from './CandidateExperience';
import SafeStorage from '../utils/safeStorage';
import { apiFetch } from '../utils/authFetch';
import { searchUniversalSkills, POPULAR_SKILL_PRESETS, UNIVERSAL_SKILLS_DATABASE } from '../data/universalSkills';
import QuestionBankManager from './QuestionBankManager';
import ChangePasswordModal from './recruiter/ChangePasswordModal';
import TestEmailModal from './recruiter/TestEmailModal';
import UsersManagementTab from './recruiter/UsersManagementTab';
import CandidateIngestionModal from './recruiter/CandidateIngestionModal';
import CandidateReportPanel from './recruiter/CandidateReportPanel';

interface RecruiterPortalProps {
  userRole: 'Admin' | 'Recruiter';
  userEmail: string;
  onLogout: () => void;
}

export default function RecruiterPortal({ userRole, userEmail, onLogout }: RecruiterPortalProps) {
  // Navigation tabs - default focus on assessments panel
  const [activeTab, setActiveTab] = useState<'assessments' | 'candidates' | 'reports' | 'question_bank' | 'users' | 'test_env'>('assessments');
  const [isAddAssessmentOpen, setIsAddAssessmentOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedAsmtForDetail, setSelectedAsmtForDetail] = useState<Assessment | null>(null);
  
  // Custom states for candidates upload inside assessment details
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateUploadTab, setCandidateUploadTab] = useState<'manual' | 'file'>('file');
  const [candidateFiles, setCandidateFiles] = useState<{name: string; data: string; type: string}[]>([]);
  const [extractedCandidatesList, setExtractedCandidatesList] = useState<any[]>([]);
  const [isExtractingCandidates, setIsExtractingCandidates] = useState(false);
  const [uploadedRefName, setUploadedRefName] = useState('');
  const [localActiveMenuCandId, setLocalActiveMenuCandId] = useState<string | null>(null);
  
  // Custom single candidate fields for manual add option
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualExperience, setManualExperience] = useState('2-4 Years');
  const [manualLocation, setManualLocation] = useState('Bengaluru, India');
  const [manualSkills, setManualSkills] = useState<string[]>([]);

  // Unified global data state loaded from state API
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Duplicate candidate alert state & real-time check
  const [duplicateCandidateAlert, setDuplicateCandidateAlert] = useState<{ show: boolean; message: string; duplicateField?: string } | null>(null);

  // Real-time live check for manual candidate additions against existing candidates
  useEffect(() => {
    if (!manualEmail.trim() && !manualPhone.trim()) {
      setDuplicateCandidateAlert(null);
      return;
    }
    const cleanE = manualEmail.trim().toLowerCase();
    const cleanP = manualPhone.trim().replace(/\D/g, '');

    const matchByEmail = cleanE ? candidates.find(c => c.email && c.email.trim().toLowerCase() === cleanE) : undefined;
    const matchByPhone = (cleanP && cleanP.length >= 7) ? candidates.find(c => c.phone && c.phone !== 'N/A' && c.phone.trim().replace(/\D/g, '') === cleanP) : undefined;

    if (matchByEmail || matchByPhone) {
      const fieldDesc = (matchByEmail && matchByPhone) ? 'email address and phone number' : (matchByEmail ? 'email address' : 'phone number');
      const matchedName = (matchByEmail || matchByPhone)?.name;
      setDuplicateCandidateAlert({
        show: true,
        message: `Candidate already exists with this ${fieldDesc}${matchedName ? ` (${matchedName})` : ''} in the system.`
      });
    } else {
      setDuplicateCandidateAlert(null);
    }
  }, [manualEmail, manualPhone, candidates]);

  // Account settings states & Profile Dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [isChangingPasswordSubmitting, setIsChangingPasswordSubmitting] = useState(false);

  // Test email client states
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(userEmail);
  const [isTestEmailSubmitting, setIsTestEmailSubmitting] = useState(false);
  const [testEmailError, setTestEmailError] = useState('');
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; mode: 'sent' | 'simulated'; error?: string } | null>(null);

  const handleTestEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestEmailError('');
    setTestEmailResult(null);

    if (!testEmailAddress) {
      setTestEmailError('Please provide a valid email address.');
      return;
    }

    setIsTestEmailSubmitting(true);
    try {
      const target = testEmailAddress.trim();
      const res = await apiFetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toEmail: target,
          email: target,
          candidateName: 'Test Recruiter'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger test email.');
      }

      setTestEmailResult(data);
    } catch (err: any) {
      console.error(err);
      setTestEmailError(err.message || 'Failed to dispatch test email.');
    } finally {
      setIsTestEmailSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setChangePasswordError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError('New passwords do not match confirmation.');
      return;
    }

    if (newPassword.length < 6) {
      setChangePasswordError('New password must be at least 6 characters.');
      return;
    }

    setIsChangingPasswordSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setChangePasswordSuccess('Success! Password has been securely updated.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setChangePasswordSuccess('');
      }, 1500);
    } catch (err: any) {
      setChangePasswordError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsChangingPasswordSubmitting(false);
    }
  };

  // Search filter
  const [candidateSearch, setCandidateSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');

  // JD configuration states
  const [jdTitle, setJdTitle] = useState('');
  const [jdRoleLevel, setJdRoleLevel] = useState('Mid-Level');
  const [jdExperience, setJdExperience] = useState('Engineer');
  const [jdText, setJdText] = useState('');
  const [techCount, setTechCount] = useState(15);
  const [codingCount, setCodingCount] = useState(3);
  const [generatingAssessment, setGeneratingAssessment] = useState(false);
  const [roundsEnabled, setRoundsEnabled] = useState<{ tech: boolean; coding: boolean; hr?: boolean }>({
    tech: true,
    coding: true,
  });

  // Pre-defined locations for searchable multi-select up to 3-4 options
  const PREDEFINED_LOCATIONS = [
    "North India Pool (Delhi, Noida, Gurugram)",
    "South India Pool (Bengaluru, Chennai, Hyderabad)",
    "West India Pool (Mumbai, Pune)",
    "East India Pool (Kolkata)",
    "Bengaluru, India",
    "Delhi NCR, India",
    "Noida, India",
    "Gurugram, India",
    "Hyderabad, India",
    "Chennai, India",
    "Mumbai, India",
    "Pune, India",
    "Kolkata, India",
    "Remote (India)",
    "Global Remote"
  ];

  // Multi-step assessment wizard states
  const [asmtStep, setAsmtStep] = useState<1 | 2 | 3>(1);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [jdInputType, setJdInputType] = useState<'paste' | 'upload'>('paste');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [questionsPreview, setQuestionsPreview] = useState<(Question & { selected: boolean })[]>([]);
  const [draftAssessmentId, setDraftAssessmentId] = useState<string | null>(null);

  // Skills extractor states
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [mandatorySkills, setMandatorySkills] = useState<string[]>([]);
  const [goodToHaveSkills, setGoodToHaveSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedSkillPreset, setSelectedSkillPreset] = useState<string | null>(null);
  const [dynamicAiSuggestions, setDynamicAiSuggestions] = useState<{ name: string; category?: string; related: string[] }[]>([]);
  const [isSearchingAiSkills, setIsSearchingAiSkills] = useState(false);
  const [selectedBankTab, setSelectedBankTab] = useState<'tech' | 'coding'>('tech');

  // Debounced real-time server-side AI skill discovery
  useEffect(() => {
    const trimmed = skillSearch.trim();
    if (trimmed.length < 2) {
      setDynamicAiSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingAiSkills(true);
        const res = await apiFetch(`/api/assessments/skills/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.aiSuggestions && Array.isArray(data.aiSuggestions)) {
            setDynamicAiSuggestions(data.aiSuggestions);
          }
        }
      } catch (e) {
        // silent fallback
      } finally {
        setIsSearchingAiSkills(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [skillSearch]);

  // Manual questions states on Step 3
  const [showAddManualTech, setShowAddManualTech] = useState(false);
  const [showAddManualCoding, setShowAddManualCoding] = useState(false);
  const [manualTechText, setManualTechText] = useState('');
  const [manualTechDiff, setManualTechDiff] = useState<'Easy' | 'Moderate' | 'High'>('Moderate');
  const [manualTechSkill, setManualTechSkill] = useState('');
  const [manualCodingText, setManualCodingText] = useState('');
  const [manualCodingDiff, setManualCodingDiff] = useState<'Easy' | 'Moderate' | 'High'>('Moderate');
  const [manualCodingAnswer, setManualCodingAnswer] = useState('');
  const [manualCodingSkill, setManualCodingSkill] = useState('');

  // Assessment filter & candidate mapping states
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');

  // Selected details modal / side view states
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [reportActiveTab, setReportActiveTab] = useState<'overview' | 'coding' | 'transcripts' | 'compliance'>('overview');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copingInviteUrl, setCopingInviteUrl] = useState<string | null>(null);
  const [demoRecordingUrl, setDemoRecordingUrl] = useState<string | null>(null);

  useEffect(() => {
    setDemoRecordingUrl(null);
    const candId = selectedCandidate?.id;
    if (!candId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/candidates/${encodeURIComponent(candId)}`);
        if (!cancelled && res.ok) {
          const fullCandidate: Candidate = await res.json();
          setSelectedCandidate(prev => (prev && prev.id === candId ? fullCandidate : prev));
        }
      } catch (err) {
        console.error('[CANDIDATE DETAIL] Failed to load full candidate record:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCandidate?.id]);

  // Success notifications
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'dev'; text: string } | null>(null);

  // User Accounts administration state (Only available for Admin)
  const [accounts, setAccounts] = useState<any[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Admin' | 'Recruiter'>('Recruiter');
  const [newUserOrg, setNewUserOrg] = useState('');

  const loadAccountsFromBackend = async () => {
    if (userRole !== 'Admin') return;
    try {
      const res = await apiFetch('/api/auth/users');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }
        try {
          const list = await res.json();
          setAccounts(list);
        } catch (jsonErr) {
          console.error('[AUTH] Failed to parse users list JSON', jsonErr);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getExactUserName = (email?: string, defaultName?: string): string => {
    const targetEmail = (email || userEmail || '').toLowerCase().trim();
    
    // 1. First check if targetEmail matches a user account
    if (targetEmail) {
      const matched = accounts.find(a => (a.email || '').toLowerCase().trim() === targetEmail);
      if (matched && matched.name && matched.name.trim() && !['admin', 'system admin', 'recruiter', 'system recruiter', 'undefined', 'null'].includes(matched.name.toLowerCase().trim())) {
        return matched.name.trim();
      }
    }

    // 2. Check provided name if not generic
    if (defaultName && defaultName.trim() && !['admin', 'system admin', 'recruiter', 'system recruiter', 'undefined', 'null'].includes(defaultName.toLowerCase().trim())) {
      if (defaultName.includes('.') || defaultName.includes('_')) {
        return defaultName.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }
      return defaultName.trim();
    }

    // 3. Fallback: Format email username nicely (e.g. saurabh.dey@kreosoftware.com -> Saurabh Dey)
    if (targetEmail) {
      const username = targetEmail.split('@')[0];
      const parts = username.split(/[._-]/);
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    return 'Saurabh Dey';
  };

  const handleToggleUserRole = async (emailToToggle: string) => {
    try {
      const res = await apiFetch(`/api/auth/users/${encodeURIComponent(emailToToggle)}/toggle-role`, {
        method: 'POST'
      });
      if (res.ok) {
        notifyUser(`User role updated successfully for ${emailToToggle}!`);
        await loadAccountsFromBackend();
      } else {
        const data = await res.json();
        notifyUser(data.error || 'Failed to toggle user role', 'dev');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUserAccount = async (emailToDelete: string) => {
    if (emailToDelete.toLowerCase() === 'saurabh.dey@irissoftware.com') {
      notifyUser('Primary Admin account cannot be deleted or unseated.', 'dev');
      return;
    }
    if (emailToDelete.toLowerCase() === userEmail.toLowerCase()) {
      notifyUser('You cannot delete your currently active session account profile.', 'dev');
      return;
    }

    try {
      const res = await apiFetch(`/api/auth/users/${encodeURIComponent(emailToDelete)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        notifyUser(`Account ${emailToDelete} removed from enterprise registry.`);
        await loadAccountsFromBackend();
      } else {
        const data = await res.json();
        notifyUser(data.error || 'Failed to delete account', 'dev');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      notifyUser('Required user details are missing.');
      return;
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.toLowerCase().trim(),
          password: newUserPassword,
          role: newUserRole,
          orgName: newUserOrg.trim() || 'kreo Software Authorized Account'
        })
      });

      if (res.ok) {
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserOrg('');
        setIsAddUserModalOpen(false);
        notifyUser(`Corporate profile initialized for ${newUserName.trim()} as ${newUserRole}!`);
        await loadAccountsFromBackend();
      } else {
        const data = await res.json();
        notifyUser(data.error || 'Failed to register account', 'dev');
      }
    } catch (error) {
      console.error(error);
      notifyUser('Connection failure occurred during registration.', 'dev');
    }
  };

  useEffect(() => {
    loadAccountsFromBackend();
  }, [activeTab]); // reload whenever active tab switches or component mounts

  useEffect(() => {
    loadAccountsFromBackend();
    fetchDbState();
  }, []);

  // Automate silent background poller if any candidate has status "Review Pending"
  useEffect(() => {
    const hasPending = candidates.some(c => c.feedbackReport?.decision === 'Review Pending');
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDbState(false);
    }, 4500); // Check database every 4.5 seconds

    return () => clearInterval(interval);
  }, [candidates]);

  // Keep selectedCandidate synced when fresh background summary updates arrive,
  // while preserving full transcripts loaded from GET /api/candidates/:id
  useEffect(() => {
    if (!selectedCandidate) return;
    const updated = candidates.find(c => c.id === selectedCandidate.id);
    if (!updated) return;

    const statusChanged =
      updated.status !== selectedCandidate.status ||
      updated.feedbackReport?.decision !== selectedCandidate.feedbackReport?.decision ||
      updated.selectionStatus !== selectedCandidate.selectionStatus;

    if (statusChanged) {
      (async () => {
        try {
          const res = await apiFetch(`/api/candidates/${encodeURIComponent(updated.id)}`);
          if (res.ok) {
            const fullDetail: Candidate = await res.json();
            setSelectedCandidate(prev => (prev && prev.id === updated.id ? fullDetail : prev));
          }
        } catch (err) {
          console.warn('[RecruiterPortal] Background candidate detail refresh failed:', err);
        }
      })();
    }
  }, [candidates, selectedCandidate]);

  const fetchDbState = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [asmtRes, candRes] = await Promise.all([
        apiFetch('/api/assessments'),
        apiFetch('/api/candidates')
      ]);

      if (asmtRes.ok) {
        const sAssessments: Assessment[] = await asmtRes.json();
        setAssessments(Array.isArray(sAssessments) ? sAssessments : []);
        if (Array.isArray(sAssessments) && sAssessments.length > 0) {
          setSelectedAssessmentId(prev => {
            if (prev && sAssessments.some(a => a.id === prev)) return prev;
            return sAssessments[0].id;
          });
        } else {
          setSelectedAssessmentId('');
        }
      }

      if (candRes.ok) {
        const sCandidates: Candidate[] = await candRes.json();
        setCandidates(Array.isArray(sCandidates) ? sCandidates : []);
      }
    } catch (e) {
      console.error('Failed to load workspace records', e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const notifyUser = (text: string, type: 'success' | 'dev' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4000);
  };

  // STEP 1: Extract Skills from pasted or uploaded JD text
  const handleExtractSkills = async (passedJdText?: string) => {
    const textToSubmit = passedJdText || jdText;
    if (!textToSubmit.trim()) {
      notifyUser('Please paste or upload a Job Description spec first.');
      return;
    }

    setGeneratingAssessment(true);
    try {
      const res = await apiFetch('/api/assessments/extract-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jdTitle || `${jdRoleLevel} Requisition`,
          roleLevel: jdRoleLevel,
          experienceRequired: jdExperience,
          jdText: textToSubmit
        })
      });

      if (res.ok) {
        const data = await res.json();
        const extracted = data.skillsExtracted || [];
        setExtractedSkills(extracted);
        // By default, mark all extracted skills as Mandatory
        setMandatorySkills(extracted);
        setGoodToHaveSkills([]);
        setAsmtStep(2); // Progress to Step 2: Skills Extractions & Marks!
        notifyUser(`JD specifications analyzed! Extracted ${extracted.length} core skills.`);
      } else {
        notifyUser('An error occurred during Gemini JD skill extraction.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Could not connect to skill extraction service. Using fallback skills.', 'dev');
      const fallback = ['TypeScript', 'Node.js', 'SQL', 'React', 'Problem Solving'];
      setExtractedSkills(fallback);
      setMandatorySkills(fallback);
      setGoodToHaveSkills([]);
      setAsmtStep(2);
    } finally {
      setGeneratingAssessment(false);
    }
  };

  const MASTER_SKILLS_LIST = UNIVERSAL_SKILLS_DATABASE;

  const handleAddSkillByName = (name: string) => {
    if (!name.trim()) return;
    const s = name.trim();
    if (!extractedSkills.some(e => e.toLowerCase() === s.toLowerCase())) {
      setExtractedSkills(prev => [...prev, s]);
      setMandatorySkills(prev => [...prev, s]);
      notifyUser(`Appended skill target: "${s}".`);
    } else {
      notifyUser(`"${s}" is already in your skills criteria.`);
    }
  };

  const handleAddSearchSkill = () => {
    if (!skillSearch.trim()) return;
    handleAddSkillByName(skillSearch);
    setSkillSearch('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setExtractedSkills(prev => prev.filter(s => s !== skillToRemove));
    setMandatorySkills(prev => prev.filter(s => s !== skillToRemove));
    setGoodToHaveSkills(prev => prev.filter(s => s !== skillToRemove));
    notifyUser(`Removed skill criteria: "${skillToRemove}"`);
  };

  const toggleSkillRequirement = (skill: string, type: 'mandatory' | 'goodToHave') => {
    if (type === 'mandatory') {
      if (!mandatorySkills.includes(skill)) {
        setMandatorySkills(prev => [...prev, skill]);
        setGoodToHaveSkills(prev => prev.filter(s => s !== skill));
      }
    } else {
      if (!goodToHaveSkills.includes(skill)) {
        setGoodToHaveSkills(prev => [...prev, skill]);
        setMandatorySkills(prev => prev.filter(s => s !== skill));
      }
    }
  };

  const handleEditAssessment = (asmt: Assessment) => {
    setDraftAssessmentId(asmt.id);
    setJdTitle(asmt.title || '');
    setJdText(asmt.jdText || '');
    setJdRoleLevel(asmt.roleLevel || 'Mid-Level');
    setJdExperience(asmt.experienceRequired || 'Engineer');
    setSelectedLocations(asmt.locations || []);
    setExtractedSkills(asmt.skillsExtracted || [...(asmt.mandatorySkills || []), ...(asmt.goodToHaveSkills || [])]);
    setMandatorySkills(asmt.mandatorySkills || []);
    setGoodToHaveSkills(asmt.goodToHaveSkills || []);
    
    if (asmt.questions) {
      setQuestionsPreview(asmt.questions.map(q => ({ ...q, selected: true })));
    } else {
      setQuestionsPreview([]);
    }
    
    setTechCount(asmt.techCount || 5);
    setCodingCount(asmt.codingCount || 2);
    setRoundsEnabled(asmt.roundsEnabled || { tech: true, coding: true });
    
    setAsmtStep(1);
    setIsAddAssessmentOpen(true);
    notifyUser(`Opened editor for "${asmt.title}" assessment.`);
  };

  // STEP 2: Generate extensive questions bank from configured skills
  const handleGenerateQuestionsFromSkills = async () => {
    if (mandatorySkills.length === 0 && goodToHaveSkills.length === 0) {
      notifyUser('Required: Please add or select at least one skill.', 'dev');
      return;
    }

    setGeneratingAssessment(true);
    try {
      const res = await apiFetch('/api/assessments/generate-from-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jdTitle || `${jdRoleLevel} Skill Requisition`,
          roleLevel: jdRoleLevel,
          experienceRequired: jdExperience,
          jdText: jdText.trim() || 'Custom curated requirements set',
          mandatorySkills,
          goodToHaveSkills,
          settings: {
            techCount,
            codingCount
          },
          roundsEnabled
        })
      });

      if (res.ok) {
        const newAsmt = await res.json();
        setDraftAssessmentId(newAsmt.id);

        // Immediately track new assessment in state so it is never lost
        setAssessments(prev => {
          const filtered = prev.filter(a => a.id !== newAsmt.id);
          return [newAsmt, ...filtered];
        });

        // Pre-select all generated pool questions by default so candidates are evaluated from the entire pool
        const processed = newAsmt.questions.map((q: any) => ({ ...q, selected: true }));

        setQuestionsPreview(processed);
        setTechCount(15);
        setCodingCount(3);

        // Default manual selection dropdown helpers
        const allSkillsKeys = [...mandatorySkills, ...goodToHaveSkills];
        if (allSkillsKeys.length > 0) {
          setManualTechSkill(allSkillsKeys[0]);
          setManualCodingSkill(allSkillsKeys[0]);
        }

        setAsmtStep(3); // Progress to Step 3: Customize assessment pool!
        notifyUser('Successfully generated extensive candidate question bank.');
      } else {
        notifyUser('Could not synthesize question bank configuration.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Service error composing question bank.', 'dev');
    } finally {
      setGeneratingAssessment(false);
    }
  };

  // Step 1 Form standard trigger fallback
  const handleGenerateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleExtractSkills();
  };

  // Step 3 Finalize & Publish configurations to live
  const handleFinalizeAndPublish = async () => {
    if (!draftAssessmentId) return;

    // Filter down to only selected questions and strip transient properties
    const selectedSet = questionsPreview
      .filter(q => q.selected)
      .map(({ selected, ...rest }) => rest);

    if (selectedSet.length === 0) {
      notifyUser('Required: Please select or append at least one question to the pool bank.', 'dev');
      return;
    }

    setGeneratingAssessment(true);
    try {
      const res = await apiFetch(`/api/assessments/${draftAssessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jdTitle || `${jdRoleLevel} Skill Requisition`,
          status: 'Published',
          questions: selectedSet,
          techCount,
          codingCount,
          mandatorySkills,
          goodToHaveSkills,
          skillsExtracted: [...mandatorySkills, ...goodToHaveSkills],
          locations: selectedLocations,
          roundsEnabled
        })
      });

      if (res.ok) {
        const publishedAsmt = await res.json();
        notifyUser('Requisition Published! Dynamic randomised candidate evaluations are live.');
        
        // Immediately reflect the published assessment in the UI state
        setAssessments(prev => {
          const filtered = prev.filter(a => a.id !== publishedAsmt.id);
          return [publishedAsmt, ...filtered];
        });

        // Ensure navigation shows the active assessments list
        setActiveTab('assessments');
        setSelectedAsmtForDetail(null);
        setSelectedAssessmentId(publishedAsmt.id);

        // Clear wizard states
        setJdTitle('');
        setJdText('');
        setSelectedLocations([]);
        setUploadedFileName('');
        setExtractedSkills([]);
        setMandatorySkills([]);
        setGoodToHaveSkills([]);
        setQuestionsPreview([]);
        setDraftAssessmentId(null);
        setAsmtStep(1);
        setIsAddAssessmentOpen(false);
        fetchDbState(false);
      } else {
        notifyUser('Failed to publish assessment configurations.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Connection error finalizing role requisition configuration.', 'dev');
    } finally {
      setGeneratingAssessment(false);
    }
  };

  // Toggle active / closed status of skill requisitions (to archieve/close or reopen skill requisitions)
  const handleUpdateAssessmentStatus = async (id: string, status: 'Draft' | 'Published' | 'Closed') => {
    try {
      const res = await apiFetch(`/api/assessments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        notifyUser(status === 'Closed' ? 'Skill Requisition closed. No further interviews can be taken for this skill.' : 'Skill Requisition successfully reopened and published.');
        fetchDbState();
      } else {
        notifyUser('Failed to update requisition status.', 'dev');
      }
    } catch (e) {
      console.error(e);
      notifyUser('Network error updating requisition status.', 'dev');
    }
  };

  const handleAddManualTech = () => {
    if (!manualTechText.trim()) return;
    const skillToTarget = manualTechSkill || mandatorySkills[0] || goodToHaveSkills[0] || 'General Tech';
    const customQ: Question & { selected: boolean } = {
      id: `q-custom-tech-${Date.now()}`,
      category: 'tech',
      difficulty: manualTechDiff,
      question: manualTechText.trim(),
      targetedSkill: skillToTarget,
      selected: true
    };
    setQuestionsPreview(prev => [...prev, customQ]);
    setManualTechText('');
    setShowAddManualTech(false);
    setTechCount(prev => prev + 1);
    notifyUser(`Custom technical question targeting ${skillToTarget} appended successfully!`);
  };

  const handleAddManualCoding = () => {
    if (!manualCodingText.trim()) return;
    const langToTarget = manualCodingSkill || mandatorySkills[0] || goodToHaveSkills[0] || 'General Coding';
    const customQ: Question & { selected: boolean } = {
      id: `q-custom-code-${Date.now()}`,
      category: 'coding',
      difficulty: manualCodingDiff,
      question: manualCodingText.trim(),
      suggestedAnswer: manualCodingAnswer || '// Write your template logic code here\n',
      targetedSkill: langToTarget,
      selected: true
    };
    setQuestionsPreview(prev => [...prev, customQ]);
    setManualCodingText('');
    setManualCodingAnswer('');
    setShowAddManualCoding(false);
    setCodingCount(prev => prev + 1);
    notifyUser(`Custom coding challenge targeting ${langToTarget} appended successfully!`);
  };

  // Action to map single manual candidate under active detail view or candidates tab
  const handleCreateManualCandidateForDetail = async () => {
    const targetAsmtId = selectedAsmtForDetail?.id || selectedAssessmentId || (assessments[0]?.id || '');
    if (!manualName.trim() || !manualEmail.trim()) {
      notifyUser('Required details (Name and Email) are missing.', 'dev');
      return;
    }
    if (!targetAsmtId) {
      notifyUser('Please select or create an assessment role first before adding candidates.', 'dev');
      return;
    }

    if (duplicateCandidateAlert?.show) {
      return; // Disable further process
    }

    try {
      const res = await apiFetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName.trim(),
          email: manualEmail.trim(),
          phone: manualPhone.trim() || 'N/A',
          assessmentId: targetAsmtId,
          experience: manualExperience || '2-4 Years',
          location: manualLocation.trim() || 'Remote',
          skillsExtracted: manualSkills
        })
      });

      const data = await res.json();

      if (res.ok) {
        const added: Candidate = data;
        setCandidates(prev => [added, ...prev.filter(c => c.id !== added.id)]);
        setManualName('');
        setManualEmail('');
        setManualPhone('');
        setDuplicateCandidateAlert(null);
        setIsCandidateModalOpen(false);
        notifyUser(`Candidate ${added.name} successfully registered & mapped to requisition!`);
        fetchDbState(false);
      } else {
        if (res.status === 409 || data.duplicate) {
          setDuplicateCandidateAlert({
            show: true,
            message: data.error || 'Candidate already exists with this email or phone number in the system.'
          });
        } else {
          notifyUser(data.error || 'Failed to register candidate.', 'dev');
        }
      }
    } catch (err) {
      console.error(err);
      notifyUser('Network error mapping manual candidate.', 'dev');
    }
  };

  // Convert uploaded files to base64 and parse them via our AI system
  const handleProcessCandidateFiles = async (filesToProcess: FileList | File[]) => {
    if (filesToProcess.length === 0) return;
    setIsExtractingCandidates(true);
    notifyUser('Analyzing candidate file contents and compiling profile schemas...', 'success');

    try {
      const parsedFiles: {name: string, data: string, type: string}[] = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const resultStr = reader.result as string;
            const commaIndex = resultStr.indexOf(',');
            resolve(commaIndex !== -1 ? resultStr.substring(commaIndex + 1) : resultStr);
          };
          reader.readAsDataURL(file);
        });

        parsedFiles.push({
          name: file.name,
          data: base64Data,
          type: file.type
        });
      }

      const targetAsmtId = selectedAsmtForDetail?.id || selectedAssessmentId || (assessments[0]?.id || '');

      const res = await apiFetch('/api/candidates/extract-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: parsedFiles,
          assessmentId: targetAsmtId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.candidates && data.candidates.length > 0) {
          // Initialize draft candidate edit lists
          setExtractedCandidatesList(data.candidates.map((cand: any, idx: number) => ({
            id: `draft-${Date.now()}-${idx}`,
            name: cand.name || 'John Doe',
            email: cand.email || 'candidate@domain.com',
            phone: cand.phone || 'N/A',
            experience: cand.experience || '2-4 Years',
            location: cand.location || 'Remote',
            skills: Array.isArray(cand.skills) ? cand.skills.join(', ') : (cand.skills || '')
          })));
          notifyUser('AI parsing succeeded! Verify and edit candidate schemas below before publishing.');
        } else {
          notifyUser('Zero profiles extracted from uploaded attachments. Content might be non-readable or unsupported.', 'dev');
        }
      } else {
        let errText = `Status ${res.status}`;
        if (res.status === 413) {
          errText = 'File is too large for parsing limit.';
        }
        notifyUser(`AI parsing pipeline failed: ${errText}`, 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Error compiling attachment base64 mappings.', 'dev');
    } finally {
      setIsExtractingCandidates(false);
    }
  };

  // Save the complete reviewed and edited candidate array to the backend
  const handleSaveAllExtractedCandidates = async () => {
    const targetAsmtId = selectedAsmtForDetail?.id || selectedAssessmentId || (assessments[0]?.id || '');
    if (extractedCandidatesList.length === 0) return;
    if (!targetAsmtId) {
      notifyUser('Please select or create an assessment before adding candidates.', 'dev');
      return;
    }

    // Pre-check for duplicate candidates in extracted list against existing candidates
    for (const draft of extractedCandidatesList) {
      const cleanE = (draft.email || '').trim().toLowerCase();
      const cleanP = (draft.phone || '').trim().replace(/\D/g, '');

      const matchE = cleanE ? candidates.find(c => c.email && c.email.trim().toLowerCase() === cleanE) : undefined;
      const matchP = (cleanP && cleanP.length >= 7) ? candidates.find(c => c.phone && c.phone !== 'N/A' && c.phone.trim().replace(/\D/g, '') === cleanP) : undefined;

      if (matchE || matchP) {
        const fieldDesc = (matchE && matchP) ? 'email address and phone number' : (matchE ? 'email address' : 'phone number');
        setDuplicateCandidateAlert({
          show: true,
          message: `Candidate "${draft.name}" already exists with this ${fieldDesc} in the system.`
        });
        return; // Disable further process
      }
    }
    
    notifyUser(`Registering ${extractedCandidatesList.length} applicant accounts. Please wait...`);

    let successCount = 0;
    const addedBatch: Candidate[] = [];
    try {
      for (const draft of extractedCandidatesList) {
        const res = await apiFetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: draft.name,
            email: draft.email,
            phone: draft.phone,
            assessmentId: targetAsmtId,
            experience: draft.experience,
            location: draft.location,
            skillsExtracted: typeof draft.skills === 'string' ? draft.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : (draft.skills || [])
          })
        });

        const data = await res.json();

        if (res.ok) {
          const added: Candidate = data;
          addedBatch.push(added);
          successCount++;
        } else if (res.status === 409 || data.duplicate) {
          setDuplicateCandidateAlert({
            show: true,
            message: data.error || `Candidate "${draft.name}" already exists in the system.`
          });
          break; // Stop further batch process on duplicate error
        }
      }

      if (addedBatch.length > 0) {
        setCandidates(prev => {
          const newIds = new Set(addedBatch.map(c => c.id));
          return [...addedBatch, ...prev.filter(c => !newIds.has(c.id))];
        });
      }

      if (successCount > 0) {
        notifyUser(`Success! Registered ${successCount} candidates and generated access tokens.`);
        setExtractedCandidatesList([]);
        setCandidateFiles([]);
        setDuplicateCandidateAlert(null);
        setIsCandidateModalOpen(false);
        fetchDbState(false);
      }
    } catch (err) {
      console.error(err);
      notifyUser('Network error registering multi-person batch list.', 'dev');
    }
  };

  // Dispatch Invitation to Candidate
  const handleInviteCandidate = async (candId: string, email: string) => {
    try {
      const res = await apiFetch(`/api/candidates/${candId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Candidate Invited' })
      });
      if (res.ok) {
        notifyUser(`Invitation mail dispatched to candidate: ${email}`);
        fetchDbState();
      } else {
        notifyUser('Failed to update candidate invitation status.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Network error sending candidate invitation.', 'dev');
    }
  };

  // Update candidate selection status
  const handleUpdateSelectionStatus = async (candId: string, selectionStatus: 'Selected' | 'Not Selected' | 'Processing' | 'In Progress') => {
    try {
      const res = await apiFetch(`/api/candidates/${candId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionStatus })
      });
      if (res.ok) {
        notifyUser(`Candidate status updated to ${selectionStatus}`);
        await res.json();
        setCandidates(prev => prev.map(c => c.id === candId ? { ...c, selectionStatus } : c));
        if (selectedCandidate && selectedCandidate.id === candId) {
          setSelectedCandidate(prev => prev ? { ...prev, selectionStatus } : null);
        }
      } else {
        notifyUser('Failed to update selection status.', 'dev');
      }
    } catch (err) {
      console.error(err);
      notifyUser('Network error updating selection status.', 'dev');
    }
  };

  // Delete candidate
  const handleDeleteCandidate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const res = await apiFetch(`/api/candidates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCandidates(prev => prev.filter(c => c.id !== id));
        if (selectedCandidate?.id === id) {
          setSelectedCandidate(null);
        }
        notifyUser('Candidate mapping deleted successfully.');
      }
    } catch (e) {
      console.error(e);
      notifyUser('Error deleting candidate record.', 'dev');
    }
  };

  // Delete Assessment (Admin Only — verified server-side via session token)
  const handleDeleteAssessment = async (id: string) => {
    if (userRole !== 'Admin') {
      notifyUser('Access Denied: Only Administrators are authorized to delete assessments.', 'dev');
      return;
    }

    try {
      const res = await apiFetch(`/api/assessments/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setAssessments(prev => prev.filter(a => a.id !== id));
        notifyUser('Assessment successfully deleted.');
        fetchDbState();
      } else {
        const data = await res.json();
        notifyUser(data.error || 'Failed to delete assessment.', 'dev');
      }
    } catch (e) {
      console.error(e);
      notifyUser('Error deleting assessment.', 'dev');
    }
  };

  // Copy candidate link helper
  const handleCopyUrl = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const appUrl = window.location.origin;
    const directUrl = `${appUrl}/?token=${token}`;
    navigator.clipboard.writeText(directUrl);
    setCopingInviteUrl(token);
    setTimeout(() => setCopingInviteUrl(null), 1500);
  };

  const handleForceCompileReport = async () => {
    if (!selectedCandidate) return;
    try {
      const updatedReport = {
        ...(selectedCandidate.feedbackReport || {}),
        decision: 'Hire',
        summary: selectedCandidate.feedbackReport?.summary || 'Candidate evaluation compiled successfully.',
        technicalScore: selectedCandidate.feedbackReport?.technicalScore || 78,
        communicationScore: selectedCandidate.feedbackReport?.communicationScore || 80,
        problemSolvingScore: selectedCandidate.feedbackReport?.problemSolvingScore || 75
      };
      const res = await apiFetch(`/api/candidates/${selectedCandidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Completed',
          feedbackReport: updatedReport,
          aiAssessmentScore: 78
        })
      });
      if (res.ok) {
        notifyUser('Report force-compiled successfully!');
        fetchDbState();
      } else {
        throw new Error('Server update failed');
      }
    } catch (e) {
      const updated = {
        ...selectedCandidate,
        status: 'Completed',
        aiAssessmentScore: 78,
        feedbackReport: {
          ...(selectedCandidate.feedbackReport || {}),
          decision: 'Hire',
          technicalScore: 78,
          communicationScore: 80,
          problemSolvingScore: 75
        }
      };
      setSelectedCandidate(updated as any);
      setCandidates(prev => prev.map(c => c.id === updated.id ? (updated as any) : c));
      notifyUser('Report force-compiled locally.');
    }
  };

  const getStatusColor = (status: Candidate['status']) => {
    switch (status) {
      case 'Pending': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Invite Pending': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Invited': return 'bg-indigo-50/50 text-indigo-700 border-indigo-200';
      case 'Candidate Invited': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'In Progress': return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'Ongoing': return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Suspended': return 'bg-red-50 text-red-700 border-red-200 font-semibold';
      case 'Pending & Incomplete': return 'bg-orange-50 text-orange-700 border-orange-200 font-medium';
      case 'Pending and Incomplete': return 'bg-orange-50 text-orange-700 border-orange-200 font-medium';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(candidateSearch.toLowerCase()) || 
    c.email.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    (c.phone && c.phone.toLowerCase().includes(candidateSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 selection:bg-indigo-600 selection:text-white" id="recruiter-portal">
      {/* Dynamic System Message Notifications */}
      {alertMsg && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm" id="toast-notif">
          <div className={`p-4 rounded-xl shadow-lg border-l-4 flex items-start gap-3 bg-white ${
            alertMsg.type === 'dev' 
              ? 'border-amber-500 text-slate-800 border-y border-r border-slate-200 shadow-slate-200/50' 
              : 'border-indigo-600 text-slate-800 border-y border-r border-slate-200 shadow-slate-200/50'
          }`}>
            {alertMsg.type === 'dev' ? (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold text-slate-900">{alertMsg.type === 'dev' ? 'Operation Alert' : 'System Success'}</p>
              <p className="text-[11px] text-slate-600 mt-1">{alertMsg.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Light Header Navbar */}
      <nav className="bg-white/85 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-45">
        <div className="flex items-center gap-3">
          <svg 
            viewBox="0 0 100 100" 
            className="w-10 h-10 shrink-0 select-none mr-1" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M 53 88 L 88 53 L 53 18 L 41 18 L 76 53 L 41 88 Z" 
              fill="#2349a0" 
            />
            <path 
              d="M 47 12 L 12 47 L 47 82 L 59 82 L 24 47 L 59 12 Z" 
              fill="#2349a0" 
            />
          </svg>
          <div>
            <h1 className="text-sm font-display font-bold text-slate-900 tracking-wider">
              KREO <span className="text-indigo-600">AI Engine</span>
            </h1>
            <span className="text-[10px] text-slate-400 font-mono block tracking-widest uppercase">
              Proctored Interview Workspace
            </span>
          </div>
        </div>

        {/* Workspace controls */}
        <div className="flex gap-4 items-center">
          <div className="hidden md:flex bg-slate-100 border border-slate-200 p-1 rounded-xl items-center gap-1">
            <button
              onClick={() => setActiveTab('assessments')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'assessments' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="nav-assessments-btn"
            >
              <Briefcase className="w-3.5 h-3.5" /> Assessment
            </button>

            <button
              onClick={() => setActiveTab('candidates')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'candidates' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Manage Candidate
            </button>
 
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'reports' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Candidate Feedback
            </button>
 
            {userRole === 'Admin' && (
              <>
                <button
                  onClick={() => setActiveTab('question_bank')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    activeTab === 'question_bank' 
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="nav-question-bank-btn"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Question Bank
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    activeTab === 'users' 
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="nav-users-btn"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Manage User ID
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('test_env')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'test_env' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="nav-test-env-btn"
            >
              <Monitor className="w-3.5 h-3.5" /> Configure Testing Env
            </button>
          </div>

          <div className="relative flex items-center gap-3 border-l border-slate-200 pl-4 text-xs font-sans">
            <div className="text-right flex flex-col items-end">
              <span className="block text-[9px] text-slate-400 uppercase tracking-wider font-mono" id="nav-active-user-span">
                Active user ({userRole})
              </span>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="block text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-all cursor-pointer flex items-center gap-1 focus:outline-none"
                id="active-user-email-btn"
              >
                <span>{getExactUserName(userEmail)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {/* Profile dropdown */}
              {profileDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-11 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 text-left text-xs font-sans">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <span className="block text-[9px] text-slate-400 uppercase font-mono tracking-wider">Signed in as</span>
                      <span className="block font-semibold text-slate-700 break-all">{userEmail}</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setIsChangePasswordOpen(true);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setTestEmailAddress(userEmail);
                        setTestEmailError('');
                        setTestEmailResult(null);
                        setIsTestEmailOpen(true);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Test Email Connection</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-medium transition-colors flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Tab bar for mobile layout */}
      <div className="md:hidden flex bg-white px-4 py-2 border-b border-slate-200 gap-2 overflow-x-auto justify-center">
        <button
          onClick={() => setActiveTab('assessments')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
            activeTab === 'assessments' ? 'bg-indigo-55 text-indigo-750 font-bold' : 'text-slate-500'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Assessment
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
            activeTab === 'candidates' ? 'bg-indigo-55 text-indigo-750 font-bold' : 'text-slate-500'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Manage Candidate
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
            activeTab === 'reports' ? 'bg-indigo-55 text-indigo-750 font-bold' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Candidate Feedback
        </button>

        {userRole === 'Admin' && (
          <>
            <button
              onClick={() => setActiveTab('question_bank')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
                activeTab === 'question_bank' ? 'bg-indigo-55 text-indigo-750 font-bold' : 'text-slate-500'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Question Bank
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
                activeTab === 'users' ? 'bg-indigo-55 text-indigo-750 font-bold' : 'text-slate-500'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Manage User ID
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('test_env')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
            activeTab === 'test_env' ? 'bg-indigo-55 text-indigo-750 font-bold' : 'text-slate-500'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" /> Configure Testing Env
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
          <span className="w-8 h-8 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full mb-3"></span>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Compiling database registers...</p>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto p-4 md:p-6" id="portal-workspace">
          
          {/* TAB: QUESTION BANK (ADMIN ONLY) */}
          {userRole === 'Admin' && activeTab === 'question_bank' && (
            <QuestionBankManager
              userEmail={userEmail}
              notifyUser={notifyUser}
            />
          )}

          {/* TAB 1: ALL REGISTERED CANDIDATES */}
          {activeTab === 'candidates' && (
            <div className="space-y-6" id="candidates-container">
              
              {/* Candidates Workspace List Column */}
              <div className="w-full">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  {/* Search and Filters */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <div className="flex-1">
                      <h2 className="text-base font-bold text-slate-900">Active Candidates Activity</h2>
                      <p className="text-xs text-slate-500">Track and monitor candidate invite tokens, submission progress, and live logs</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-full md:w-64">
                        <input
                          type="text"
                          value={candidateSearch}
                          onChange={(e) => setCandidateSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="Filter candidates list..."
                          id="candidate-search-input"
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedAsmtForDetail(null);
                          setSelectedAssessmentId(assessments[0]?.id || '');
                          setCandidateFiles([]);
                          setExtractedCandidatesList([]);
                          setManualName('');
                          setManualEmail('');
                          setManualPhone('');
                          setIsCandidateModalOpen(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm shadow-indigo-600/10 cursor-pointer whitespace-nowrap"
                        id="add-candidate-main-btn"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Candidates
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3" id="candidate-items-list">
                    {filteredCandidates.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 italic text-xs border border-dashed border-slate-200 rounded-xl">
                        No candidates found registered under current search filter parameters.
                      </div>
                    ) : (
                      filteredCandidates.map(c => {
                        const relatedAsmt = assessments.find(a => a.id === c.assessmentId);
                        
                        return (
                          <div 
                            key={c.id}
                            onClick={() => {
                              if (c.status === 'Completed' || c.status === 'Suspended' || c.status === 'Pending and Incomplete' || c.status === 'Pending & Incomplete') {
                                setSelectedCandidate(c);
                                setActiveTab('reports');
                              } else {
                                notifyUser('Detailed feedback reports generate automatically upon completed, suspended, or partially completed sessions.');
                              }
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                              selectedCandidate?.id === c.id 
                                ? 'bg-indigo-50/40 border-indigo-200' 
                                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="space-y-1.5 flex-1 pr-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-slate-900">{c.name}</h4>
                                <span className={`text-[9px] font-mono uppercase px-2 py-0.5 border rounded-full ${getStatusColor(c.status)}`}>
                                  {c.status}
                                </span>
                                {(() => {
                                  const selStatus = c.selectionStatus || 'Processing';
                                  if (selStatus === 'Selected') {
                                    return (
                                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                                        Selected
                                      </span>
                                    );
                                  } else if (selStatus === 'Not Selected') {
                                    return (
                                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-850 border border-rose-200 font-bold">
                                        Not Selected
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                                        Processing
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                              <p className="text-[11px] text-slate-600 font-sans tracking-wide">
                                Email: <strong>{c.email}</strong> {c.phone && c.phone !== 'N/A' && `| Contact: ${c.phone}`}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[10px] text-indigo-700 font-sans font-medium">
                                  {relatedAsmt ? relatedAsmt.title : 'Unmapped Role'}
                                </span>
                                <span>·</span>
                                <span>Added by <strong className="text-slate-600 font-semibold">{getExactUserName(c.createdByEmail, c.createdByName)}</strong> ({c.createdByEmail || userEmail})</span>
                                <span>·</span>
                                <span>{c.createdAt ? new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                              {/* Direct assessment link */}
                              <button
                                onClick={(e) => handleCopyUrl(c.token, e)}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-mono flex items-center gap-1.5"
                                title="Copy proctored entry URL link"
                              >
                                {copingInviteUrl === c.token ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied Link
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy exam link
                                  </>
                                )}
                              </button>

                              {/* Let recruiter test-drive the candidate session instantly in a new tab */}
                              {c.status !== 'Completed' && c.status !== 'Suspended' && (
                                <a
                                  href={`/?token=${c.token}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2.5 py-1.5 bg-indigo-55 text-indigo-750 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                  title="Test exam portal as candidate"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-indigo-650" /> Test Exam Space
                                </a>
                              )}

                              {(c.status === 'Completed' || c.status === 'Suspended' || c.status === 'Pending and Incomplete' || c.status === 'Pending & Incomplete') && (
                                <button className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-150 hover:bg-indigo-100 rounded-lg text-xs flex items-center gap-1.5 font-medium">
                                  <Eye className="w-3.5 h-3.5" /> View Report
                                </button>
                              )}

                              <button
                                onClick={(e) => handleDeleteCandidate(c.id, e)}
                                className="p-2 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                                title="Delete Candidate record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CREATE ASSESSMENT VIA JD & SETTINGS */}
          {activeTab === 'assessments' && (
            <div className="space-y-6" id="assessments-block">
              {selectedAsmtForDetail ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                  {/* Back button and Meta info header */}
                  <div className="flex border-b border-slate-100 pb-5 items-center justify-between flex-wrap gap-4">
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setSelectedAsmtForDetail(null);
                          setLocalActiveMenuCandId(null);
                        }}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer group"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-indigo-600" /> 
                        Back to Assessments List
                      </button>
                      
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          {selectedAsmtForDetail.title}
                        </h2>
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 border rounded-full ${
                          selectedAsmtForDetail.status === 'Closed' 
                            ? 'bg-slate-100 text-slate-600 border-slate-300' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {selectedAsmtForDetail.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">📍 Locations: {selectedAsmtForDetail.locations?.join(', ') || 'Remote'}</span>
                        <span>•</span>
                        <span>Level: {selectedAsmtForDetail.roleLevel}</span>
                        <span>•</span>
                        <span>Required Experience: {selectedAsmtForDetail.experienceRequired}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          // Reset upload states
                          setCandidateFiles([]);
                          setExtractedCandidatesList([]);
                          setManualName('');
                          setManualEmail('');
                          setManualPhone('');
                          setIsCandidateModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
                        id="detailed-add-candidate-btn"
                      >
                        <Plus className="w-4 h-4" /> Add Candidates
                      </button>
                      
                      <button
                        onClick={() => {
                          handleEditAssessment(selectedAsmtForDetail);
                        }}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" /> Edit Assessment Specs
                      </button>
                    </div>
                  </div>

                  {/* Extracted Skills List */}
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <h4 className="text-[10px] uppercase font-mono tracking-widest text-slate-500 font-bold">Extracted Job Skills Benchmark</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAsmtForDetail.skillsExtracted?.map((skill, sIdx) => (
                        <span key={sIdx} className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-155 px-3 py-1 rounded-lg">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Candidate List Segment */}
                  <div>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-800">Assigned Candidates Activity</h3>
                        <p className="text-[11px] text-slate-500">View or verify evaluations and invite links generated for this assessment</p>
                      </div>
                    </div>

                    {/* Filter candidates mapped to this assessment */}
                    {(() => {
                      const mappedCandidates = candidates.filter(cand => cand.assessmentId === selectedAsmtForDetail.id);
                      if (mappedCandidates.length === 0) {
                        return (
                          <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/35 flex flex-col items-center justify-center space-y-4">
                            <Users className="w-8 h-8 text-slate-350" />
                            <div className="space-y-1">
                              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">No candidates mapped yet</h5>
                              <p className="text-xs max-w-sm text-slate-500 mx-auto">
                                Begin by clicking "+ Add Candidates" to import candidate profiles via resume attachments, spreadsheet rosters, or manually typing contact emails.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setCandidateFiles([]);
                                setExtractedCandidatesList([]);
                                setManualName('');
                                setManualEmail('');
                                setManualPhone('');
                                setIsCandidateModalOpen(true);
                              }}
                              className="px-3.5 py-2 bg-indigo-55 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Tag First Candidate
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="border border-slate-200 rounded-xl overflow-visible bg-white shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50/60 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <th className="p-4 font-semibold">Candidate Detail</th>
                                <th className="p-4 font-semibold">Experience / Location</th>
                                <th className="p-4 font-semibold">Matched Skills</th>
                                <th className="p-4 font-semibold text-center">Status</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {mappedCandidates.map(cand => (
                                <tr key={cand.id} className="hover:bg-slate-50/40 text-slate-800 transition-colors">
                                  <td className="p-4 min-w-[200px]">
                                    <div className="space-y-1">
                                      <div className="font-semibold text-slate-800 text-sm">{cand.name}</div>
                                      <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 font-mono">
                                        <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {cand.email}</span>
                                        {cand.phone && cand.phone !== 'N/A' && (
                                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {cand.phone}</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  
                                  <td className="p-4 text-slate-600 min-w-[120px]">
                                    <div className="space-y-1">
                                      <div className="font-medium text-slate-800">{cand.experience || '2-4 Years'}</div>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                        <MapPin className="w-3 h-3 text-slate-400 font-normal" /> {cand.location || 'Remote'}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="p-4 max-w-[240px]">
                                    <div className="flex flex-wrap gap-1">
                                      {cand.skillsExtracted && cand.skillsExtracted.length > 0 ? (
                                        cand.skillsExtracted.map((s, idx) => (
                                          <span key={idx} className="text-[9px] font-mono px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded">
                                            {s}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-slate-400 text-[10px] italic">Not analyzed</span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="p-4 text-center">
                                    <span className={`inline-block text-[9px] font-mono uppercase px-2.5 py-0.5 rounded-full border ${getStatusColor(cand.status)}`}>
                                      {cand.status}
                                    </span>
                                  </td>

                                  <td className="p-4 text-right">
                                    <div className="relative inline-block text-left">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLocalActiveMenuCandId(localActiveMenuCandId === cand.id ? null : cand.id);
                                        }}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>

                                      {localActiveMenuCandId === cand.id && (
                                        <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1.5 animate-in fade-in-25 slide-in-from-top-1 text-left">
                                          <button
                                            onClick={(e) => {
                                              setLocalActiveMenuCandId(null);
                                              handleCopyUrl(cand.token, e);
                                            }}
                                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 text-xs flex items-center gap-2"
                                          >
                                            <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy exam link
                                          </button>

                                          <a
                                            href={`/?token=${cand.token}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={() => setLocalActiveMenuCandId(null)}
                                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 text-xs flex items-center gap-2"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> Test exam portal
                                          </a>

                                          {(cand.status === 'Completed' || cand.status === 'Suspended' || cand.status === 'Pending and Incomplete' || cand.status === 'Pending & Incomplete') ? (
                                            <button
                                              onClick={() => {
                                                setLocalActiveMenuCandId(null);
                                                setSelectedCandidate(cand);
                                                setActiveTab('reports');
                                              }}
                                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-indigo-650 font-semibold text-xs flex items-center gap-2"
                                            >
                                              <Eye className="w-3.5 h-3.5" /> View detailed report
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                setLocalActiveMenuCandId(null);
                                                handleInviteCandidate(cand.id, cand.email);
                                              }}
                                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 text-xs flex items-center gap-2"
                                            >
                                              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Invite to Assessment
                                            </button>
                                          )}

                                          <div className="border-t border-slate-100 my-1"></div>

                                          <button
                                            onClick={(e) => {
                                              setLocalActiveMenuCandId(null);
                                              handleDeleteCandidate(cand.id, e);
                                            }}
                                            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 text-xs flex items-center gap-2"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete candidate
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-6">
                    {/* Active Requisitions Segment */}
                  <div>
                    <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-slate-100 flex-wrap gap-4">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-indigo-600 flex items-center gap-1.5 font-bold">
                        <BookOpen className="w-4 h-4" /> Active Skill Requisitions ({assessments.filter(a => a.status !== 'Closed').length})
                      </h3>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setDraftAssessmentId(null);
                          setJdTitle('');
                          setJdText('');
                          setJdRoleLevel('Mid-Level');
                          setJdExperience('Engineer');
                          setSelectedLocations([]);
                          setUploadedFileName('');
                          setExtractedSkills([]);
                          setGoodToHaveSkills([]);
                          setMandatorySkills([]);
                          setQuestionsPreview([]);
                          setTechCount(5);
                          setCodingCount(2);
                          setRoundsEnabled({ tech: true, coding: true });
                          setAsmtStep(1); // Ensure we start on step 1
                          setIsAddAssessmentOpen(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
                        id="open-add-assessment-modal-btn"
                      >
                        <Plus className="w-4 h-4" /> Add Assessment
                      </button>
                    </div>

                    <div className="space-y-3" id="active-requisitions-list">
                      {assessments.filter(a => a.status !== 'Closed').length === 0 ? (
                        <div className="p-6 text-center text-slate-400 italic text-xs border border-dashed border-slate-250 rounded-xl bg-slate-50/20">
                          No active skill requisitions generated yet. Click "Add Assessment" to compile an active requisition.
                        </div>
                      ) : (
                        assessments.filter(a => a.status !== 'Closed').map(asmt => (
                          <div 
                            key={asmt.id} 
                            onClick={() => setSelectedAsmtForDetail(asmt)}
                            className="p-4 bg-slate-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:bg-indigo-50/5 text-slate-800 group cursor-pointer"
                            title="Click to view candidates and options mapped to this assessment"
                          >
                            <div className="space-y-1.5 flex-1 pr-3">
                              <div className="flex items-center gap-2 flex-wrap text-slate-800">
                                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-all flex items-center gap-2">
                                  {asmt.title}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditAssessment(asmt);
                                    }}
                                    className="p-1 hover:bg-indigo-100/50 text-indigo-500 rounded transition-all"
                                    title="Click to edit original job description specs and questions"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </h4>
                                <span className="text-[9px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-250 font-semibold uppercase tracking-wider">
                                  {asmt.status}
                                </span>
                                {asmt.locations && asmt.locations.length > 0 && (
                                  <span className="text-[9px] font-mono px-2 py-0.5 bg-indigo-50/70 text-indigo-700 rounded border border-indigo-100 font-medium">
                                    📍 {asmt.locations.join(', ')}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2.5 flex-wrap items-center text-[10px] text-slate-500 font-mono">
                                <span>Level: {asmt.roleLevel}</span>
                                <span className="text-slate-300">•</span>
                                <span>Target Experience: {asmt.experienceRequired}</span>
                                <span className="text-slate-300">•</span>
                                <span>Created by <strong className="text-slate-700 font-semibold">{getExactUserName(asmt.createdByEmail, asmt.createdByName)}</strong> ({asmt.createdByEmail || userEmail})</span>
                                <span className="text-slate-300">•</span>
                                <span>{asmt.createdAt ? new Date(asmt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                              </div>
 
                              {/* Skills Extracted Badges */}
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {asmt.skillsExtracted?.map((skill, sIdx) => (
                                  <span key={sIdx} className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateAssessmentStatus(asmt.id, 'Closed');
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Close skill requisition"
                              >
                                <Lock className="w-3.5 h-3.5 text-rose-500" /> Close Requisition
                              </button>

                              {userRole === 'Admin' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAssessment(asmt.id);
                                  }}
                                  className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Delete assessment (Admin only)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Closed Requisitions Segment */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 flex items-center gap-1.5 font-bold">
                        <Lock className="w-4 h-4 text-slate-400" /> Closed Skill Requisitions ({assessments.filter(a => a.status === 'Closed').length})
                      </h3>
                    </div>

                    <div className="space-y-3" id="closed-requisitions-list">
                      {assessments.filter(a => a.status === 'Closed').length === 0 ? (
                        <div className="p-6 text-center text-slate-350 italic text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/10">
                          No closed skill requisitions currently archived.
                        </div>
                      ) : (
                        assessments.filter(a => a.status === 'Closed').map(asmt => (
                          <div 
                            key={asmt.id} 
                            onClick={() => setSelectedAsmtForDetail(asmt)}
                            className="p-4 bg-slate-100/45 border border-slate-250 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all opacity-80 bg-white shadow-xs text-slate-800 group hover:border-indigo-300 hover:bg-indigo-50/5 cursor-pointer"
                            title="Click to view candidates and options mapped to this closed assessment"
                          >
                            <div className="space-y-1.5 flex-1 pr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-slate-500 line-through group-hover:text-indigo-600 transition-all flex items-center gap-2">
                                  {asmt.title}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditAssessment(asmt);
                                    }}
                                    className="p-1 hover:bg-indigo-100/50 text-indigo-500 rounded transition-all"
                                    title="Click to edit original job description specs and questions"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </h4>
                                <span className="text-[9px] font-mono px-2 py-0.5 bg-slate-200 text-slate-600 rounded border border-slate-300 font-semibold uppercase tracking-wider">
                                  {asmt.status}
                                </span>
                              </div>
                              <div className="flex gap-2.5 flex-wrap items-center text-[10px] text-slate-400 font-mono">
                                <span>Level: {asmt.roleLevel}</span>
                                <span className="text-slate-300">•</span>
                                <span>Target Experience: {asmt.experienceRequired}</span>
                                <span className="text-slate-300">•</span>
                                <span>Created by <strong className="text-slate-600 font-semibold">{getExactUserName(asmt.createdByEmail, asmt.createdByName)}</strong> ({asmt.createdByEmail || userEmail})</span>
                                <span className="text-slate-300">•</span>
                                <span>{asmt.createdAt ? new Date(asmt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateAssessmentStatus(asmt.id, 'Published');
                                }}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Reopen skill requisition"
                              >
                                <Unlock className="w-3.5 h-3.5 text-emerald-500" /> Reopen Requisition
                              </button>

                              {userRole === 'Admin' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAssessment(asmt.id);
                                  }}
                                  className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Delete assessment (Admin only)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Candidate Ingestion Popup Modal extracted */}

              {/* Add Assessment Popup Modal */}
              {isAddAssessmentOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
                    onClick={() => {
                      if (!generatingAssessment) setIsAddAssessmentOpen(false);
                    }}
                  />
                             {/* Modal Card */}
                  <div className={`relative bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl w-full z-10 transition-all duration-300 max-h-[88vh] overflow-y-auto ${
                    asmtStep === 1 
                      ? 'max-w-[580px]' 
                      : asmtStep === 2 
                        ? 'max-w-[720px]' 
                        : 'max-w-[1050px]'
                  }`}>
                    
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                          {asmtStep === 1 
                            ? 'Configure Skill Requisition (Step 1/3)' 
                            : asmtStep === 2 
                              ? 'Add Your Skills' 
                              : 'Configure & Preview Question Bank (Step 3/3)'}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {asmtStep === 1 
                            ? 'Define target job title, experience level, and paste or upload standard Job Descriptions.' 
                            : asmtStep === 2
                              ? 'Define your good to have and mandatory skills'
                              : 'Configure active evaluation pools, inject custom parameters, and set candidate randomisation limits.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddAssessmentOpen(false)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        aria-label="Close dialog"
                        id="close-add-assessment-modal-btn"
                        disabled={generatingAssessment}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* STEP 1: CONFIGURATION */}
                    {asmtStep === 1 && (
                      <form onSubmit={handleGenerateAssessment} className="space-y-4">
                        <div className="space-y-4">
                          {/* Title */}
                          <div>
                            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1 font-bold">Target Job Title</label>
                            <input
                              type="text"
                              value={jdTitle}
                              onChange={(e) => setJdTitle(e.target.value)}
                              required
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                              placeholder="e.g. Senior Backend Engineer (Node/AWS)"
                              id="jd-input-title"
                            />
                          </div>

                          {/* Experience */}
                          <div>
                            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1 font-bold">Target Experience</label>
                            <select
                              value={jdExperience}
                              onChange={(e) => setJdExperience(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 cursor-pointer focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="Associate Engineer">Associate Engineer</option>
                              <option value="Engineer">Engineer</option>
                              <option value="Senior Engineer">Senior Engineer</option>
                              <option value="Lead">Lead</option>
                              <option value="Associate Manager">Associate Manager</option>
                              <option value="Manager">Manager</option>
                            </select>
                          </div>

                          {/* JD Intake: Direct Paste JD & File Upload */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                                JD Intake Format
                              </label>
                              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setJdInputType('paste')}
                                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    jdInputType === 'paste'
                                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  <FileText className="w-3.5 h-3.5" /> Paste JD
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setJdInputType('upload')}
                                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    jdInputType === 'upload'
                                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  <Upload className="w-3.5 h-3.5" /> File Upload
                                </button>
                              </div>
                            </div>

                            {jdInputType === 'paste' ? (
                              <div className="space-y-2">
                                <textarea
                                  value={jdText}
                                  onChange={(e) => setJdText(e.target.value)}
                                  required
                                  rows={5}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                                  placeholder="Paste complete Job Description parameters, key duties, technologies..."
                                  id="jd-input-text"
                                />
                                <div className="flex justify-between items-center text-[11px] text-slate-450 px-1">
                                  <span>Have a document ready?</span>
                                  <button
                                    type="button"
                                    onClick={() => setJdInputType('upload')}
                                    className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Upload className="w-3 h-3" /> File Upload (.pdf, .docx)
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* High fidelity file drop-zone */}
                                <div
                                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                  onDragLeave={() => setDragActive(false)}
                                  onDrop={async (e) => {
                                    e.preventDefault();
                                    setDragActive(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                      const file = e.dataTransfer.files[0];
                                      setUploadedFileName(file.name);
                                      
                                      setIsExtractingFile(true);
                                      await new Promise(r => setTimeout(r, 1200));
                                      setIsExtractingFile(false);

                                      const titleCtx = (jdTitle || file.name || '').toLowerCase();
                                      let skillsCtx = 'Java, Spring Boot, Microservices, Kafka, Distributed Systems, SQL, Concurrency';
                                      if (titleCtx.includes('react') || titleCtx.includes('frontend')) {
                                        skillsCtx = 'React, TypeScript, Next.js, Redux, Tailwind CSS, REST APIs';
                                      } else if (titleCtx.includes('python')) {
                                        skillsCtx = 'Python, Django, FastAPI, PostgreSQL, Docker, AWS, Redis';
                                      } else if (titleCtx.includes('node')) {
                                        skillsCtx = 'Node.js, Express, TypeScript, MongoDB, Redis, Docker, REST APIs';
                                      } else if (titleCtx.includes('qa') || titleCtx.includes('test')) {
                                        skillsCtx = 'QA Automation, Selenium, Cypress, Playwright, API Testing';
                                      }
                                      const mockExtract = `Role: ${jdTitle || 'Software Engineer'}\nExperience: ${jdExperience}\n\nCore responsibilities require robust backend development, low latency architecture, distributed transactions, memory management, and production-grade engineering. Core required skills: ${skillsCtx}.`;
                                      setJdText(mockExtract);
                                      notifyUser(`Extracted data loaded successfully from ${file.name}!`);
                                      await handleExtractSkills(mockExtract);
                                    }
                                  }}
                                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
                                    dragActive ? 'border-indigo-600 bg-indigo-50/25' : 'border-slate-300 hover:border-slate-400 bg-slate-50/40'
                                  }`}
                                >
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={async (e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        const file = e.target.files[0];
                                        setUploadedFileName(file.name);
                                        
                                        setIsExtractingFile(true);
                                        await new Promise(r => setTimeout(r, 1200));
                                        setIsExtractingFile(false);

                                        const titleCtx = (jdTitle || file.name || '').toLowerCase();
                                       let skillsCtx = 'Java, Spring Boot, Microservices, Kafka, Distributed Systems, SQL, Concurrency';
                                       if (titleCtx.includes('react') || titleCtx.includes('frontend')) {
                                         skillsCtx = 'React, TypeScript, Next.js, Redux, Tailwind CSS, REST APIs';
                                       } else if (titleCtx.includes('python')) {
                                         skillsCtx = 'Python, Django, FastAPI, PostgreSQL, Docker, AWS, Redis';
                                       } else if (titleCtx.includes('node')) {
                                         skillsCtx = 'Node.js, Express, TypeScript, MongoDB, Redis, Docker, REST APIs';
                                       } else if (titleCtx.includes('qa') || titleCtx.includes('test')) {
                                         skillsCtx = 'QA Automation, Selenium, Cypress, Playwright, API Testing';
                                       }
                                       const mockExtract = `Role: ${jdTitle || 'Software Engineer'}\nExperience: ${jdExperience}\n\nCore responsibilities require robust backend development, low latency architecture, distributed transactions, memory management, and production-grade engineering. Core required skills: ${skillsCtx}.`;
                                        setJdText(mockExtract);
                                        notifyUser(`Extracted data loaded successfully from ${file.name}!`);
                                        await handleExtractSkills(mockExtract);
                                      }
                                    }}
                                  />
                                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                  <p className="text-xs font-semibold text-slate-700">Drag & Drop Word/PDF here or click to choose file</p>
                                  <p className="text-[10px] text-slate-450 mt-1">Supports PDF, DOCX up to 10MB</p>
                                  
                                  {uploadedFileName && (
                                    <div className="mt-3 p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-[10px] text-indigo-700 font-mono inline-flex items-center gap-1.5 mx-auto">
                                      <FileText className="w-3.5 h-3.5" /> Checked: {uploadedFileName}
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-450 px-1">
                                  <span>Prefer to paste raw text?</span>
                                  <button
                                    type="button"
                                    onClick={() => setJdInputType('paste')}
                                    className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3" /> Paste JD Text
                                  </button>
                                </div>
                              </div>
                            )}

                            {isExtractingFile && (
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between items-center text-[10px] text-indigo-700 font-mono">
                                  <span>Reading and parsing files specifications...</span>
                                  <span>85% completed</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-600 rounded-full animate-[shimmer_1.5s_infinite]" style={{ width: '85%' }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submit Button Step 1 */}
                        {draftAssessmentId ? (
                          <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            <button
                              type="button"
                              onClick={() => setAsmtStep(2)}
                              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200"
                            >
                              <span>Next: Skills Allocation (Already Extracted)</span>
                              <ArrowRight className="w-4 h-4 text-indigo-600" />
                            </button>
                            <button
                              type="submit"
                              disabled={generatingAssessment || (!jdText.trim() && jdInputType === 'paste')}
                              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-150 disabled:text-slate-450 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-indigo-600/10 text-center"
                            >
                              {generatingAssessment ? (
                                <>
                                  <span className="w-4 h-4 border-2 border-white/40 border-t-white animate-spin rounded-full"></span>
                                  <span>Gemini re-extracting...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                                  <span>Re-Extract Core Skills</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="submit"
                            disabled={generatingAssessment || (!jdText.trim() && jdInputType === 'paste')}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-150 disabled:text-slate-450 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all mt-6 shadow-sm shadow-indigo-600/10 cursor-pointer text-center"
                            id="trigger-asmt-generation"
                          >
                            {generatingAssessment ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white animate-spin rounded-full"></span>
                                <span>Generating Questions...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
                                <span>Compile Questions</span>
                              </>
                            )}
                          </button>
                        )}
                      </form>
                    )}

                    {/* STEP 2: EXTRACTIONS, SKILLS CLASSIFICATIONS & ADDITIONS */}
                    {asmtStep === 2 && (
                      <div className="space-y-6 text-slate-800">
                        {/* Summary Overview */}
                        <div className="p-4 bg-indigo-50/45 border border-indigo-150/45 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Role Concept</span>
                            <h4 className="text-sm font-bold text-slate-900">{jdTitle || `${jdRoleLevel} Requisition`}</h4>
                            <p className="text-[10px] text-slate-500 font-mono">Seniority: {jdRoleLevel} | Experience: {jdExperience}</p>
                          </div>
                          <span className="text-[11px] font-mono bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold animate-pulse">
                            Step 2 of 3: Skill Allocation
                          </span>
                        </div>

                        {/* Universal Search & Append Custom Skill Targets */}
                        {(() => {
                          const trimmedSearch = skillSearch.trim();
                          const suggestions = searchUniversalSkills(trimmedSearch, 8);
                          const exactExists = extractedSkills.some(s => s.toLowerCase() === trimmedSearch.toLowerCase());

                          return (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative z-30">
                              <div className="flex justify-between items-center flex-wrap gap-2">
                                <label className="block text-[10px] font-mono text-slate-700 uppercase tracking-widest font-bold flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  Select Your Skills
                                </label>
                              </div>

                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={skillSearch}
                                      onChange={(e) => setSkillSearch(e.target.value)}
                                      placeholder="e.g. Concurrency, Low Latency, Multithreading, PySpark, gRPC, Redis..."
                                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 shadow-2xs placeholder:text-slate-400"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleAddSearchSkill();
                                        }
                                      }}
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    {skillSearch && (
                                      <button 
                                        type="button" 
                                        onClick={() => setSkillSearch('')} 
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  
                                  {/* Dropdown Suggestions */}
                                  {trimmedSearch.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2.5 max-h-72 overflow-y-auto space-y-2">
                                      
                                      {/* Top Action: Add as Custom Skill immediately */}
                                      <div 
                                        onClick={handleAddSearchSkill}
                                        className="p-2.5 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                                            +
                                          </div>
                                          <div>
                                            <span className="text-xs font-bold text-indigo-900 group-hover:text-indigo-950">
                                              Add &ldquo;{trimmedSearch}&rdquo; as Skill Target
                                            </span>
                                            <p className="text-[10px] text-indigo-600 font-mono">
                                              {exactExists ? 'Already added to criteria' : 'Press Enter or click to add immediately'}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-[9px] font-mono font-bold bg-white text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                                          {exactExists ? 'Added' : 'Enter ↵'}
                                        </span>
                                      </div>

                                      {/* Suggestions header */}
                                      {suggestions.length > 0 && (
                                        <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest px-2 pt-1 border-t border-slate-100 flex justify-between">
                                          <span>Matching Skills & Concepts ({suggestions.length})</span>
                                          <span>Click to add</span>
                                        </div>
                                      )}

                                      {/* Suggestions List */}
                                      <div className="divide-y divide-slate-100">
                                        {suggestions.map((sug) => {
                                          const isAdded = extractedSkills.some(s => s.toLowerCase() === sug.name.toLowerCase());
                                          return (
                                            <div key={sug.name} className="py-2 px-2 hover:bg-slate-50 transition-colors rounded-xl">
                                              <div className="flex items-center justify-between gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleAddSkillByName(sug.name);
                                                    setSkillSearch('');
                                                  }}
                                                  className={`text-xs font-semibold text-left flex items-center gap-2 focus:outline-none cursor-pointer flex-1 ${
                                                    isAdded ? 'text-indigo-600 font-bold' : 'text-slate-800 hover:text-indigo-600'
                                                  }`}
                                                >
                                                  {isAdded ? (
                                                    <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                  ) : (
                                                    <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                  )}
                                                  <span className="truncate">{sug.name}</span>
                                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                                    {sug.category}
                                                  </span>
                                                </button>
                                                {isAdded && (
                                                  <span className="text-[8px] font-mono font-bold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0 border border-indigo-150">
                                                    Added
                                                  </span>
                                                )}
                                              </div>
                                              
                                              {/* Related Skills Rack */}
                                              {sug.related && sug.related.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1 items-center pl-5">
                                                  <span className="text-[9px] text-slate-400 font-mono">Related:</span>
                                                  {sug.related.slice(0, 5).map(relSkill => {
                                                    const relAdded = extractedSkills.some(s => s.toLowerCase() === relSkill.toLowerCase());
                                                    return (
                                                      <button
                                                        key={relSkill}
                                                        type="button"
                                                        onClick={() => {
                                                          handleAddSkillByName(relSkill);
                                                          setSkillSearch('');
                                                        }}
                                                        className={`text-[9px] px-2 py-0.5 rounded-md border font-sans cursor-pointer transition-all ${
                                                          relAdded
                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                                                            : 'bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200 hover:border-indigo-200'
                                                        }`}
                                                      >
                                                        {relAdded ? '✓ ' : '+ '}{relSkill}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Dynamic Server-Side AI Discovery Section */}
                                      {(() => {
                                        const existingSuggestionNames = new Set(suggestions.map(s => s.name.toLowerCase()));
                                        const novelAiSkills = dynamicAiSuggestions.filter(
                                          ai => !existingSuggestionNames.has(ai.name.toLowerCase())
                                        );

                                        if (novelAiSkills.length === 0 && !isSearchingAiSkills) {
                                          return null;
                                        }

                                        return (
                                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                            <div className="flex items-center justify-between px-2 text-[9px] font-mono font-bold text-indigo-600 uppercase tracking-widest">
                                              <span className="flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                AI Domain Expansions
                                              </span>
                                              {isSearchingAiSkills && (
                                                <span className="text-slate-400 font-normal lowercase animate-pulse">
                                                  discovering...
                                                </span>
                                              )}
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-1 px-2">
                                              {novelAiSkills.map(aiSkill => {
                                                const isAdded = extractedSkills.some(s => s.toLowerCase() === aiSkill.name.toLowerCase());
                                                return (
                                                  <button
                                                    key={aiSkill.name}
                                                    type="button"
                                                    onClick={() => {
                                                      handleAddSkillByName(aiSkill.name);
                                                      setSkillSearch('');
                                                    }}
                                                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-all flex items-center gap-1 ${
                                                      isAdded
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                        : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200 hover:border-indigo-300 shadow-2xs'
                                                    }`}
                                                  >
                                                    {isAdded ? (
                                                      <Check className="w-2.5 h-2.5 text-indigo-600" />
                                                    ) : (
                                                      <Plus className="w-2.5 h-2.5 text-slate-400" />
                                                    )}
                                                    <span>{aiSkill.name}</span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={handleAddSearchSkill}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0 shadow-sm shadow-indigo-600/10 flex items-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add Skill
                                </button>
                              </div>

                              {/* Popular Concept Quick-Picks / Categories */}
                              <div className="pt-2 border-t border-slate-200/60">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                                    Explore Competency Domains:
                                  </span>
                                  {selectedSkillPreset && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSkillPreset(null)}
                                      className="text-[9px] font-mono text-indigo-600 hover:underline cursor-pointer"
                                    >
                                      Clear Filter
                                    </button>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap gap-1.5">
                                  {POPULAR_SKILL_PRESETS.map((preset) => {
                                    const isSelected = selectedSkillPreset === preset.label;
                                    return (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => setSelectedSkillPreset(isSelected ? null : preset.label)}
                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                          isSelected 
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold' 
                                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Expanded pills for selected preset */}
                                {selectedSkillPreset && (
                                  <div className="mt-2.5 p-2 bg-indigo-50/40 border border-indigo-150/50 rounded-xl space-y-1.5">
                                    <span className="text-[9px] font-mono text-indigo-700 font-bold uppercase tracking-wider block">
                                      1-Click Add from {selectedSkillPreset}:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {POPULAR_SKILL_PRESETS.find(p => p.label === selectedSkillPreset)?.skills.map(skillName => {
                                        const isAdded = extractedSkills.some(s => s.toLowerCase() === skillName.toLowerCase());
                                        return (
                                          <button
                                            key={skillName}
                                            type="button"
                                            onClick={() => handleAddSkillByName(skillName)}
                                            className={`text-[10px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                                              isAdded 
                                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold' 
                                                : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border-slate-200 hover:border-indigo-300'
                                            }`}
                                          >
                                            {isAdded ? <Check className="w-3 h-3 text-indigo-600" /> : <Plus className="w-3 h-3 text-slate-400" />}
                                            <span>{skillName}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* List of skills */}
                        <div className="space-y-3">
                          <div className="border-b border-slate-100 pb-2">
                            <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-widest">
                              Extracted & Added Skills ({extractedSkills.length})
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              Categorize the extracted skills. **Mandatory Skills** are core requirements that directly determine the candidate's final qualification decision. **Good-to-have Skills** provide bonus points.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                            {extractedSkills.map((skill) => {
                              const isMandatory = mandatorySkills.includes(skill);
                              return (
                                <div
                                  key={skill}
                                  className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                                    isMandatory 
                                      ? 'bg-indigo-50/20 border-indigo-200/50 shadow-xs' 
                                      : 'bg-emerald-50/10 border-emerald-200/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 max-w-[55%]">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(skill)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                      title={`Remove "${skill}"`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-bold text-slate-800 tracking-wide font-sans truncate">{skill}</span>
                                  </div>
                                  
                                  <div className="flex gap-1 bg-slate-150 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() => toggleSkillRequirement(skill, 'mandatory')}
                                      className={`px-2 py-0.5 text-[9px] font-mono rounded-md font-bold uppercase tracking-wide transition-all ${
                                        isMandatory
                                          ? 'bg-indigo-600 text-white shadow-xs'
                                          : 'text-slate-500 hover:bg-slate-200'
                                      }`}
                                    >
                                      Mandatory
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleSkillRequirement(skill, 'goodToHave')}
                                      className={`px-2 py-0.5 text-[9px] font-mono rounded-md font-bold uppercase tracking-wide transition-all ${
                                        !isMandatory
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'text-slate-505 hover:bg-slate-205'
                                      }`}
                                    >
                                      Good
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Step Navigation Actions */}
                        <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-6">
                          <button
                            type="button"
                            onClick={() => setAsmtStep(1)}
                            disabled={generatingAssessment}
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Specs
                          </button>

                          {draftAssessmentId ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setAsmtStep(3)}
                                className="px-4 py-2 border border-slate-200 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                Edit Questions Directly <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                              </button>
                              <button
                                type="button"
                                onClick={handleGenerateQuestionsFromSkills}
                                disabled={generatingAssessment}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
                              >
                                {generatingAssessment ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white animate-spin rounded-full"></span>
                                    <span>Regenerating customization...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                                    <span>Re-Generate All Questions</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleGenerateQuestionsFromSkills}
                              disabled={generatingAssessment}
                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
                            >
                              {generatingAssessment ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white animate-spin rounded-full"></span>
                                  <span>Generating Questions...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                                  <span>Generate Questions Pool</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STEP 3: CUSTOMIZE INTERVIEW QUESTION POOLS & COUNTS */}
                    {asmtStep === 3 && (
                      <div className="space-y-6 text-slate-800">
                        {/* Summary Overview */}
                        <div className="p-3.5 bg-indigo-50/45 border border-indigo-150/40 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="text-xs">
                            <span className="font-mono text-slate-500">Target Role:</span> <strong className="text-indigo-950 font-bold">{jdTitle || `${jdRoleLevel} Requisition`}</strong>
                            <p className="text-[10px] text-slate-450 font-mono">Seniority: {jdRoleLevel} | Experience: {jdExperience}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap text-[10px] font-mono">
                            <span className="px-2 py-0.5 bg-blue-55 text-blue-705 border border-blue-150 rounded-md font-semibold">
                              Tech Ask: {techCount}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-55 text-emerald-705 border border-emerald-150 rounded-md font-semibold">
                              Coding Ask: {codingCount}
                            </span>
                          </div>
                        </div>

                        {/* Rounds Toggle Configuration */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <h4 className="text-xs font-mono font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            ⚙️ Enabled Interview Rounds
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Tech Round */}
                            <label className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${roundsEnabled.tech ? 'bg-indigo-50/30 border-indigo-200 text-indigo-900 font-semibold shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`}>
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={roundsEnabled.tech}
                                  onChange={(e) => setRoundsEnabled(prev => ({ ...prev, tech: e.target.checked }))}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs">Technical Depth Round</span>
                              </div>
                              <span className="text-[10px] font-mono uppercase bg-white px-2 py-0.5 rounded border border-slate-100 font-bold">Round 1</span>
                            </label>

                            {/* Coding Round */}
                            <label className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${roundsEnabled.coding ? 'bg-indigo-50/30 border-indigo-200 text-indigo-900 font-semibold shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`}>
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={roundsEnabled.coding}
                                  onChange={(e) => setRoundsEnabled(prev => ({ ...prev, coding: e.target.checked }))}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs">Coding Challenge Round</span>
                              </div>
                              <span className="text-[10px] font-mono uppercase bg-white px-2 py-0.5 rounded border border-slate-100 font-bold">Round 2</span>
                            </label>
                          </div>
                        </div>

                        {/* Two Column Side-by-Side Area */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-start">
                          
                          {/* Side tabs */}
                          <div className="md:col-span-1 flex flex-row md:flex-col gap-2 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4">
                            <button
                              type="button"
                              onClick={() => setSelectedBankTab('tech')}
                              className={`flex-1 text-left px-3 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between gap-2 transition-all ${
                                selectedBankTab === 'tech'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-150 shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 font-mono">
                                <span className={`w-2 h-2 rounded-full ${roundsEnabled.tech ? 'bg-blue-500 animate-[ping_1.5s_infinite]' : 'bg-slate-300'}`} />
                                Tech Questions
                              </div>
                              {!roundsEnabled.tech && <span className="text-[8px] font-mono px-1 bg-slate-200 text-slate-500 rounded border border-slate-300 font-bold uppercase shrink-0">Disabled</span>}
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedBankTab('coding')}
                              className={`flex-1 text-left px-3 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between gap-2 transition-all ${
                                selectedBankTab === 'coding'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-150 shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 font-mono">
                                <span className={`w-2 h-2 rounded-full ${roundsEnabled.coding ? 'bg-emerald-500 animate-[ping_1.5s_infinite]' : 'bg-slate-300'}`} />
                                Coding Round
                              </div>
                              {!roundsEnabled.coding && <span className="text-[8px] font-mono px-1 bg-slate-200 text-slate-500 rounded border border-slate-300 font-bold uppercase shrink-0">Disabled</span>}
                            </button>
                          </div>

                          {/* Right Content Area */}
                          <div className="md:col-span-3 space-y-4">
                            
                            {/* Category Settings Block */}
                            <div className="p-4 bg-slate-50/55 border border-slate-200 rounded-xl space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                                <div>
                                  <h4 className="text-xs font-mono font-bold text-slate-850 uppercase tracking-widest">
                                    {selectedBankTab === 'tech' ? 'Technical Pool constraints' : 'Interactive Coding round'}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                                    {selectedBankTab === 'tech' 
                                      ? 'Dynamic random evaluation questions drawn exclusively from the pool.' 
                                      : 'Compilers evaluate actual code execution during live candidate responses.'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0">ANY:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={Math.max(1, questionsPreview.filter(q => q.category === selectedBankTab && q.selected).length)}
                                    value={selectedBankTab === 'tech' ? techCount : codingCount}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      if (selectedBankTab === 'tech') setTechCount(val);
                                      else setCodingCount(val);
                                    }}
                                    className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-855 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>

                              {/* Manual Question Inline Form Trigger */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider font-bold">
                                  <span className="text-slate-500 font-bold">Inject manual screener directly</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedBankTab === 'tech') {
                                        setShowAddManualTech(!showAddManualTech);
                                      } else if (selectedBankTab === 'coding') {
                                        setShowAddManualCoding(!showAddManualCoding);
                                      }
                                    }}
                                    className="text-indigo-650 hover:underline hover:text-indigo-800 font-mono text-[9px]"
                                  >
                                    {selectedBankTab === 'tech' ? (showAddManualTech ? 'Close manual panel' : '+ Add Question Manually') : (showAddManualCoding ? 'Close manual panel' : '+ Add Challenge Manually')}
                                  </button>
                                </div>

                                {/* Custom Technical Form */}
                                {selectedBankTab === 'tech' && showAddManualTech && (
                                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
                                    <textarea
                                      value={manualTechText}
                                      onChange={(e) => setManualTechText(e.target.value)}
                                      placeholder="Type a Legacy or Conceptual query..."
                                      rows={2}
                                      className="w-full bg-slate-50/20 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                        <span className="text-slate-450 shrink-0">SKILL:</span>
                                        <select
                                          value={manualTechSkill}
                                          onChange={(e) => setManualTechSkill(e.target.value)}
                                          className="bg-white border p-1 rounded text-[10px] w-full truncate cursor-pointer"
                                        >
                                          {[...mandatorySkills, ...goodToHaveSkills].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                        <span className="text-slate-450 shrink-0">DIFF:</span>
                                        <select
                                          value={manualTechDiff}
                                          onChange={(e) => setManualTechDiff(e.target.value as any)}
                                          className="bg-white border p-1 rounded text-[10px] w-full cursor-pointer"
                                        >
                                          <option value="Easy">Easy</option>
                                          <option value="Moderate">Moderate</option>
                                          <option value="High">High</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <button
                                        type="button"
                                        onClick={handleAddManualTech}
                                        disabled={!manualTechText.trim()}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold font-mono transition-colors"
                                      >
                                        + Appends to Tech Pool
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Custom Coding Challenge Form */}
                                {selectedBankTab === 'coding' && showAddManualCoding && (
                                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
                                    <div>
                                      <label className="block text-[9px] font-mono text-slate-450 uppercase mb-0.5">Coding Question / Constraint instruction</label>
                                      <textarea
                                        value={manualCodingText}
                                        onChange={(e) => setManualCodingText(e.target.value)}
                                        placeholder="e.g. Write a function returning array of common elements..."
                                        rows={2}
                                        className="w-full bg-slate-50/20 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-mono text-slate-450 uppercase mb-0.5">BOILERPLATE STARTER CODE (JS/TS)</label>
                                      <textarea
                                        value={manualCodingAnswer}
                                        onChange={(e) => setManualCodingAnswer(e.target.value)}
                                        placeholder="function calculate(acc) {\n  // your code\n}"
                                        rows={2}
                                        className="w-full bg-slate-950 text-emerald-400 font-mono text-[9px] rounded-lg p-2 focus:outline-none animate-none"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                        <span className="text-slate-450 shrink-0">TARGET LANG:</span>
                                        <select
                                          value={manualCodingSkill}
                                          onChange={(e) => setManualCodingSkill(e.target.value)}
                                          className="bg-white border p-1 rounded text-[10px] w-full truncate cursor-pointer"
                                        >
                                          {[...mandatorySkills, ...goodToHaveSkills].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                        <span className="text-slate-450 shrink-0">DIFF:</span>
                                        <select
                                          value={manualCodingDiff}
                                          onChange={(e) => setManualCodingDiff(e.target.value as any)}
                                          className="bg-white border p-1 rounded text-[10px] w-full cursor-pointer"
                                        >
                                          <option value="Easy">Easy</option>
                                          <option value="Moderate">Moderate</option>
                                          <option value="High">High</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <button
                                        type="button"
                                        onClick={handleAddManualCoding}
                                        disabled={!manualCodingText.trim()}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold font-mono transition-colors"
                                      >
                                        + Appends to Coding round
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Question Items Listing */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {questionsPreview.filter(q => q.category === selectedBankTab).length === 0 ? (
                                <div className="p-6 text-center text-slate-400 italic text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/10">
                                  No questions configured in this active category block yet.
                                </div>
                              ) : (
                                questionsPreview.filter(q => q.category === selectedBankTab).map((q, qIdx) => {
                                  // Variety tags
                                  let varTag = 'Conceptual Screening';
                                  if (selectedBankTab === 'tech') {
                                    if (qIdx % 4 === 0) varTag = 'Direct Conceptual Spotter';
                                    else if (qIdx % 4 === 1) varTag = 'Situation-Based Scenario';
                                    else if (qIdx % 4 === 2) varTag = 'Framework Suggested Tech';
                                    else varTag = 'Most Related core skills check';
                                  } else if (selectedBankTab === 'coding') {
                                    if (qIdx % 2 === 0) varTag = 'Core Logic Algorithmic test';
                                    else varTag = 'Suggested Technology challenge';
                                  }
                                  if (q.id.startsWith('q-custom')) varTag = 'Recruiter Custom Added';

                                  const skillOfQuestion = q.targetedSkill || 'General';
                                  const isSkillMandatory = q.isGoodToHave !== undefined 
                                     ? !q.isGoodToHave 
                                     : mandatorySkills.some(m => m.trim().toLowerCase() === skillOfQuestion.toLowerCase() || skillOfQuestion.toLowerCase().includes(m.trim().toLowerCase()) || m.trim().toLowerCase().includes(skillOfQuestion.toLowerCase()));

                                  return (
                                    <div
                                      key={q.id}
                                      className={`p-3 rounded-xl border flex gap-3 transition-all ${
                                        q.selected 
                                          ? 'bg-indigo-50/25 border-indigo-200/50 shadow-xs' 
                                          : 'bg-slate-50/40 border-slate-200/20 opacity-55'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={q.selected}
                                        onChange={() => setQuestionsPreview(prev => prev.map(item => item.id === q.id ? { ...item, selected: !item.selected } : item))}
                                        className="mt-0.5 cursor-pointer rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                                      />
                                      <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                                        <div className="flex items-center justify-between flex-wrap gap-2 text-[9px] font-mono">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                                              q.id.startsWith('q-custom')
                                                ? 'bg-amber-100 text-amber-800'
                                                : (selectedBankTab === 'tech' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')
                                            }`}>
                                              {varTag}
                                            </span>
                                            
                                            <span className="text-slate-300">|</span>
                                            
                                            <span className="text-slate-500 font-bold">
                                              🎯 target: {skillOfQuestion}
                                            </span>

                                            <span className="text-slate-200">•</span>

                                            <span className={`font-bold px-1.5 py-0.2 rounded ${
                                              isSkillMandatory ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-slate-100 text-slate-550'
                                            }`}>
                                              {isSkillMandatory ? 'Mandatory Core' : 'Good-to-have'}
                                            </span>
                                          </div>

                                          <span className={`${q.difficulty === 'High' ? 'text-rose-600 font-bold' : q.difficulty === 'Moderate' ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}`}>
                                            Diff: {q.difficulty}
                                          </span>
                                        </div>

                                        <h5 className="text-[12px] font-medium text-slate-850 leading-relaxed font-sans break-words">{q.question}</h5>
                                        
                                        {q.suggestedAnswer && (
                                          <div className="p-2 bg-slate-950 font-mono text-[9px] text-emerald-400 rounded-lg overflow-x-auto select-all max-h-24">
                                            <pre className="text-left font-mono">{q.suggestedAnswer}</pre>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                          </div>
                        </div>



                        {/* Regenerate fresh bank options */}
                        <div className="flex justify-between items-center flex-wrap gap-4 pt-1">
                          <button
                            type="button"
                            onClick={() => handleGenerateQuestionsFromSkills()}
                            disabled={generatingAssessment}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 font-mono"
                          >
                            <span>↻ Get Fresh/New Suggestions</span>
                          </button>
                        </div>

                        {/* Actions buttons */}
                        <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-6">
                          <button
                            type="button"
                            onClick={() => setAsmtStep(2)}
                            disabled={generatingAssessment}
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-655 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Skills
                          </button>

                          <button
                            type="button"
                            onClick={handleFinalizeAndPublish}
                            disabled={generatingAssessment}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-emerald-600/10 cursor-pointer"
                          >
                            {generatingAssessment ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white animate-spin rounded-full"></span>
                                <span>Publishing Requisition...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Confirm & Publish Skill Requisition</span>
                              </>
                            )}
                          </button>
                        </div>

                      </div>
                    )}


                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SELECTION REPORTS / CANDIDATE RESULT & EVALUATION FRAMEWORK */}
          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="reports-block">
              {/* Left Column: Candidate Directory Card List */}
              <div className="lg:col-span-1">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm sticky top-24 space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-indigo-600 flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Candidate Feedback
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const escapeCsv = (val: unknown): string => {
                            const raw = String(val ?? '');
                            // Prevent spreadsheet formula injection (=, +, -, @)
                            const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
                            return `"${safe.replace(/"/g, '""')}"`;
                          };
                          const headers = [
                            'Candidate Name',
                            'Email',
                            'Phone',
                            'Assessment Role',
                            'Interview Status',
                            'Overall Fitment (%)',
                            'Technical / Coding (%)',
                            'Communication (%)',
                            'AI Decision',
                            'Human Decision',
                            'Human Reviewer',
                            'Human Notes',
                            'Proctoring Risk',
                            'Added By',
                            'Completed At'
                          ];
                          const rows = candidates.map((c) => {
                            const asmt = assessments.find((a) => a.id === c.assessmentId);
                            const fit = c.status === 'Completed'
                              ? (c.aiAssessmentScore ?? c.feedbackReport?.technicalScore ?? 0)
                              : '';
                            return [
                              c.name,
                              c.email,
                              c.phone || '',
                              asmt?.title || '',
                              c.status,
                              fit,
                              c.feedbackReport?.technicalScore ?? '',
                              c.feedbackReport?.communicationScore ?? '',
                              c.feedbackReport?.decision || '',
                              c.humanReview?.decision || '',
                              c.humanReview?.reviewedByName || '',
                              c.humanReview?.notes || '',
                              c.feedbackReport?.cheatingRisk || '',
                              getExactUserName(c.createdByEmail, c.createdByName),
                              c.completedAt ? new Date(c.completedAt).toISOString() : ''
                            ].map(escapeCsv).join(',');
                          });
                          const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `kreo_candidate_scorecards_${new Date().toISOString().slice(0, 10)}.csv`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          notifyUser(`Exported ${candidates.length} candidate scorecards to CSV.`);
                        }}
                        disabled={candidates.length === 0}
                        className="text-[10px] inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold cursor-pointer disabled:opacity-40"
                        title="Export all candidate scorecards to CSV"
                      >
                        <Download className="w-3 h-3" />
                        CSV
                      </button>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold font-mono">
                        Total: {candidates.length}
                      </span>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Search candidate name, email, phone, role..."
                      id="result-search-input"
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                    {resultSearch && (
                      <button
                        onClick={() => setResultSearch('')}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Candidate List Cards */}
                  <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                    {(() => {
                      const filtered = candidates.filter(c => {
                        const relatedAsmt = assessments.find(a => a.id === c.assessmentId);
                        const searchLower = resultSearch.toLowerCase();
                        return (
                          c.name.toLowerCase().includes(searchLower) ||
                          c.email.toLowerCase().includes(searchLower) ||
                          (c.phone && c.phone.toLowerCase().includes(searchLower)) ||
                          (relatedAsmt && relatedAsmt.title.toLowerCase().includes(searchLower)) ||
                          (c.createdByName && c.createdByName.toLowerCase().includes(searchLower)) ||
                          (c.createdByEmail && c.createdByEmail.toLowerCase().includes(searchLower))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-6 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                            No candidates found matching search criteria.
                          </div>
                        );
                      }

                      return filtered.map(c => {
                        const relatedAsmt = assessments.find(a => a.id === c.assessmentId);
                        const isSelected = selectedCandidate?.id === c.id;

                        // Ratings computation
                        const isCompleted = c.status === 'Completed';
                        const fitScore = isCompleted ? (c.aiAssessmentScore !== undefined ? c.aiAssessmentScore : (c.feedbackReport?.technicalScore ?? 0)) : 0;
                        const codingScore = isCompleted ? (c.feedbackReport?.technicalScore !== undefined ? c.feedbackReport.technicalScore : 0) : 0;
                        const commScore = isCompleted ? (c.feedbackReport?.communicationScore !== undefined ? c.feedbackReport.communicationScore : 0) : 0;

                        // Proctoring Rating out of 10 formula (penalizing hard violations: copy-paste, tab switches, focus loss, phone, exit fullscreen, camera off)
                        const pSum = c.proctoringSummary;
                        const copyPaste = pSum?.copyPasteAttempts || 0;
                        const tabSwitches = pSum?.tabSwitches || 0;
                        const focusViolations = pSum?.browserFocusViolations || 0;
                        const phoneViolations = pSum?.phoneViolations || 0;
                        const exitFullscreen = pSum?.exitFullscreenCount || 0;
                        const cameraOff = pSum?.cameraOffViolations || 0;

                        const penalty = (copyPaste * 1.5) + (tabSwitches * 1.0) + (focusViolations * 0.5) + (phoneViolations * 2.0) + (exitFullscreen * 1.5) + (cameraOff * 2.0);
                        const proctoringRating = Math.max(0, Math.min(10, Math.round((10 - penalty) * 10) / 10));

                        // Automated selection status benchmark (100% system automated)
                        let computedStatus = 'Processing';
                        if (c.status === 'In Progress' || c.status === 'Ongoing') {
                          computedStatus = 'In Progress';
                        } else if (c.status === 'Completed') {
                          computedStatus = fitScore >= 75 ? 'Selected' : 'Not Selected';
                        } else if (c.status === 'Suspended') {
                          computedStatus = 'Not Selected';
                        } else {
                          computedStatus = 'Processing';
                        }

                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCandidate(prev => prev?.id === c.id ? null : c)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                              isSelected
                                ? 'bg-indigo-50/60 border-indigo-300 shadow-xs ring-1 ring-indigo-300'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1.5">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 truncate">{c.name}</h4>
                                <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">
                                  {relatedAsmt?.title || 'Engineering Role'}
                                </span>
                              </div>

                              {/* Status Badge */}
                              <span className={`text-[8px] font-mono px-2 py-0.5 rounded font-bold shrink-0 border uppercase ${
                                (c.humanReview?.decision === 'Hired' || c.humanReview?.decision === 'Shortlisted' || (!c.humanReview && computedStatus === 'Selected'))
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : (c.humanReview?.decision === 'Rejected' || (!c.humanReview && computedStatus === 'Not Selected'))
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : computedStatus === 'In Progress'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}>
                                {c.humanReview ? c.humanReview.decision : computedStatus}
                              </span>
                            </div>

                            {/* Contact Info */}
                            <div className="text-[9px] text-slate-500 space-y-0.5 font-mono">
                              <div className="truncate">Email: {c.email}</div>
                              {c.phone && c.phone !== 'N/A' && <div className="truncate">Phone: {c.phone}</div>}
                            </div>

                            {/* Added by / Candidate Owner Tag */}
                            <div className="text-[9px] text-slate-500 flex items-center gap-1 font-sans bg-slate-100/70 px-2 py-1 rounded border border-slate-200/60 w-fit">
                              <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span>Added by: <strong className="text-slate-700">{getExactUserName(c.createdByEmail, c.createdByName)}</strong></span>
                            </div>

                            {/* Parallel 4 Sleek Ratings */}
                            <div className="grid grid-cols-4 gap-1 text-[8px] font-mono pt-1.5 border-t border-slate-200/60">
                              <div className="bg-white p-1 rounded border border-slate-200 text-center">
                                <span className="text-[7.5px] text-slate-400 block font-sans">FITMENT</span>
                                <span className="font-bold text-indigo-600 text-[9.5px]">{fitScore}%</span>
                              </div>
                              <div className="bg-white p-1 rounded border border-slate-200 text-center">
                                <span className="text-[7.5px] text-slate-400 block font-sans">CODING</span>
                                <span className="font-bold text-slate-700 text-[9.5px]">{codingScore}%</span>
                              </div>
                              <div className="bg-white p-1 rounded border border-slate-200 text-center">
                                <span className="text-[7.5px] text-slate-400 block font-sans">PROCTOR</span>
                                <span className={`font-bold text-[9.5px] ${proctoringRating < 7 ? 'text-rose-600' : 'text-emerald-700'}`}>{proctoringRating}/10</span>
                              </div>
                              <div className="bg-white p-1 rounded border border-slate-200 text-center">
                                <span className="text-[7.5px] text-slate-400 block font-sans">COMM</span>
                                <span className="font-bold text-slate-700 text-[9.5px]">{commScore}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Column: Candidate Scorecard Detail */}
              <div className="lg:col-span-2">
                <CandidateReportPanel
                  selectedCandidate={selectedCandidate}
                  assessments={assessments}
                  reportActiveTab={reportActiveTab}
                  demoRecordingUrl={demoRecordingUrl}
                  getExactUserName={getExactUserName}
                  onReportTabChange={setReportActiveTab}
                  onForceCompileReport={handleForceCompileReport}
                  onNotifyUser={notifyUser}
                  onCandidateUpdated={(updated) => {
                    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                    setSelectedCandidate((prev) => (prev?.id === updated.id ? updated : prev));
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 4: MANAGE REGISTERED USERS (ADMIN ACCESS ONLY) */}
          {activeTab === 'users' && userRole === 'Admin' && (
            <UsersManagementTab
              accounts={accounts}
              userEmail={userEmail}
              isAddUserModalOpen={isAddUserModalOpen}
              newUserName={newUserName}
              newUserEmail={newUserEmail}
              newUserRole={newUserRole}
              newUserPassword={newUserPassword}
              newUserOrg={newUserOrg}
              onOpenAddUserModal={() => setIsAddUserModalOpen(true)}
              onCloseAddUserModal={() => setIsAddUserModalOpen(false)}
              onNewUserNameChange={setNewUserName}
              onNewUserEmailChange={setNewUserEmail}
              onNewUserRoleChange={setNewUserRole}
              onNewUserPasswordChange={setNewUserPassword}
              onNewUserOrgChange={setNewUserOrg}
              onCreateUserAccount={handleCreateUserAccount}
              onToggleUserRole={handleToggleUserRole}
              onDeleteUserAccount={handleDeleteUserAccount}
            />
          )}



          {/* TAB: TEST ENVIRONMENT (Demo Exam) */}
          {activeTab === 'test_env' && (
            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col w-screen h-screen">
              <div className="absolute top-4 right-4 z-[110]">
                <button 
                  onClick={() => setActiveTab('assessments')}
                  className="px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg border border-red-500"
                >
                  Exit Demo Environment
                </button>
              </div>
              <div className="flex-1 w-full h-full overflow-hidden relative">
                <CandidateExperience token="demo" isDemo={true} onFinished={() => setActiveTab('assessments')} />
              </div>
            </div>
          )}

        {/* Change Password Modal */}
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          userEmail={userEmail}
          oldPassword={oldPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          error={changePasswordError}
          success={changePasswordSuccess}
          isSubmitting={isChangingPasswordSubmitting}
          onOldPasswordChange={setOldPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onClose={() => setIsChangePasswordOpen(false)}
          onSubmit={handlePasswordSubmit}
        />

        {/* Test Email Connection Modal */}
        <TestEmailModal
          isOpen={isTestEmailOpen}
          userEmail={userEmail}
          testEmailAddress={testEmailAddress}
          error={testEmailError}
          result={testEmailResult}
          isSubmitting={isTestEmailSubmitting}
          onEmailChange={setTestEmailAddress}
          onClose={() => setIsTestEmailOpen(false)}
          onSubmit={handleTestEmailSubmit}
        />

        {/* Candidate Ingestion Popup Modal */}
        <CandidateIngestionModal
          isOpen={isCandidateModalOpen}
          selectedAsmtForDetail={selectedAsmtForDetail}
          assessments={assessments}
          selectedAssessmentId={selectedAssessmentId}
          candidateUploadTab={candidateUploadTab}
          manualName={manualName}
          manualEmail={manualEmail}
          manualPhone={manualPhone}
          manualExperience={manualExperience}
          duplicateCandidateAlert={duplicateCandidateAlert}
          dragActive={dragActive}
          isExtractingCandidates={isExtractingCandidates}
          extractedCandidatesList={extractedCandidatesList}
          onClose={() => setIsCandidateModalOpen(false)}
          onSelectAssessmentId={setSelectedAssessmentId}
          onUploadTabChange={setCandidateUploadTab}
          onManualNameChange={setManualName}
          onManualEmailChange={setManualEmail}
          onManualPhoneChange={setManualPhone}
          onManualExperienceChange={setManualExperience}
          onManualSkillsChange={setManualSkills}
          onDismissDuplicateAlert={() => setDuplicateCandidateAlert(null)}
          onCreateManualCandidate={handleCreateManualCandidateForDetail}
          onDragActiveChange={setDragActive}
          onProcessFiles={handleProcessCandidateFiles}
          onUpdateExtractedList={setExtractedCandidatesList}
          onClearExtractedFiles={() => {
            setExtractedCandidatesList([]);
            setCandidateFiles([]);
          }}
          onSaveAllExtractedCandidates={handleSaveAllExtractedCandidates}
        />

        </main>
      )}
    </div>
  );
}

// Subordinate icons helper
function StarsRating(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
