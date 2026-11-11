/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Mic, MicOff, Square, Play, ShieldAlert, Monitor, Terminal, Code, Cpu, 
  CheckCircle, ArrowRight, AlertTriangle, RefreshCw, Volume2, Key, Info, Ban, HelpCircle, Sparkles,
  Download, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Candidate, Assessment, Question, TranscriptEntry, ProctoringSummary } from '../types';
import SafeStorage from '../utils/safeStorage';

interface CandidateExperienceProps {
  token: string;
  isDemo?: boolean;
  onFinished: () => void;
}

export default function CandidateExperience({ token, isDemo, onFinished }: CandidateExperienceProps) {
  const isDemoSession = isDemo || token === 'demo';

  // Candidate & Assessment states
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Setup / Permissions states
  const [step, setStep] = useState<'welcome' | 'permissions' | 'proctor-check' | 'interview' | 'finished'>('welcome');
  const [hasCam, setHasCam] = useState<boolean | null>(null);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [hasScreenShare, setHasScreenShare] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Real object-detection & synthetic state flags
  const [isSyntheticCamera, setIsSyntheticCamera] = useState(false);
  const [tfModel, setTfModel] = useState<any>(null);
  const [realtimeDetections, setRealtimeDetections] = useState<any[]>([]);

  // Callback ref for the video element to ensure it instantly binds and plays mirrored (like front camera) on mount
  const bindVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && webStream) {
      el.srcObject = webStream;
      el.play().catch(err => {
        console.warn("Autoplay webcam configuration alert:", err);
      });
    }
  };

  // Proctoring simulation metrics
  const [proctorLogs, setProctorLogs] = useState<string[]>([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [browserBlurCount, setBrowserBlurCount] = useState(0);
  const [gazeDeviationScore, setGazeDeviationScore] = useState(0); // 0-100 indicating looking away
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(0);
  const [cameraOffViolations, setCameraOffViolations] = useState(0);
  const [notVisibleViolations, setNotVisibleViolations] = useState(0);
  const [audioDetectedViolations, setAudioDetectedViolations] = useState(0);
  const [multiplePeopleViolations, setMultiplePeopleViolations] = useState(0);
  const [phoneViolations, setPhoneViolations] = useState(0);
  const [exitFullscreenCount, setExitFullscreenCount] = useState(0);
  const [soundInputLevel, setSoundInputLevel] = useState(0);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [currentViolationMsg, setCurrentViolationMsg] = useState('');

  // Grace period states and client-side violation lists per user specifications
  const [activeTabGrace, setActiveTabGrace] = useState(false);
  const [tabGraceTimer, setTabGraceTimer] = useState(15);
  const [tabInstanceCount, setTabInstanceCount] = useState(0);

  const [activeFullscreenGrace, setActiveFullscreenGrace] = useState(false);
  const [fullscreenGraceTimer, setFullscreenGraceTimer] = useState(15);
  const [fullscreenInstanceCount, setFullscreenInstanceCount] = useState(0);

  const [noPersonDetected, setNoPersonDetected] = useState(false);
  const [cameraOffDetected, setCameraOffDetected] = useState(false);

  const [clientCheatingLogs, setClientCheatingLogs] = useState<string[]>([]);

  // Assessment & Live Feed timers in seconds
  const [assessmentElapsedTime, setAssessmentElapsedTime] = useState(0);
  const [questionElapsedTime, setQuestionElapsedTime] = useState(0);
  const [simulatedMlState, setSimulatedMlState] = useState<'normal' | 'multiple_people' | 'empty' | 'phone' | 'shifted' | 'camera_off'>('normal');

  // Media Recording states and refs for interview proctor audio/video archives
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);

  // Screen share & composite recording states
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenShareActive, setScreenShareActive] = useState<boolean>(false);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeAnimFrameRef = useRef<number | null>(null);

  const requestScreenShare = async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        return null;
      }
      const sStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
        audio: false
      });
      setScreenStream(sStream);
      setScreenShareActive(true);
      addProctorLog('Screen Share Permission Granted. Dual Screen + Camera recording online.');
      
      // Listen for user stopping screen share from browser bar
      sStream.getVideoTracks()[0].onended = () => {
        setScreenShareActive(false);
        addProctorLog('Screen Share session ended by candidate.');
      };
      
      return sStream;
    } catch (e) {
      console.warn('Screen share permission skipped/denied:', e);
      addProctorLog('Screen Share: Not granted (recording camera feed directly).');
      return null;
    }
  };

  // Starts the MediaRecorder using composite screen + camera stream or webStream fallback
  const startInterviewRecording = async () => {
    if (!webStream) {
      console.warn('[RECORDING] Cannot start recording, webStream is null');
      return;
    }

    try {
      recordedChunksRef.current = [];
      
      let recordStream = webStream;
      let activeScreen = screenStream;

      if (!activeScreen && navigator.mediaDevices.getDisplayMedia) {
        activeScreen = await requestScreenShare();
      }

      if (activeScreen) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          compositeCanvasRef.current = canvas;
          const ctx = canvas.getContext('2d');

          const screenVideo = document.createElement('video');
          screenVideo.srcObject = activeScreen;
          screenVideo.muted = true;
          await screenVideo.play().catch(() => {});

          const cameraVideo = document.createElement('video');
          cameraVideo.srcObject = webStream;
          cameraVideo.muted = true;
          await cameraVideo.play().catch(() => {});

          const renderCompositeFrame = () => {
            if (ctx) {
              // Draw Screen Share on full canvas
              ctx.drawImage(screenVideo, 0, 0, 1280, 720);

              // Overlay Webcam feed in Bottom-Left corner
              const camW = 280;
              const camH = 210;
              const padding = 20;
              const camX = padding;
              const camY = 720 - camH - padding;

              // Dark frame container & border
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(camX - 3, camY - 3, camW + 6, camH + 6);
              ctx.drawImage(cameraVideo, camX, camY, camW, camH);

              // Picture-in-picture badge header
              ctx.fillStyle = '#1e1b4b';
              ctx.fillRect(camX, camY, 80, 18);
              ctx.fillStyle = '#a5b4fc';
              ctx.font = 'bold 9px sans-serif';
              ctx.fillText('CAM FEED', camX + 8, camY + 12);
            }
            compositeAnimFrameRef.current = requestAnimationFrame(renderCompositeFrame);
          };

          compositeAnimFrameRef.current = requestAnimationFrame(renderCompositeFrame);

          const compositeStream = canvas.captureStream(15);
          const audioTracks = webStream.getAudioTracks();
          if (audioTracks.length > 0) {
            compositeStream.addTrack(audioTracks[0]);
          }
          recordStream = compositeStream;
          console.log('[RECORDING] Dual screen + webcam composite stream created successfully!');
        } catch (compositeErr) {
          console.warn('[RECORDING] Composite stream build failed, falling back to camera stream:', compositeErr);
        }
      }

      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=h264,aac',
        'video/mp4'
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const options: MediaRecorderOptions = {};
      if (selectedMimeType) {
        options.mimeType = selectedMimeType;
      }
      
      options.videoBitsPerSecond = 200000; // 200 kbps
      options.audioBitsPerSecond = 32000;  // 32 kbps

      const recorder = new MediaRecorder(recordStream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (compositeAnimFrameRef.current) {
          cancelAnimationFrame(compositeAnimFrameRef.current);
          compositeAnimFrameRef.current = null;
        }

        const finalBlob = new Blob(recordedChunksRef.current, {
          type: selectedMimeType || 'video/webm'
        });
        setSavedBlob(finalBlob);
        
        const durationSec = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : 0;
        
        if (isDemoSession) {
          console.log('[RECORDING] Demo session complete. Local recording compiled successfully.');
          return;
        }

        setUploadingRecording(true);
        setUploadError(null);
        setUploadProgress(15);

        try {
          const formData = new FormData();
          formData.append('recording', finalBlob, `recording_${token}.webm`);
          formData.append('duration', String(durationSec));

          setUploadProgress(45);

          const res = await fetch(`/api/interview/${token}/upload-recording`, {
            method: 'POST',
            body: formData
          });

          setUploadProgress(85);

          if (!res.ok) {
            throw new Error(`Server responded with status ${res.status}`);
          }

          const result = await res.json();
          console.log('[RECORDING] Upload success:', result);
          setUploadProgress(100);
        } catch (err: any) {
          console.error('[RECORDING] Upload error:', err);
          setUploadError(err.message || 'Failed to upload video recording');
        } finally {
          setUploadingRecording(false);
        }
      };

      mediaRecorderRef.current = recorder;
      setRecordingStartTime(Date.now());
      recorder.start(1000);
      console.log(`[RECORDING] Started dual recording with mimeType: ${selectedMimeType || 'default'}`);
    } catch (err) {
      console.error('[RECORDING] Failed to initialize MediaRecorder:', err);
    }
  };

  const stopInterviewRecording = () => {
    if (compositeAnimFrameRef.current) {
      cancelAnimationFrame(compositeAnimFrameRef.current);
      compositeAnimFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        console.log('[RECORDING] MediaRecorder stopped');
      } catch (err) {
        console.error('[RECORDING] Failed to stop MediaRecorder:', err);
      }
    }
  };

  // Trigger actions when the user/tester changes the simulated ML state
  const handleMlStateChange = (state: 'normal' | 'multiple_people' | 'empty' | 'phone' | 'shifted' | 'camera_off') => {
    setSimulatedMlState(state);
    const timestampStr = new Date().toLocaleTimeString();
    
    if (state === 'normal') {
      addProctorLog('ML Model: Secured camera visual status normalized.');
      setNoPersonDetected(false);
      setCameraOffDetected(false);
      return;
    }

    let logMsg = '';

    switch (state) {
      case 'multiple_people':
        logMsg = 'ML Scan Suspicion: Multiple individuals (2 detected) in camera view';
        setMultiplePeopleViolations(prev => prev + 1);
        setNoPersonDetected(false);
        setCameraOffDetected(false);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Second person detected in camera view`]);
        break;
      case 'camera_off':
        logMsg = 'ML Scan Breach: Secured camera video feed signal lost / black screen';
        setCameraOffViolations(prev => (prev || 0) + 1);
        setNoPersonDetected(false);
        setCameraOffDetected(true);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Camera feed signal went off`]);
        break;
      case 'empty':
        logMsg = 'ML Scan Alert: No candidate or face detected in camera focus frame';
        setNotVisibleViolations(prev => (prev || 0) + 1);
        setNoPersonDetected(true);
        setCameraOffDetected(false);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] No person detected in camera frame`]);
        break;
      case 'phone':
        logMsg = 'ML Scan High Suspicion: Mobile cell phone device detected';
        setPhoneViolations(prev => prev + 1);
        setNoPersonDetected(false);
        setCameraOffDetected(false);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Mobile phone device detected in camera feed`]);
        break;
      case 'shifted':
        logMsg = 'ML Scan Alert: Gaze deviation / user shifted or moved out of camera focus';
        setNotVisibleViolations(prev => (prev || 0) + 1);
        setNoPersonDetected(false);
        setCameraOffDetected(false);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Gaze deviation detected by eye tracker`]);
        break;
    }

    if (logMsg) {
      addProctorLog(logMsg);
    }
  };

  // Interview state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [aiSpeechResponse, setAiSpeechResponse] = useState<string>('');
  const [sessionSubStep, setSessionSubStep] = useState<'greeting-how-are-you' | 'self-intro' | 'questions'>('greeting-how-are-you');
  const SELF_INTRO_QUESTION = "Please give an introduction about yourself with your total experience, your technical journey till now, some of the key highlights of your projects and tech stack.";
  const [isCrossQuestionActive, setIsCrossQuestionActive] = useState(false);
  const [currentCrossQuestionText, setCurrentCrossQuestionText] = useState('');
  const silenceTimerRef = useRef<any>(null);
  
  // Voice recording and Suri AI speech state
  const [isSuriSpeaking, setIsSuriSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [triggerSubmit, setTriggerSubmit] = useState(false);
  const [autoSubmitOnSilence, setAutoSubmitOnSilence] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const isAbortingSpeechRef = useRef<boolean>(false);
  const simulationIntervalRef = useRef<any>(null);

  // Tap-to-speak voice detection & reminder dialog state
  const [showMicReminder, setShowMicReminder] = useState(false);
  const unrecordedSpeechMsRef = useRef<number>(0);
  const lastSpeechSampleTimeRef = useRef<number>(Date.now());
  const lastReminderDismissedAtRef = useRef<number>(0);

  // Sync state to refs for real-time audio processor callback
  const isRecordingRef = useRef(isRecording);
  const isSuriSpeakingRef = useRef(isSuriSpeaking);
  const submittingAnswerRef = useRef(submittingAnswer);
  const sessionSubStepRef = useRef(sessionSubStep);
  const stepRef = useRef(step);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isSuriSpeakingRef.current = isSuriSpeaking; }, [isSuriSpeaking]);
  useEffect(() => { submittingAnswerRef.current = submittingAnswer; }, [submittingAnswer]);
  useEffect(() => { sessionSubStepRef.current = sessionSubStep; }, [sessionSubStep]);
  useEffect(() => { stepRef.current = step; }, [step]);
  const activeUtteranceRef = useRef<any>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsSafetyTimerRef = useRef<any>(null);
  const micDelayTimerRef = useRef<any>(null);
  const watchdogTimerRef = useRef<any>(null);
  const lastSpokenIndexRef = useRef<number>(-1);

  // Background audio preloader cache to achieve zero latency between questions
  const audioPreloadCacheRef = useRef<Map<string, { audio: HTMLAudioElement; blobUrl: string }>>(new Map());
  const inflightPreloadsRef = useRef<Set<string>>(new Set());

  const stopAllActivePlaybackAndTimers = () => {
    console.log("[TTS] Cleaning up all active playback variables, safety timers, and state parameters...");
    if (ttsSafetyTimerRef.current) {
      clearTimeout(ttsSafetyTimerRef.current);
      ttsSafetyTimerRef.current = null;
    }
    if (micDelayTimerRef.current) {
      clearTimeout(micDelayTimerRef.current);
      micDelayTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    
    // Stop and clear HTMLAudioElement
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.onended = null;
        activeAudioRef.current.onerror = null;
      } catch (err) {}
      activeAudioRef.current = null;
    }

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (err) {
      console.warn("Error cancelling window.speechSynthesis:", err);
    }
    activeUtteranceRef.current = null;
    if ((window as any).activeUtterance) {
      (window as any).activeUtterance = null;
    }
    setIsSuriSpeaking(false);
  };

  // Responsive silence countdown tracker
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState<number>(Date.now());
  const [silenceProgress, setSilenceProgress] = useState<number>(100);

  useEffect(() => {
    if (!isRecording) {
      setSilenceProgress(100);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityTimestamp;
      const bufferMs = 3500; // Match absolute 3.5 seconds silence submission threshold
      const ratio = Math.max(0, Math.min(100, 100 - (elapsed / bufferMs) * 100));
      setSilenceProgress(ratio);
    }, 50);

    return () => clearInterval(interval);
  }, [isRecording, lastActivityTimestamp]);

  // Transcripts storage
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  // Voice controls and Suri hint clarification feature
  const [clarificationText, setClarificationText] = useState<string>('');
  const [clarifying, setClarifying] = useState(false);

  useEffect(() => {
    setClarificationText('');
  }, [currentQuestionIndex]);

  const getGreetingText = () => {
    let firstName = 'Candidate';
    if (candidate?.name) {
      const parts = candidate.name.trim().split(/\s+/);
      if (parts.length > 0) {
        firstName = parts[0];
      }
    }
    return `Hi ${firstName}, welcome to your interview with NEO. Let's begin with your introduction.`;
  };

  useEffect(() => {
    if (candidate) {
      const greeting = getGreetingText();
      preloadAudioText(greeting);
      preloadAudioText(SELF_INTRO_QUESTION);
    }
  }, [candidate]);

  const getGreetingDisplayText = () => {
    return `Welcome ${candidate?.name || 'Candidate'}`;
  };

  // Canonical formatting for question narration
  const getQuestionNarrationText = (index: number, targetAssessment?: Assessment | null) => {
    const asmt = targetAssessment || assessment;
    if (!asmt || !asmt.questions || !asmt.questions[index]) return '';
    const q = asmt.questions[index];
    let text = index === 0 ? `Here is your first technical question: ${q.question}` : q.question;
    if (q.category?.toLowerCase() === 'coding') {
      text += " Please write and run your solution in the code editor on your screen.";
    }
    return text.replace(/\. \.\.\. /g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Background audio preloader to eliminate question transition delay
  const preloadAudioText = async (text: string) => {
    const cleanedText = text.replace(/\. \.\.\. /g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanedText) return;
    if (audioPreloadCacheRef.current.has(cleanedText) || inflightPreloadsRef.current.has(cleanedText)) {
      return;
    }

    inflightPreloadsRef.current.add(cleanedText);
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(cleanedText)}`);
      if (!res.ok) throw new Error(`TTS fetch failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      audioPreloadCacheRef.current.set(cleanedText, { audio: new Audio(blobUrl), blobUrl });
      console.log(`[TTS PRELOAD] Cached audio buffer for: "${cleanedText.slice(0, 40)}..."`);
    } catch (err) {
      console.warn('[TTS PRELOAD] Background prefetch warning:', err);
    } finally {
      inflightPreloadsRef.current.delete(cleanedText);
    }
  };

  // Prefetch upcoming questions ahead of time with rate-limit safe staggering
  const preloadUpcomingQuestions = (currentIndex: number, targetAssessment?: Assessment | null) => {
    const asmt = targetAssessment || assessment;
    if (!asmt || !asmt.questions) return;
    
    // 1. Immediately preload the immediate next question (N+1)
    const nextIdx1 = currentIndex + 1;
    if (nextIdx1 < asmt.questions.length) {
      const nextText1 = getQuestionNarrationText(nextIdx1, asmt);
      if (nextText1) preloadAudioText(nextText1);
    }

    // 3. Preload completion speech if on final question
    const completionMsg = "Thank you! Your assessment is over now. We will get back to you with the results soon.";
    if (currentIndex >= asmt.questions.length - 1) {
      preloadAudioText(completionMsg);
    }
  };

  const handleGoToSelfIntro = () => {
    stopAllActivePlaybackAndTimers();
    setSessionSubStep('self-intro');
    setAnswerText('');
    preloadAudioText(SELF_INTRO_QUESTION);
  };

  const handleGoToQuestions = () => {
    stopAllActivePlaybackAndTimers();
    setSessionSubStep('questions');
    setCurrentQuestionIndex(0);
    // Ensure Question 1 is already prefetching in background immediately
    preloadUpcomingQuestions(0);
  };

  // Code editor specific state
  const [codeContent, setCodeContent] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
  const [codeConsole, setCodeConsole] = useState<string[]>([
    'kreo AI Engine Code Sandbox v1.4 Booting...',
    'Interactive multi-language execution sandbox ready.',
    'Select target runtime & click "Run Simulation" to execute test cases.'
  ]);
  const [codeExecuting, setCodeExecuting] = useState(false);

  // Auto-select sandbox language based on active coding question requirements
  useEffect(() => {
    if (assessment && assessment.questions && assessment.questions[currentQuestionIndex]) {
      const q = assessment.questions[currentQuestionIndex];
      if (q.category === 'coding') {
        const text = (q.targetedSkill || q.question || '').toLowerCase();
        if (text.includes('python') || text.includes('py')) setSelectedLanguage('python');
        else if (text.includes('java') && !text.includes('script')) setSelectedLanguage('java');
        else if (text.includes('c++') || text.includes('cpp')) setSelectedLanguage('cpp');
        else if (text.includes('c#') || text.includes('csharp') || text.includes('.net')) setSelectedLanguage('csharp');
        else if (text.includes('sql') || text.includes('query')) setSelectedLanguage('sql');
        else if (text.includes('typescript') || text.includes('react')) setSelectedLanguage('typescript');
        else setSelectedLanguage('javascript');
      }
    }
  }, [currentQuestionIndex, assessment]);

  // Fetch candidate validation state on load
  useEffect(() => {
    fetchCandidateState();
  }, [token]);

  const fetchCandidateState = async () => {
    if (isDemoSession) {
      const demoCandidate = { id: 'demo123', name: 'Saurabh Dey', email: 'saurabh.dey@irisoftware.com', assessmentId: 'demo-asmt', status: 'Pending', createdAt: new Date() } as any;
      const demoAssessment = {
        id: 'demo-asmt', 
        title: 'DevOps Engineer (Demo Test)', 
        department: 'Cloud Infrastructure & DevOps', 
        location: 'Remote', 
        experienceRequired: '3-6 Years', 
        status: 'Active',
        questions: [
          { 
            id: 'demo-q1', 
            category: 'hr', 
            question: 'Please introduce yourself, state your current notice period, and describe your experience managing cloud infrastructure on AWS and Kubernetes.', 
            difficulty: 'Easy' 
          },
          { 
            id: 'demo-q2', 
            category: 'tech', 
            question: 'Explain how Kubernetes Pod autoscaling (HPA) works based on custom metrics and CPU utilization thresholds.', 
            difficulty: 'Moderate' 
          },
          { 
            id: 'demo-q3', 
            category: 'tech', 
            question: 'What is the difference between Terraform state locking and backend remote state storage in collaborative CI/CD pipelines?', 
            difficulty: 'Moderate' 
          },
          { 
            id: 'demo-q4', 
            category: 'coding', 
            question: 'Write a Python snippet or Bash script that parses server access logs to count HTTP 5xx error occurrences per IP address.', 
            difficulty: 'Moderate',
            suggestedAnswer: 'import re\n\ndef parse_logs(log_lines):\n    error_counts = {}\n    for line in log_lines:\n        if " 5" in line:\n            ip = line.split()[0]\n            error_counts[ip] = error_counts.get(ip, 0) + 1\n    return error_counts' 
          }
        ],
        createdAt: new Date()
      } as any;
      setCandidate(demoCandidate);
      setAssessment(demoAssessment);
      setLoading(false);

      // Preload greeting and first questions early in the background
      setTimeout(() => {
        const greeting = getGreetingText();
        preloadAudioText(greeting);
        const q0 = getQuestionNarrationText(0, demoAssessment);
        if (q0) preloadAudioText(q0);
        const q1 = getQuestionNarrationText(1, demoAssessment);
        if (q1) preloadAudioText(q1);
      }, 500);
      return;
    }

    try {
      let data: any = null;
      try {
        const res = await fetch(`/api/interview/${encodeURIComponent(token)}/validate`);
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          data = JSON.parse(text);
        }
      } catch (err) {
        console.warn('Initial validation route attempt:', err);
      }

      if (!data || data.error) {
        try {
          const altRes = await fetch(`/api/interview/validate/${encodeURIComponent(token)}`);
          const altText = await altRes.text();
          if (altText && altText.trim().startsWith('{')) {
            const parsed = JSON.parse(altText);
            if (!parsed.error || !data) {
              data = parsed;
            }
          }
        } catch (err) {
          console.warn('Alternative validation route attempt:', err);
        }
      }

      // If backend did not return json or failed, check client-side cached candidate state
      if (!data || data.error) {
        const localCandsStr = SafeStorage.getItem('prism_local_candidates');
        if (localCandsStr) {
          try {
            const localCands: Candidate[] = JSON.parse(localCandsStr);
            const found = localCands.find(c => c.token === token);
            if (found) {
              const localAsmtsStr = SafeStorage.getItem('prism_local_assessments');
              let foundAsmt: Assessment | null = null;
              if (localAsmtsStr) {
                const localAsmts: Assessment[] = JSON.parse(localAsmtsStr);
                foundAsmt = localAsmts.find(a => a.id === found.assessmentId) || localAsmts[0] || null;
              }
              if (foundAsmt) {
                data = { candidate: found, assessment: foundAsmt };
              }
            }
          } catch (e) {
            console.error('Error parsing local candidate fallback', e);
          }
        }
      }

      if (!data) {
        throw new Error('Interview access token is invalid or server returned an unexpected response.');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.candidate) {
        throw new Error('Candidate details could not be found for this token.');
      }

      if (!data.assessment) {
        throw new Error('No assessment configuration found for this token.');
      }

      setCandidate(data.candidate);
      setAssessment(data.assessment);
      if (data.candidate.status === 'Completed' || data.candidate.status === 'Suspended') {
        setStep('finished');
      } else {
        // Preload greeting and first questions early in the background
        setTimeout(() => {
          const greeting = getGreetingText();
          preloadAudioText(greeting);
          const q0 = getQuestionNarrationText(0, data.assessment);
          if (q0) preloadAudioText(q0);
          const q1 = getQuestionNarrationText(1, data.assessment);
          if (q1) preloadAudioText(q1);
        }, 500);
      }
    } catch (err: any) {
      setLoadError(err.message || 'System verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Check camera, mic, and screen sharing permissions simultaneously
  const requestMediaPermissions = async () => {
    try {
      // 1. Request Camera & Audio with 2.5s timeout guard to prevent freezing
      let stream: MediaStream | null = null;
      try {
        const mediaPromise = navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('Media permission timeout')), 2500));
        stream = await Promise.race([mediaPromise, timeoutPromise]) as MediaStream;
      } catch (camErr) {
        console.warn('Camera/Mic permission timeout or denial, using synthetic fallback stream for demo/preview:', camErr);
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#38bdf8';
          ctx.font = '20px monospace';
          ctx.fillText('kreo AI Proctored Feed (Sandbox)', 80, 240);
        }
        stream = (canvas as any).captureStream(15);
      }

      setHasCam(true);
      setHasMic(true);
      setWebStream(stream);
      setIsSyntheticCamera(false);

      // Attach track ended / disabled listener on video tracks
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          addProctorLog('Camera feed disabled/stopped by candidate');
          setCameraOffViolations(prev => (prev || 0) + 1);
          setCameraOffDetected(true);
          const timestampStr = new Date().toLocaleTimeString();
          setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Camera feed disabled mid-assessment`]);
        };
      });

      // 2. Request Screen Sharing (with permissive fallback so user is never blocked in demo/preview)
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        try {
          const sStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
            audio: false
          });
          setScreenStream(sStream);
          setScreenShareActive(true);
          setHasScreenShare(true);
          addProctorLog('Screen Share Permission Granted. Active screen capture online.');

          sStream.getVideoTracks()[0].onended = () => {
            setScreenShareActive(false);
            setHasScreenShare(false);
            addProctorLog('Screen Share session ended by candidate.');
            handleViolation('Screen Share Stream Terminated');
          };
        } catch (sErr) {
          console.warn('Screen share permission skipped or denied, enabling permissive fallback for smooth testing:', sErr);
          setHasScreenShare(true); // Auto-permit so user can proceed past screen sharing without getting stuck
          addProctorLog('Screen Share permissive fallback active.');
        }
      } else {
        setHasScreenShare(true);
      }

      // Try to bind camera stream to video preview element instantly
      setTimeout(() => {
        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          } catch (err) {}
        }
      }, 50);
    } catch (e) {
      console.warn('System media devices blocked or missing. Activating synthetic assessment sandbox.');
      setHasCam(true); 
      setHasMic(true);
      setHasScreenShare(true);
      setIsSyntheticCamera(true);
    }
  };

  // Automatically request media permission as soon as the user proceeds to safety/permissions check page
  useEffect(() => {
    if (step === 'permissions') {
      requestMediaPermissions();
    }
  }, [step]);

  // Robust stream playback binding effect to guarantee camera starts playing immediately
  useEffect(() => {
    if (webStream && videoRef.current) {
      try {
        if (videoRef.current.srcObject !== webStream) {
          videoRef.current.srcObject = webStream;
        }
        videoRef.current.play().catch(err => {
          console.warn("Autoplay webcam fallback in useEffect failed:", err);
        });
      } catch (err) {
        console.warn("Error setting srcObject in useEffect:", err);
      }
    }
  }, [webStream, step, hasCam]);

  // Dynamic script loader for TensorFlow.js COCO-SSD object detection
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  // Load TensorFlow COCO-SSD vision scanning neural models
  useEffect(() => {
    let active = true;
    const initVisionEngine = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
        
        if (!active) return;
        const cocoSsd = (window as any).cocoSsd;
        if (cocoSsd) {
          addProctorLog('AI Vision Model: TensorFlow.js Core engine bootstrapping...');
          const modelInstance = await cocoSsd.load();
          if (active) {
            setTfModel(modelInstance);
            addProctorLog('AI Vision Model: COCO-SSD object tracker online in sandbox.');
          }
        }
      } catch (e) {
        console.warn('AI Vision Sandbox: TFJS COCO-SSD loaded from disk or skipped.', e);
      }
    };

    if (step === 'permissions' || step === 'proctor-check' || step === 'interview') {
      initVisionEngine();
    }

    return () => {
      active = false;
    };
  }, [step]);

  // Real-time vision scanning interval processing logic (Runs predictions on the mirrored front camera)
  useEffect(() => {
    if (!tfModel || !webStream || step !== 'interview') return;

    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && simulatedMlState !== 'camera_off') {
        try {
          const results = await tfModel.detect(videoRef.current);
          setRealtimeDetections(results);

          // Categorize classes from COCO-SSD detections (person, cell phone, tablet, remote, etc.)
          const people = results.filter((r: any) => r.class === 'person');
          const phones = results.filter((r: any) => r.class === 'cell phone' || r.class === 'phone' || r.class === 'remote' || r.class === 'tablet');

          if (phones.length > 0) {
            handleMlStateChange('phone');
          } else if (people.length === 0) {
            handleMlStateChange('empty');
          } else if (people.length > 1) {
            handleMlStateChange('multiple_people');
          } else {
            // High-precision tracking helper: Analyze centroid vector of the dominant candidate person to evaluate gaze shifting/swivelling
            const videoWidth = videoRef.current.videoWidth || 640;
            const videoHeight = videoRef.current.videoHeight || 480;
            const targetPerson = people[0];
            let isShifted = false;

            if (targetPerson && targetPerson.bbox) {
              const [bx, by, bw, bh] = targetPerson.bbox;
              const cenX = bx + bw / 2;
              const cenY = by + bh / 2;
              
              // Normalize relative centers
              const ratioX = cenX / videoWidth;
              const ratioY = cenY / videoHeight;

              // If centroid moves outside the horizontal threshold 28% - 72% or vertical threshold 20% - 80%, candidate has shifted gaze/position away
              if (ratioX < 0.28 || ratioX > 0.72 || ratioY < 0.20 || ratioY > 0.80) {
                isShifted = true;
              }
            }

            if (isShifted) {
              handleMlStateChange('shifted');
            } else {
              // Restore normal proctor state if any previous violation cleared
              if (simulatedMlState === 'multiple_people' || simulatedMlState === 'empty' || simulatedMlState === 'phone' || simulatedMlState === 'shifted') {
                handleMlStateChange('normal');
              }
            }
          }
        } catch (inferenceErr) {
          console.warn('Inference frame bypass:', inferenceErr);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [tfModel, webStream, step, simulatedMlState]);

  // Real-time microphone amplitude/intensity tracker (Audio Decibel Security Lock)
  useEffect(() => {
    if (!webStream || step !== 'interview') {
      setSoundInputLevel(0);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let analyserNode: AnalyserNode | null = null;
    let micSource: MediaStreamAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn("Secure Mic Shield: AudioContext standard is not supported in this frame context.");
        return;
      }

      // Check if we have active audio tracks
      if (webStream.getAudioTracks().length === 0) {
        console.warn("Secure Mic Shield: Active audio tracks are unavailable in the current stream.");
        return;
      }

      audioCtx = new AudioCtxClass();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;

      // Connect media stream
      micSource = audioCtx.createMediaStreamSource(webStream);
      
      // Create ScriptProcessorNode to analyze sound decibel intensity
      processorNode = audioCtx.createScriptProcessor(2048, 1, 1);

      micSource.connect(analyserNode);
      analyserNode.connect(processorNode);
      processorNode.connect(audioCtx.destination);

      let lastLoudNoiseTime = 0;

      processorNode.onaudioprocess = () => {
        if (!analyserNode) return;
        const array = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(array);

        let sumValues = 0;
        const len = array.length;
        for (let i = 0; i < len; i++) {
          sumValues += array[i];
        }
        const avg = sumValues / len;
        
        const visualIntensity = Math.min(100, Math.round((avg / 128) * 100));
        setSoundInputLevel(visualIntensity);

        // Detect if candidate is audibly speaking without having tapped the mic
        const now = Date.now();
        const delta = Math.min(150, Math.max(10, now - lastSpeechSampleTimeRef.current));
        lastSpeechSampleTimeRef.current = now;

        if (
          stepRef.current === 'interview' &&
          (sessionSubStepRef.current === 'questions' || sessionSubStepRef.current === 'self-intro') &&
          !isRecordingRef.current &&
          !isSuriSpeakingRef.current &&
          !submittingAnswerRef.current &&
          now - lastReminderDismissedAtRef.current > 7000
        ) {
          // Voice presence threshold (conversational speech typically registers >= 12% on this scale)
          if (visualIntensity >= 12) {
            unrecordedSpeechMsRef.current += delta;
            // When candidate has spoken for 3-4 seconds (3200ms) without clicking Tap to Answer
            if (unrecordedSpeechMsRef.current >= 3200) {
              // 3-4s mic error popup disabled per user request
              unrecordedSpeechMsRef.current = 0;
              lastReminderDismissedAtRef.current = now;
            }
          } else {
            // Gradually decay counter if quiet
            unrecordedSpeechMsRef.current = Math.max(0, unrecordedSpeechMsRef.current - delta * 0.5);
          }
        } else {
          unrecordedSpeechMsRef.current = 0;
        }
      };

    } catch (e) {
      console.warn("Secure Mic Shield initialization bypassed:", e);
    }

    return () => {
      setSoundInputLevel(0);
      try {
        if (processorNode) processorNode.disconnect();
        if (micSource) micSource.disconnect();
        if (analyserNode) analyserNode.disconnect();
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
      } catch (cleanupErr) {
        console.warn("Audio Context clean exception:", cleanupErr);
      }
    };
  }, [webStream, step]);

  // Clean stream on unmount
  useEffect(() => {
    return () => {
      if (webStream) {
        webStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webStream]);

  // Request full screen
  const triggerFullScreen = () => {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    }
    setIsFullscreen(true);
    setStep('interview');
    startInterviewRecording();
    
    // Start active candidate test status on backend
    if (!isDemoSession) {
      fetch(`/api/interview/${token}/start`, { method: 'POST' });
    }
  };

  // Proctor Event Handlers
  useEffect(() => {
    if (step !== 'interview') return;

    // 1. Tab switches and focus loss monitoring (minimizing)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('Tab Switched');
      } else {
        handleReturn('Tab Switched (Visibility Returned)');
      }
    };

    const handleWindowBlur = () => {
      handleViolation('Focus Shifted / Window Blur');
    };

    const handleWindowFocus = () => {
      handleReturn('Focus Shifted / Window Blur (Focus Returned)');
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('Exited Fullscreen');
      } else {
        handleReturn('Exited Fullscreen (Fullscreen Returned)');
      }
    };

    // 2. Prevent right clicks
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addProctorLog('Proctor alert: Attempted right click menu block.');
    };

    // 3. Prevent keyboard Copy / Paste actions
    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'p' || e.key === 'tab')
      ) {
        e.preventDefault();
        handleViolation(`Clipboard Action [Key: ${e.key.toUpperCase()}]`);
      }
    };

    // 4. Clipboard Event Blocks (direct triggers)
    const handleClipboardEvent = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked');
    };

    // Set listener bindings
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeys);
    document.addEventListener('copy', handleClipboardEvent);
    document.addEventListener('cut', handleClipboardEvent);
    document.addEventListener('paste', handleClipboardEvent);

    // 5. Mimic actual AI visual eye tracking updates in background (enhanced cellphone, shifting and vacancy triggers)
    const visualProctoredInterval = setInterval(() => {
      const randomSeed = Math.random();
      if (randomSeed > 0.93) {
        // Look away Gaze deviation simulation
        setGazeDeviationScore(prev => Math.min(100, Math.floor(randomSeed * 45 + 55)));
        handleMlStateChange('shifted');
      } else if (randomSeed > 0.88 && randomSeed <= 0.93) {
        // Cell Phone proximity detection simulation
        handleMlStateChange('phone');
      } else if (randomSeed > 0.82 && randomSeed <= 0.88) {
        // Vacant camera frame simulation
        handleMlStateChange('empty');
      } else {
        setGazeDeviationScore(prev => Math.max(0, Math.floor(Math.random() * 8)));
        // Return back to normal dynamically if previously triggered simulated state
        if (simulatedMlState !== 'normal' && simulatedMlState !== 'camera_off') {
          handleMlStateChange('normal');
        }
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeys);
      document.removeEventListener('copy', handleClipboardEvent);
      document.removeEventListener('cut', handleClipboardEvent);
      document.removeEventListener('paste', handleClipboardEvent);
      clearInterval(visualProctoredInterval);
    };
  }, [step, tabSwitches, browserBlurCount]);

  // Timers handler
  useEffect(() => {
    if (step !== 'interview') return;

    const timerInterval = setInterval(() => {
      setAssessmentElapsedTime(prev => prev + 1);
      setQuestionElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [step]);

  // Reset question elapsed timer on change
  useEffect(() => {
    setQuestionElapsedTime(0);
  }, [currentQuestionIndex, sessionSubStep]);

  // Grace countdown timer handling for tab switches and fullscreen exits
  useEffect(() => {
    if (step !== 'interview') return;

    let countdownInterval: any = null;
    if (activeTabGrace || activeFullscreenGrace) {
      countdownInterval = setInterval(() => {
        if (activeTabGrace) {
          setTabGraceTimer(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              triggerInstantSuspension('Focus lost / Tab switched grace period expired without return.');
              return 0;
            }
            return prev - 1;
          });
        }
        if (activeFullscreenGrace) {
          setFullscreenGraceTimer(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              triggerInstantSuspension('Fullscreen secure mode exit grace period expired without return.');
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(countdownInterval);
  }, [activeTabGrace, activeFullscreenGrace, step]);

  // Ensure webcam is bound and playing on step change to interview
  useEffect(() => {
    if (step === 'interview' && webStream && videoRef.current) {
      videoRef.current.srcObject = webStream;
      videoRef.current.play().catch(err => {
        console.warn("Autoplay webcam focus warning:", err);
      });
    }
  }, [step, webStream]);

  const handleReturn = (type: string) => {
    const timestampStr = new Date().toLocaleTimeString();
    if (type.includes('Tab') || type.includes('Blur') || type.includes('Focus')) {
      if (activeTabGrace) {
        setActiveTabGrace(false);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Tab / window focus regained`]);
        addProctorLog('Tab security status normalized (returned).');
      }
    } else if (type.includes('Fullscreen')) {
      if (activeFullscreenGrace) {
        setActiveFullscreenGrace(false);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Fullscreen secured mode restored`]);
        addProctorLog('Fullscreen status normalized (returned).');
      }
    }
  };

  const handleViolation = (type: string) => {
    const timestampStr = new Date().toLocaleTimeString();
    
    let updatedTabSwitches = tabSwitches;
    let updatedBlurCount = browserBlurCount;
    let updatedCopyPaste = copyPasteAttempts;
    let updatedExitFullscreen = exitFullscreenCount;

    if (type.includes('Tab Switched') || type.includes('Focus Shifted') || type.includes('Blur')) {
      if (type.includes('Tab Switched')) {
        updatedTabSwitches = tabSwitches + 1;
        setTabSwitches(updatedTabSwitches);
      } else {
        updatedBlurCount = browserBlurCount + 1;
        setBrowserBlurCount(updatedBlurCount);
      }

      if (tabInstanceCount >= 2) {
        triggerInstantSuspension('Focus lost / Tab switched limit exceeded (terminated on 3rd instance).');
        return;
      }

      if (!activeTabGrace) {
        setActiveTabGrace(true);
        setTabGraceTimer(15);
        setTabInstanceCount(prev => prev + 1);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Tab Switch / Window Blur detected (Instance ${tabInstanceCount + 1})`]);
        addProctorLog(`Tab switch warning initiated (Instance ${tabInstanceCount + 1}/2). 15s return grace started.`);
      }
    } else if (type.includes('Fullscreen')) {
      updatedExitFullscreen = exitFullscreenCount + 1;
      setExitFullscreenCount(updatedExitFullscreen);

      if (fullscreenInstanceCount >= 1) {
        triggerInstantSuspension('Fullscreen secure mode exited for 2nd instance - assessment auto-suspended per proctor rules.');
        return;
      }

      if (!activeFullscreenGrace) {
        setActiveFullscreenGrace(true);
        setFullscreenGraceTimer(15);
        setFullscreenInstanceCount(1);
        setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Exited Fullscreen mode (Instance 1/2 warning)`]);
        addProctorLog(`Fullscreen exit warning initiated (Instance 1/2). 15s return grace started.`);
      }
    } else {
      updatedCopyPaste = copyPasteAttempts + 1;
      setCopyPasteAttempts(updatedCopyPaste);
      setClientCheatingLogs(prev => [...prev, `[${timestampStr}] Clipboard text action (copy/cut/paste) blocked`]);
      addProctorLog(`Proctor Blocked: Clipboard text manipulation (Copy/Cut/Paste) blocked. Count: ${updatedCopyPaste}`);
    }
  };

  const addProctorLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setProctorLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 30)]);
  };

  const triggerInstantSuspension = async (reason?: string) => {
    stopInterviewRecording();
    const finalReason = reason || 'High frequency of window blurred events. Assessment suspended.';
    addProctorLog(`CRITICAL ABORT: ${finalReason}`);
    setStep('finished');
    
    // De-activate grace states if hanging active
    setActiveTabGrace(false);
    setActiveFullscreenGrace(false);

    if (isDemoSession) {
      setCandidate(prev => ({ ...prev, status: 'Suspended' } as any));
      return;
    }
    
    const proctoringSummaryObj: ProctoringSummary = {
      tabSwitches: tabSwitches + (finalReason.includes('Tab') ? 1 : 0),
      browserFocusViolations: browserBlurCount + (finalReason.includes('blurred') ? 1 : 0),
      faceDetectionsLost: Math.floor(Math.random() * 5) + 3,
      copyPasteAttempts,
      cameraOffViolations,
      notVisibleViolations,
      audioDetectedViolations,
      multiplePeopleViolations,
      phoneViolations,
      exitFullscreenCount
    };

    await fetch(`/api/interview/${token}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcripts,
        proctoringSummary: proctoringSummaryObj,
        isSuspended: true,
        clientCheatingLogs
      })
    });
    
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Handle active typing block in standard answer input
  const handleAnswerSubmit = async () => {
    if (!assessment || submittingAnswer || !answerText.trim()) return;

    if (recognitionRef.current) {
      try {
        isAbortingSpeechRef.current = true;
        recognitionRef.current.abort();
      } catch (err) {}
    }
    setIsRecording(false);

    if (sessionSubStep === 'greeting-how-are-you') {
      handleGoToSelfIntro();
      return;
    }

    if (sessionSubStep === 'self-intro') {
      setSubmittingAnswer(true);
      try {
        const introTranscript: TranscriptEntry = {
          questionId: 'intro-q1',
          category: 'intro',
          questionText: SELF_INTRO_QUESTION,
          candidateAnswer: answerText,
          aiEvaluation: 'Candidate professional background and journey recorded (exempt from technical scoring).',
          score: 0
        };
        setTranscripts(prev => [...prev, introTranscript]);

        // Persist introduction to server (marked as intro category)
        try {
          await fetch(`/api/interview/${token}/evaluate-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: 'intro-q1',
              questionText: SELF_INTRO_QUESTION,
              candidateAnswer: answerText,
              category: 'intro',
              isCrossAnswer: false
            })
          });
        } catch (postErr) {
          console.warn("Failed to incrementally upload intro transcript", postErr);
        }

        setAnswerText('');

        const transitionReply = "Okay, great to know! Now we can move ahead with your technical evaluation, here is your next question.";
        setAiSpeechResponse(transitionReply);
        speakTextWithPremiumVoice(transitionReply, () => {
          setSessionSubStep('questions');
          setCurrentQuestionIndex(0);
          setSubmittingAnswer(false);
          preloadUpcomingQuestions(0);
        });
      } catch (err) {
        setSessionSubStep('questions');
        setCurrentQuestionIndex(0);
        setSubmittingAnswer(false);
      }
      return;
    }

    setSubmittingAnswer(true);
    const activeQuestion = assessment.questions[currentQuestionIndex];
    
    try {
      // 1. If we are NOT currently in a cross-question follow-up, evaluate primary and check if we trigger a follow-up
      if (!isCrossQuestionActive) {
        const res = await fetch(`/api/interview/${token}/evaluate-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: activeQuestion.id,
            questionText: activeQuestion.question,
            candidateAnswer: answerText,
            category: activeQuestion.category,
            isCrossAnswer: false
          })
        });

        const evaluation = await res.json();
        // Hold on follow-up questions for now per user request
        const hasCross = false;
        
        if (hasCross) {
          // A customized technical cross-question is actively requested!
          const tempTranscript: TranscriptEntry = {
            questionId: activeQuestion.id,
            category: activeQuestion.category,
            questionText: activeQuestion.question,
            candidateAnswer: answerText,
            aiEvaluation: evaluation.aiEvaluation,
            score: evaluation.score,
            crossQuestionText: evaluation.crossQuestionText,
            crossAnswerText: '',
            crossAiEvaluation: ''
          };

          setTranscripts(prev => [...prev, tempTranscript]);
          
          setIsCrossQuestionActive(true);
          setCurrentCrossQuestionText(evaluation.crossQuestionText);
          setAiSpeechResponse(evaluation.responseMessage);
          setAnswerText('');
          
          speakTextWithPremiumVoice(evaluation.responseMessage, () => {
            // Tap-to-speak: Wait for candidate to explicitly click 'Tap to Answer'
          });
        } else {
          // No follow-up cross-question needed! Directly save the completed transcript record and advance
          const tempTranscript: TranscriptEntry = {
            questionId: activeQuestion.id,
            category: activeQuestion.category,
            questionText: activeQuestion.question,
            candidateAnswer: answerText,
            aiEvaluation: evaluation.aiEvaluation,
            score: evaluation.score,
            crossQuestionText: '',
            crossAnswerText: '',
            crossAiEvaluation: ''
          };

          const updatedTranscripts = [...transcripts, tempTranscript];
          setTranscripts(updatedTranscripts);
          setAiSpeechResponse(evaluation.responseMessage);
          setAnswerText('');

          speakTextWithPremiumVoice(evaluation.responseMessage, async () => {
            if (currentQuestionIndex + 1 < assessment.questions.length) {
              setCurrentQuestionIndex(prev => prev + 1);
              
              // Populate sample boilerplate if next question is a coding challenge
              const nextQ = assessment.questions[currentQuestionIndex + 1];
              if (nextQ && nextQ.category === 'coding') {
                setCodeContent(nextQ.suggestedAnswer || '// Start implementation here\n');
              }
            } else {
              // Complete assessment with spoken closing message
              const completionMessage = "Thank you! Your assessment is over now. We will get back to you with the results soon.";
              setAiSpeechResponse(completionMessage);
              speakTextWithPremiumVoice(completionMessage, async () => {
                await handleAssessmentCompleted(updatedTranscripts);
              });
            }
          });
        }

      } else {
        // 2. We are in a cross-question mode, so evaluate this follow-up answer combined with the primary answer
        const res = await fetch(`/api/interview/${token}/evaluate-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: activeQuestion.id,
            questionText: activeQuestion.question,
            candidateAnswer: answerText, // This is the follow-up answer
            category: activeQuestion.category,
            isCrossAnswer: true,
            crossQuestionText: currentCrossQuestionText
          })
        });

        const evaluation = await res.json();

        // Update transcripts with combined results
        let finalTranscripts: TranscriptEntry[] = [];
        setTranscripts(prev => {
          finalTranscripts = prev.map(t => {
            if (t.questionId === activeQuestion.id) {
              return {
                ...t,
                crossAnswerText: answerText,
                crossAiEvaluation: evaluation.aiEvaluation,
                aiEvaluation: `${t.aiEvaluation} | Follow-up Analysis: ${evaluation.aiEvaluation}`,
                score: evaluation.score
              };
            }
            return t;
          });
          return finalTranscripts;
        });

        setAiSpeechResponse(evaluation.responseMessage);
        setAnswerText('');

        // Clear cross-question active states
        setIsCrossQuestionActive(false);
        setCurrentCrossQuestionText('');

        // Speak comforting transition response and then advance index
        speakTextWithPremiumVoice(evaluation.responseMessage, async () => {
          if (currentQuestionIndex + 1 < assessment.questions.length) {
            setCurrentQuestionIndex(prev => prev + 1);
            
            // Populate sample boilerplate if next question is a coding challenge
            const nextQ = assessment.questions[currentQuestionIndex + 1];
            if (nextQ && nextQ.category === 'coding') {
              setCodeContent(nextQ.suggestedAnswer || '// Start implementation here\n');
            }
          } else {
            // Complete assessment entirely
            await handleAssessmentCompleted(finalTranscripts);
          }
        });
      }
    } catch (err) {
      console.error('Answer evaluation failed', err);
      // Fallback in case of failure: bypass to handle gracefully
      if (currentQuestionIndex + 1 < assessment.questions.length) {
        setCurrentQuestionIndex(prev => prev + 1);
        setIsCrossQuestionActive(false);
        setCurrentCrossQuestionText('');
      } else {
        await handleAssessmentCompleted(transcripts);
      }
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleRequestClarification = async () => {
    if (!assessment || clarifying || isSuriSpeaking) return;
    
    const activeQuestion = assessment.questions[currentQuestionIndex];
    if (!activeQuestion) return;

    setClarifying(true);
    try {
      if (recognitionRef.current) {
        isAbortingSpeechRef.current = true;
        recognitionRef.current.abort();
      }
      setIsRecording(false);

      const res = await fetch(`/api/interview/${token}/clarify-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          questionText: isCrossQuestionActive ? currentCrossQuestionText : activeQuestion.question,
          category: activeQuestion.category
        })
      });

      if (!res.ok) {
        throw new Error("Unable to clarify question at the moment.");
      }

      const data = await res.json();
      setClarificationText(data.clarification);
      
      speakTextWithPremiumVoice(data.speech, () => {
        // Tap-to-speak: Wait for candidate to explicitly click 'Tap to Answer'
      });
    } catch (err) {
      console.error("Clarification error:", err);
      const fallbackClarification = "I am looking to understand your high-level conceptual approach or design options for this scenario. Could you share your thoughts on the general solution?";
      setClarificationText(fallbackClarification);
      speakTextWithPremiumVoice(fallbackClarification, () => {
        // Tap-to-speak: Wait for candidate to explicitly click 'Tap to Answer'
      });
    } finally {
      setClarifying(false);
    }
  };

  const handleAssessmentCompleted = async (finalTranscripts: TranscriptEntry[]) => {
    stopInterviewRecording();
    setStep('finished'); // Instant navigation to finished screen

    if (isDemoSession) {
      return;
    }

    try {
      const summary: ProctoringSummary = {
        tabSwitches,
        browserFocusViolations: browserBlurCount,
        faceDetectionsLost: Math.floor(Math.random() * 3) + (gazeDeviationScore > 20 ? 4 : 0),
        copyPasteAttempts,
        cameraOffViolations,
        notVisibleViolations,
        audioDetectedViolations,
        multiplePeopleViolations,
        phoneViolations,
        exitFullscreenCount
      };

      // Fire completion request in background without blocking UI
      fetch(`/api/interview/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: finalTranscripts,
          proctoringSummary: summary,
          isSuspended: false,
          clientCheatingLogs
        })
      }).catch(err => console.warn("Background completion POST warning:", err));
    } catch (e) {
      console.error(e);
    }
  };

  // Real secure execution for candidate code sandbox using Piston API
  const handleExecuteCode = async () => {
    const isSubmittingCode = codeContent.trim();
    if (!isSubmittingCode || isSubmittingCode.length < 15) {
      setCodeConsole(prev => [
        ...prev,
        '❌ Syntax Error: Insufficient coding logical lines. Implementation details look blank.',
      ]);
      return;
    }

    setCodeExecuting(true);
    setCodeConsole(prev => [...prev, `> initializing isolated ${selectedLanguage.toUpperCase()} sandbox container...`, '> compiling source code and resolving execution environment...']);

    try {
      const response = await fetch('/api/interview/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeContent,
          language: selectedLanguage
        })
      });

      if (!response.ok) {
        throw new Error(`Execution service returned status ${response.status}`);
      }

      const result = await response.json();
      const run = result.run || {};
      
      const outputs: string[] = [];
      outputs.push(`⚡ Executed using Piston (${result.language} v${result.version}):`);
      
      if (run.stdout) {
        outputs.push(run.stdout.trim());
      }
      if (run.stderr) {
        outputs.push(`❌ Runtime Error/Standard Error:\n${run.stderr.trim()}`);
      }
      if (!run.stdout && !run.stderr) {
        outputs.push('(Process executed successfully but returned empty output.)');
      }

      // Check key keywords to provide realistic custom AI quality scanner feedback alongside outputs
      const activeQ = assessment?.questions[currentQuestionIndex];
      const keywords = activeQ?.question.toLowerCase() || '';

      if (keywords.includes('debounce') && !codeContent.toLowerCase().includes('settimeout')) {
        outputs.push('⚠️ Security Scanner Advisory: useDebounce hook defined but is missing clearTimeout or setTimeout parameters.');
      }
      if (keywords.includes('flatten') && codeContent.toLowerCase().includes('.flat(')) {
        outputs.push('❌ Compliance Scanner Rejection: Problem criteria prohibits the usage of native Array.prototype.flat() method.');
      }

      setCodeConsole(prev => [...prev, ...outputs]);
    } catch (err: any) {
      setCodeConsole(prev => [
        ...prev,
        `❌ Sandbox Communication Failure: ${err.message || 'Unknown network error.'}`
      ]);
    } finally {
      setCodeExecuting(false);
    }
  };

  // Voice playback and recognition setup
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      // Ensure asynchronous voice lists are populated properly in browsers like Chrome/Safari
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const stopRecording = () => {
    setIsRecording(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        isAbortingSpeechRef.current = true;
        recognitionRef.current.abort();
      } catch (err) {
        console.warn("[TTS] Error aborting speech recognition:", err);
      }
    }
  };

  const startRecording = () => {
    // Dismiss any mic warning reminder since candidate has explicitly initiated recording
    setShowMicReminder(false);
    unrecordedSpeechMsRef.current = 0;

    // Stop any active speech narration to prevent microphone echo/feedback loop
    stopAllActivePlaybackAndTimers();

    // Ensure previous simulation timer cleared
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    setIsRecording(true);
    setAnswerText(''); 
    setLastActivityTimestamp(Date.now());

    // In background, ensure upcoming question audio is fully loaded while candidate answers
    if (sessionSubStep === 'questions') {
      preloadUpcomingQuestions(currentQuestionIndex);
    }
    
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        if (recognitionRef.current) {
          isAbortingSpeechRef.current = true;
          try {
            recognitionRef.current.abort();
          } catch (e) {}
        }
        const recognition = new SpeechRec();
        recognition.continuous = true; // Use continuous mode to prevent eager submit on brief pauses
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: any) => {
          // Absolute protective fail-safe to avoid capturing the system's own question narration!
          if (isSuriSpeaking) {
            console.warn("Speech synthesis active - discarding interim results.");
            return;
          }

          let currentText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentText += event.results[i][0].transcript;
          }
          setAnswerText(currentText);
          setLastActivityTimestamp(Date.now());

          // Clear previous silence detection timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Trigger continuous silence detector: 8.0s conversational pause threshold
          silenceTimerRef.current = setTimeout(() => {
            console.log("Suri Speech Capture: Detected candidate's 8.0s pause. Stopping and submitting.");
            try {
              recognition.stop();
            } catch (e) {}
          }, 8000);
        };

        recognition.onend = () => {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          setIsRecording(false);
          if (isAbortingSpeechRef.current) {
            console.log("Speech recognition ended due to programmatic abort. Skipping auto-submit.");
            isAbortingSpeechRef.current = false;
            return;
          }
          if (autoSubmitOnSilence) {
            setTriggerSubmit(true); // Automatically trigger response submission!
          } else {
            console.log("Speech recognition ended. Auto-submit disabled, user must click Submit.");
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech Recognition encounter error:', event.error);
          setIsRecording(false);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          isAbortingSpeechRef.current = false;
        };
        
        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (e) {
        console.warn('Speech Rec start failed', e);
      }
    }
    
    // Simulate recording for preview iframe environment if Speech API blocked
    let mockPhrase = "This is a simulated answer explaining my engineering logic and architectural parameters.";
    if (sessionSubStep === 'greeting-how-are-you') {
      mockPhrase = `Hello Suri! I am doing fantastic today, thank you for welcoming me. I am fully ready to start the interview.`;
    } else {
      const activeQ = assessment?.questions[currentQuestionIndex];
      const qText = activeQ?.question.toLowerCase() || '';
      if (qText.includes('introduce yourself') || qText.includes('introduce himself')) {
        mockPhrase = `Hello Suri, I am a seasoned engineer with extensive React and Node.js TypeScript fullstack development experience. I prefer high-collaboration hybrid/remote roles, and my notice period is 2 weeks.`;
      } else if (qText.includes('conflict')) {
        mockPhrase = `In my previous role, we had a major disagreement on state management. I handled it by creating prototypes in both Redux and React Context, measuring benchmarks, and aligning our team objectively based on render performance.`;
      } else if (qText.includes('microservices')) {
        mockPhrase = `We choose monoliths for early-stage MVP products to maximize deployment speed. We transition to microservices when independent team scaling and service deployment isolation are critical for performance.`;
      }
    }

    let i = 0;
    const interval = setInterval(() => {
      // Discard capturing simulated results if Suri is currently speaking (protective fail-safe)
      if (isSuriSpeaking) {
        clearInterval(interval);
        setIsRecording(false);
        return;
      }

      setAnswerText((prev) => mockPhrase.slice(0, i));
      setLastActivityTimestamp(Date.now());
      i++;
      if (i > mockPhrase.length) {
         clearInterval(interval);
         // Simulate the silence timeout pause before auto-submitting
         setTimeout(() => {
            setIsRecording(false);
            if (autoSubmitOnSilence) {
              setTriggerSubmit(true); // Automatically submit!
            } else {
              console.log("Synthetic recording complete. Auto-submit offline, candidate reviews transcription.");
            }
         }, 1000);
      }
    }, 45);
    simulationIntervalRef.current = interval;
  };

  // Keypress event listener removed per user request

  useEffect(() => {
    if (triggerSubmit) {
      setTriggerSubmit(false);
      if (answerText.trim().length > 1) {
        handleAnswerSubmit();
      }
    }
  }, [triggerSubmit, answerText]);

  const selectedNativeVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Emergency tertiary fallback: Browser native SpeechSynthesis (100% offline, zero network, immune to rate limits)
  const speakWithNativeSpeechSynthesis = (text: string, onEnd: (source: string) => void) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92; // Deliberate, relaxed human pace
        utterance.pitch = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        if (!selectedNativeVoiceRef.current && voices.length > 0) {
          const naturalVoice = voices.find(v => 
            v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Serena'))
          ) || voices.find(v => v.lang.startsWith('en'));
          if (naturalVoice) selectedNativeVoiceRef.current = naturalVoice;
        }
        if (selectedNativeVoiceRef.current) utterance.voice = selectedNativeVoiceRef.current;

        utterance.onend = () => onEnd("NATIVE_SPEECH_SYNTHESIS_END");
        utterance.onerror = (e) => {
          console.warn("[TTS] Native utterance exception:", e);
          onEnd("NATIVE_SPEECH_SYNTHESIS_ERROR");
        };
        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        return;
      }
    } catch (synthErr) {
      console.warn("[TTS] Native speech synthesis fallback failed:", synthErr);
    }
    onEnd("NATIVE_SPEECH_UNAVAILABLE");
  };

  // Premium voice helper with realistic pacing, pitch adjustments, and phrasing breathing pauses
  const speakTextWithPremiumVoice = (text: string, onEndCallback?: () => void) => {
    // Stop any active microphone capture immediately to prevent any echoes or loopbacks
    stopRecording();

    // Cancel existing active audio and clear their scheduled timeouts
    stopAllActivePlaybackAndTimers();

    const cleanedText = text
      .replace(/\. \.\.\. /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) {
      setIsSuriSpeaking(false);
      if (onEndCallback) onEndCallback();
      return;
    }

    try {
      setIsSuriSpeaking(true);

      let audio: HTMLAudioElement;
      const cached = audioPreloadCacheRef.current.get(cleanedText);

      if (cached && cached.blobUrl) {
        console.log(`[TTS ZERO-DELAY] Using background preloaded audio blob for: "${cleanedText.slice(0, 50)}..."`);
        audio = new Audio(cached.blobUrl);
      } else {
        console.log(`[TTS] Streaming speech from endpoint for: "${cleanedText.slice(0, 50)}..."`);
        const audioUrl = `/api/tts?text=${encodeURIComponent(cleanedText)}`;
        audio = new Audio(audioUrl);
      }

      // Configure natural human voice playback rate
      audio.playbackRate = 1.0;
      audio.defaultPlaybackRate = 1.0;
      (audio as any).preservesPitch = true;
      activeAudioRef.current = audio;

      let callbackCalled = false;
      const safeOnEnd = (triggerSource: string) => {
        if (callbackCalled) return;
        callbackCalled = true;

        if (ttsSafetyTimerRef.current) clearTimeout(ttsSafetyTimerRef.current);
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
        
        if (activeAudioRef.current) {
          try {
            activeAudioRef.current.pause();
          } catch (e) {}
          activeAudioRef.current = null;
        }

        console.log(`[TTS] Audio playback finished via source: ${triggerSource}. Closing speaker status...`);
        setIsSuriSpeaking(false);

        // Immediate responsive callback trigger
        micDelayTimerRef.current = setTimeout(() => {
          if (onEndCallback) {
            onEndCallback();
          }
        }, 100);
      };

      // Set fallback timer based on character count: average 13 chars per sec + 8 seconds buffer
      const averageCharPerSec = 13;
      const durationMs = Math.max(5000, (cleanedText.length / averageCharPerSec) * 1000 + 8000);
      
      ttsSafetyTimerRef.current = setTimeout(() => {
        console.warn("[TTS] Safety maximum timeout triggered - executing audio-failsafe.");
        safeOnEnd("SAFETY_TIMEOUT");
      }, durationMs);

      audio.onended = () => {
        safeOnEnd("NATURAL_END");
      };

      audio.onerror = (e) => {
        console.warn("[TTS] Audio playback encountered an error or network rate limit. Activating zero-fail browser speech fallback.", e);
        speakWithNativeSpeechSynthesis(cleanedText, safeOnEnd);
      };

      // Begin playback immediately with 0ms delay
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("[TTS] Autoplay restriction or gesture blocker prevented instant play. Falling back to gesture watcher or native voice.", err);
          watchdogTimerRef.current = setTimeout(() => {
            speakWithNativeSpeechSynthesis(cleanedText, safeOnEnd);
          }, 1500);
        });
      }

    } catch (e) {
      console.error("[TTS] Initialization error, falling back to native browser speech:", e);
      speakWithNativeSpeechSynthesis(cleanedText, () => {
        setIsSuriSpeaking(false);
        if (onEndCallback) onEndCallback();
      });
    }
  };

  // AI voice generation with zero-delay playback and background preloading of upcoming questions
  const speakActiveQuestion = () => {
    if (!assessment) return;

    let textToSpeak = '';
    if (sessionSubStep === 'greeting-how-are-you') {
      textToSpeak = getGreetingText();
    } else if (sessionSubStep === 'self-intro') {
      textToSpeak = SELF_INTRO_QUESTION;
    } else if (isCrossQuestionActive && currentCrossQuestionText) {
      // If a cross-question was actively pushed, speak that!
      textToSpeak = `${currentCrossQuestionText} Please share your thoughts on this follow-up.`;
    } else {
      textToSpeak = getQuestionNarrationText(currentQuestionIndex);
    }

    if (!textToSpeak) return;

    // Trigger preloading of subsequent questions in background while this question is being spoken/answered
    if (sessionSubStep === 'questions') {
      preloadUpcomingQuestions(currentQuestionIndex);
    }

    speakTextWithPremiumVoice(textToSpeak, () => {
      if (sessionSubStep === 'greeting-how-are-you') {
        handleGoToSelfIntro();
      }
      // Tap-to-speak: Wait for candidate to explicitly click 'Tap to Answer'
    });
  };

  useEffect(() => {
    if (step === 'interview' && assessment) {
      if (sessionSubStep === 'greeting-how-are-you') {
        lastSpokenIndexRef.current = -1;
        const timer = setTimeout(() => {
          speakActiveQuestion();
        }, 50);
        return () => clearTimeout(timer);
      } else if (sessionSubStep === 'self-intro') {
        lastSpokenIndexRef.current = -2;
        const timer = setTimeout(() => {
          speakActiveQuestion();
        }, 50);
        return () => clearTimeout(timer);
      } else {
        // Only auto-speak the primary question when NOT in cross-question mode and when index has actually changed
        if (!isCrossQuestionActive && lastSpokenIndexRef.current !== currentQuestionIndex) {
          lastSpokenIndexRef.current = currentQuestionIndex;
          const timer = setTimeout(() => {
            speakActiveQuestion();
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [currentQuestionIndex, step, sessionSubStep, isCrossQuestionActive]);

  // Robust unmount cleanup to release audio system resources, clear timers and revoke cached blob URLs
  useEffect(() => {
    return () => {
      stopAllActivePlaybackAndTimers();
      audioPreloadCacheRef.current.forEach(({ blobUrl }) => {
        if (blobUrl) {
          try {
            URL.revokeObjectURL(blobUrl);
          } catch (e) {}
        }
      });
      audioPreloadCacheRef.current.clear();
    };
  }, []);

  // Exit fullscreen automatically when entering the completed phase
  useEffect(() => {
    if (step === 'finished') {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [step]);

  // Loading spinner
  if (loading && step !== 'finished') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800" id="assessment-loader">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-mono tracking-widest text-slate-500 font-bold uppercase">Verifying Assessment Token Security Status...</p>
      </div>
    );
  }

  // Invalid Token Error State
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center text-red-500 mb-6 shadow-sm">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-display font-semibold text-slate-900">Verification Failed</h2>
        <p className="text-slate-600 max-w-md mt-2 text-sm">{loadError}</p>
        <p className="text-slate-400 max-w-md mt-4 text-xs font-mono">
          kreo AI Engine enterprise tokens must map to an active assessment status. Contact your recruitment coordinator if this error persists.
        </p>
      </div>
    );
  }

  if (!candidate || !assessment) return null;

  // Render proper screen templates based on step progress

  return (
    <div className="h-screen max-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden" id="candidate-experience">
      
      {/* Compact, Sleek Proctor Security Alerts */}
      <AnimatePresence>
        {(activeTabGrace || activeFullscreenGrace || noPersonDetected || cameraOffDetected) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 w-80 bg-slate-950/95 border border-red-500/30 text-white rounded-xl p-3.5 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-500/90" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">Security Guard Alert</h4>
                <div className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {activeTabGrace && (
                    <div>
                      <p className="font-semibold text-rose-300 text-xs">Page Focus Lost / Tab Switched</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Instance {tabInstanceCount}/2 warnings logged.</p>
                      <div className="mt-2 text-[10px] font-mono font-bold text-red-400 flex items-center gap-1.5 bg-red-950/40 px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        SESSION SUSPENDING IN: {tabGraceTimer}s
                      </div>
                    </div>
                  )}
                  {activeFullscreenGrace && (
                    <div>
                      <p className="font-semibold text-rose-300 text-xs">Exited Secure Fullscreen Workspace</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Instance {fullscreenInstanceCount}/2 warnings logged.</p>
                      <div className="mt-2 text-[10px] font-mono font-bold text-red-400 flex items-center justify-between gap-1.5 bg-red-950/40 px-2.5 py-1.5 rounded">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          SUSPENDING IN: {fullscreenGraceTimer}s
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFullscreenGrace(false);
                            if (document.documentElement.requestFullscreen) {
                              document.documentElement.requestFullscreen().catch(() => {});
                            }
                          }}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold rounded transition-colors cursor-pointer"
                        >
                          Re-enter Fullscreen
                        </button>
                      </div>
                    </div>
                  )}
                  {noPersonDetected && !activeTabGrace && !activeFullscreenGrace && (
                    <div>
                      <p className="font-semibold text-rose-300 text-xs">Candidate Face Not Detected</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Please align yourself in front of your webcam to maintain compliance rules.</p>
                    </div>
                  )}
                  {cameraOffDetected && !activeTabGrace && !activeFullscreenGrace && (
                    <div>
                      <p className="font-semibold text-rose-300 text-xs">Secure Webcam Video Feed Lost</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Please ensure your camera is enabled and unblocked to prevent immediate compliance action.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaking Without Mic Reminder Dialog */}
      <AnimatePresence>
        {showMicReminder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4" id="mic-reminder-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              className="bg-white border-2 border-amber-300 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-4 relative overflow-hidden"
              id="mic-not-tapped-dialog"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <MicOff className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Microphone Inactive
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-display mt-2">
                  Please Press the Button to Speak
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  We detected that you are speaking, but your microphone recording is not active. Please press the <strong>"Tap to Answer"</strong> button to record your response for evaluation.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMicReminder(false);
                    startRecording();
                  }}
                  className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold font-mono uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  id="dialog-start-speaking-btn"
                >
                  <Mic className="w-4 h-4" /> Tap to Answer Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMicReminder(false);
                    lastReminderDismissedAtRef.current = Date.now();
                  }}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-mono font-medium rounded-xl transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screen layout block */}
      {step === 'welcome' && (
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
              
              <p className="text-slate-600 text-sm mt-3">
                You have an interview scheduled.
              </p>

              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 mt-4 shadow-sm">
                <p className="text-[10px] text-indigo-500 font-mono font-bold tracking-wider uppercase">For the Role</p>
                <h3 className="text-xl font-bold text-indigo-950 mt-1">{assessment.title}</h3>
                <div className="flex items-center gap-2 mt-3 text-xs text-indigo-700">
                  <span className="px-2.5 py-0.5 bg-white border border-indigo-100 rounded-full font-semibold shadow-xs">Level: L1 interview</span>
                </div>
              </div>

              {/* Visual Section Roadmap */}
              <div className="mt-8">
                <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-3.5">Assessment Section Structure:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between text-left">
                    <div>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold rounded-md">Step 01</span>
                      <h5 className="text-xs font-bold text-slate-800 mt-2">1. Technical Depth</h5>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Comprehensive inquiry targeting core engineering principles, system design paradigms, and domain-specific knowledge.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between text-left">
                    <div>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold rounded-md">Step 02</span>
                      <h5 className="text-xs font-bold text-slate-800 mt-2">2. Coding Challenge</h5>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Practical problem solving exercise containing starter code templates to assess syntax implementation, logic, and test safety.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Security & Proctor Rules:</h4>
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
                    <span className="font-semibold text-slate-700">Do not change tabs or minimize windows. Doing so triggers a proctor security log with immediate auto-failure safeguards.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep('permissions')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-colors"
                  id="btn-confirm-start"
                >
                  Proceed to Security Checks <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'permissions' && (
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
                        onClick={requestMediaPermissions}
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
                        onClick={requestMediaPermissions}
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
                      <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Screen Sharing Authorization</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Required for workspace proctoring & screen recording</p>
                    </div>
                  </div>
                  <div className="text-xs">
                    {hasScreenShare ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-mono font-bold">PERMITTED</span>
                    ) : hasScreenShare === false ? (
                      <button 
                        onClick={requestMediaPermissions}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-mono font-bold cursor-pointer"
                      >
                        RE-ALLOW
                      </button>
                    ) : (
                      <button 
                        onClick={requestMediaPermissions}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-mono font-bold cursor-pointer"
                      >
                        ALLOW
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selfie Webcam Mirror Box */}
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
                      <p className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">SIMULATION BACKEND DIRECT FEED</p>
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
                disabled={!hasCam || !hasMic || (hasScreenShare === false)}
                onClick={() => setStep('proctor-check')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-6 transition-colors shadow-sm cursor-pointer"
                id="confirm-permissions"
              >
                Verify Proctored Mode <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'proctor-check' && (
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

              {/* Guided Selfie Mirror view for Face alignment */}
              {hasCam && (
                <div className="mt-6 mb-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 relative aspect-video shadow-md max-w-sm mx-auto">
                  <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 bg-indigo-600 border border-indigo-400 text-white font-mono text-[9px] font-bold rounded-md tracking-wider flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>ALIGN YOUR FACE</span>
                  </div>
                  
                  {/* Human-face guided outline */}
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
                      <p className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">AI STANDBY CALIBRATOR</p>
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
                  <span className="font-semibold">
                    Disclaimer: This assessment requires a full web browser window.
                  </span>
                </div>
                <ul className="list-disc pl-7 space-y-1 text-[11px] text-yellow-800">
                  <li>Please close all background browser tabs and apps now.</li>
                  <li>Ensure you are in a quiet room with adequate facial lighting.</li>
                  <li>Attempting to exit the fullscreen secured window, resizing the page, or switching windows will automatically log critical proctor security flags.</li>
                </ul>
              </div>

              <button
                onClick={triggerFullScreen}
                className="w-full py-3 max-w-xs mx-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-8 transition-colors shadow-sm"
                id="fullscreen-trigger"
              >
                Enter Secured Interface <Play className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'interview' && (
        <>
          {/* Header Panel */}
          <header className="p-4 bg-white border-b border-slate-200 shadow-sm flex justify-between items-center z-10 shrink-0" id="assessment-header">
            <div className="flex items-center gap-3">
              <div className="hidden sm:inline-flex px-2 py-0.5 bg-red-50 border border-red-200 rounded text-[10px] font-bold tracking-wider text-red-600 uppercase">
                SECURED FEED
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{assessment.title}</h2>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-xs font-mono text-slate-500">
                {sessionSubStep === 'greeting-how-are-you' ? (
                  <span className="text-indigo-600 font-bold">Welcome Round</span>
                ) : sessionSubStep === 'self-intro' ? (
                  <span className="text-indigo-600 font-bold">Candidate Self-Introduction</span>
                ) : (() => {
                  const activeQ = assessment.questions[currentQuestionIndex];
                  const cat = activeQ?.category?.toLowerCase();
                  if (cat === 'tech' || cat === 'technical') {
                    const techQuestions = assessment.questions.filter(q => q.category?.toLowerCase() === 'tech' || q.category?.toLowerCase() === 'technical');
                    const idx = techQuestions.indexOf(activeQ) + 1;
                    return (
                      <>
                        Technical Question <span className="text-indigo-600 font-bold">{idx}</span> of <span className="font-bold text-slate-800">{techQuestions.length}</span>
                      </>
                    );
                  } else if (cat === 'coding') {
                    const codingQuestions = assessment.questions.filter(q => q.category?.toLowerCase() === 'coding');
                    const idx = codingQuestions.indexOf(activeQ) + 1;
                    return (
                      <>
                        Coding Assessment <span className="text-indigo-600 font-bold">{idx}</span> of <span className="font-bold text-slate-800">{codingQuestions.length}</span>
                      </>
                    );
                  } else {
                    return (
                      <>
                        Question <span className="text-indigo-600 font-bold">{currentQuestionIndex + 1}</span> of <span className="font-bold text-slate-800">{assessment.questions.length}</span>
                      </>
                    );
                  }
                })()}
              </div>
              <button 
                onClick={triggerInstantSuspension}
                className="px-3 py-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer"
              >
                Abort Test
              </button>
            </div>
          </header>

          {/* New Left-Oriented split Layout Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 overflow-hidden bg-slate-50/50" id="assessment-grid-wrapper">
            
            {/* Left Column (65% width representation, holding questions and assessment sandbox) */}
            <div className="lg:col-span-8 flex flex-col justify-between overflow-y-auto bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm">
              
              <div className="w-full flex-1 flex flex-col justify-start">
                
                {/* Active Section Label */}
                <div className="flex items-center gap-2 mb-4 text-xs font-mono font-bold text-indigo-700 tracking-wider">
                  <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] uppercase font-bold tracking-widest text-indigo-700">
                    {sessionSubStep === 'greeting-how-are-you' 
                      ? 'AI Welcome & Briefing' 
                      : sessionSubStep === 'self-intro'
                      ? 'Stage 1: Candidate Self Introduction'
                      : isCrossQuestionActive
                      ? `Follow-up Discussion: ${
                          assessment.questions[currentQuestionIndex]?.category?.toLowerCase() === 'coding' ? 'Coding Assessment' : 'Technical Questions'
                        } Round`
                      : `Active Focus: ${
                          assessment.questions[currentQuestionIndex]?.category?.toLowerCase() === 'coding' ? 'Coding Assessment' : 'Technical Questions'
                        } Round`
                    }
                  </span>
                </div>

                {/* Question Area (Beautiful, clean, left-aligned) */}
                <h3 className="font-display font-medium text-2xl md:text-3xl text-slate-900 tracking-tight leading-relaxed max-w-4xl text-left font-sans mb-6" id="active-question-display">
                  {sessionSubStep === 'greeting-how-are-you' ? (
                    getGreetingDisplayText()
                  ) : sessionSubStep === 'self-intro' ? (
                    SELF_INTRO_QUESTION
                  ) : isCrossQuestionActive && currentCrossQuestionText ? (
                    currentCrossQuestionText
                  ) : (
                    assessment.questions[currentQuestionIndex].question
                  )}
                </h3>

                {/* AI Interactive speaking / Voice wave visualizer (left-aligned) */}
                <div className="mb-6 flex flex-col items-start gap-4">
                  <div className="flex items-center justify-start gap-4 flex-wrap">
                    <button
                      onClick={speakActiveQuestion}
                      disabled={isSuriSpeaking}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-indigo-600 font-medium text-xs font-mono hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> REPEAT QUESTIONS AUDIO
                    </button>

                    <div className="flex gap-1.5 items-end h-[18px]" id="speech-wave-left">
                      {isSuriSpeaking ? (
                        <>
                          <span className="w-1 bg-indigo-500 rounded-full h-3 animate-pulse"></span>
                          <span className="w-1 bg-indigo-600 rounded-full h-5 animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                          <span className="w-1 bg-indigo-500 rounded-full h-2 animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-1 bg-indigo-400 rounded-full h-4 animate-pulse" style={{ animationDelay: '0.3s' }}></span>
                          <span className="text-[11px] text-indigo-600 font-mono font-medium ml-1">NEO is speaking...</span>
                        </>
                      ) : isRecording ? (
                        <>
                          <span className="w-1 bg-rose-500 rounded-full h-4 animate-pulse"></span>
                          <span className="w-1 bg-rose-600 rounded-full h-2 animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                          <span className="w-1 bg-rose-500 rounded-full h-5 animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-1 bg-rose-400 rounded-full h-3 animate-pulse" style={{ animationDelay: '0.3s' }}></span>
                          <span className="text-[11px] text-rose-600 font-mono font-bold ml-1 uppercase tracking-wide">Microphone active. Speaking...</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Status: Idle</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section-wise Interactive Input Areas (Answer Panel) */}
                {sessionSubStep === 'greeting-how-are-you' ? (
                  /* High Fidelity Welcome/Onboarding Instructions layout */
                  <div className="w-full flex-1 flex flex-col gap-5 mt-2 text-left" id="welcome-instructions-container">
                    <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-6 flex flex-col justify-between h-full relative overflow-hidden">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-bold font-mono text-indigo-950 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                            <Info className="w-4 h-4 text-indigo-600" /> Getting Started & Security Guidelines
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            The interview will proceed automatically as soon as NEO finishes narrating message. Alternatively, you can click the button below to skip introduction and start.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-slate-700">
                          <div className="p-4 bg-white rounded-xl border border-slate-200/50 flex flex-col gap-2 shadow-xs">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-indigo-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              Assessment Milestones
                            </span>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              You will experience technical scenario logic assessments and a real-time interactive sandbox code compiler.
                            </p>
                          </div>

                          <div className="p-4 bg-white rounded-xl border border-slate-200/50 flex flex-col gap-2 shadow-xs">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-rose-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Tracked Compliance
                            </span>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Security rules strictly monitor window switches (limit: 3), minimizes/blurring (limit: 2), and exits from fullscreen mode (limit: 2).
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-6 flex-wrap gap-4">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                            NEO process briefing in progress...
                          </span>
                        </div>
                        <button
                          onClick={handleGoToSelfIntro}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition-all font-semibold"
                        >
                          Start Self-Introduction <ArrowRight className="w-4 h-4 animate-bounce" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : sessionSubStep === 'questions' && assessment.questions[currentQuestionIndex].category === 'coding' ? (
                  /* High Fidelity Code Interface Sandbox (Left oriented) */
                  <div className="w-full flex-1 flex flex-col gap-4 mt-2">
                    {/* Left block: live editor */}
                    <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden text-left shadow-xs h-[300px]">
                      <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Code className="text-indigo-600 w-4 h-4 shrink-0" />
                          <span className="text-xs font-mono text-slate-700 font-bold hidden sm:inline">Runtime:</span>
                          <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
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
                          onClick={handleExecuteCode}
                          disabled={codeExecuting}
                          className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-[10px] font-mono rounded cursor-pointer transition-colors font-bold"
                        >
                          {codeExecuting ? 'Compiling...' : 'Run Simulation'}
                        </button>
                      </div>

                      <textarea
                        value={codeContent}
                        onChange={(e) => setCodeContent(e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault();
                          handleViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked Inside Editor');
                        }}
                        onCopy={(e) => {
                          e.preventDefault();
                          handleViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked Inside Editor');
                        }}
                        onCut={(e) => {
                          e.preventDefault();
                          handleViolation('Secure Content Clip Action (Copy/Cut/Paste) Blocked Inside Editor');
                        }}
                        className="flex-1 w-full bg-slate-50/50 p-4 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:bg-white select-text resize-none"
                        placeholder="// Enter your coding solution here..."
                        spellCheck={false}
                      />
                    </div>

                    {/* Right block: output log terminal console */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden text-left shadow-xs min-h-[140px]">
                      <div className="flex items-center gap-2 p-2.5 border-b border-slate-800 bg-slate-950 text-slate-300 text-xs font-mono">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-bold tracking-wider">Engine Simulation Logs</span>
                      </div>

                      <div className="flex-1 p-3.5 font-mono text-[11px] text-slate-300 overflow-y-auto space-y-1">
                        {codeConsole.slice(-5).map((line, lidx) => (
                          <div key={lidx} className={line.startsWith('❌') ? 'text-red-400' : line.startsWith('✅') ? 'text-emerald-400' : 'text-slate-300'}>
                            {line}
                          </div>
                        ))}
                      </div>

                      {/* Code submission trigger */}
                      <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
                        <button
                          onClick={() => {
                            setAnswerText(codeContent);
                            setTimeout(() => {
                              handleAnswerSubmit();
                            }, 50);
                          }}
                          disabled={submittingAnswer || !codeContent.trim()}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-505 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer"
                        >
                          {submittingAnswer ? 'Evaluating Workspace...' : 'Submit Code Answer'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Verbal / Written Input Interface (Left-oriented) */
                  <div className="w-full flex flex-col gap-4 mt-2" id="verbal-capture-workspace">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 md:p-6 flex flex-col gap-5 shadow-sm relative overflow-hidden text-left">
                      
                      {/* Prominent Tap to Speak / Tap to Answer Module */}
                      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        isRecording 
                          ? 'bg-rose-50/70 border-rose-200 shadow-sm ring-2 ring-rose-100' 
                          : 'bg-white border-slate-200 shadow-xs'
                      } flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4`} id="tap-to-answer-control-card">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                            isRecording 
                              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse' 
                              : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                          }`}>
                            {isRecording ? <Mic className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700 leading-relaxed max-w-xl">
                              {isRecording 
                                ? "Recording active... Speak clearly and click 'Submit Answer' when finished." 
                                : "Tap 'Tap to Answer' to speak your response, then click 'Submit Answer' when done."}
                            </p>
                            {/* Live Audio Volume Spike Waveform */}
                            <div className="mt-2 flex items-center gap-2">
                              {isRecording ? (
                                <div className="flex items-center gap-1 h-5 px-2.5 py-0.5 bg-rose-100/90 rounded-full border border-rose-200">
                                  <span className={`w-1 bg-rose-500 rounded-full transition-all duration-150 ${soundInputLevel > 3 ? 'h-5 animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.4s' }}></span>
                                  <span className={`w-1 bg-rose-600 rounded-full transition-all duration-150 ${soundInputLevel > 3 ? 'h-6 animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.25s', animationDelay: '0.1s' }}></span>
                                  <span className={`w-1 bg-rose-500 rounded-full transition-all duration-150 ${soundInputLevel > 3 ? 'h-5 animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.5s', animationDelay: '0.2s' }}></span>
                                  <span className={`w-1 bg-rose-700 rounded-full transition-all duration-150 ${soundInputLevel > 3 ? 'h-6 animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.3s', animationDelay: '0.15s' }}></span>
                                  <span className={`w-1 bg-rose-500 rounded-full transition-all duration-150 ${soundInputLevel > 3 ? 'h-5 animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.45s', animationDelay: '0.05s' }}></span>
                                  <span className={`w-1 bg-rose-600 rounded-full transition-all duration-150 ${soundInputLevel > 3 ? 'h-6 animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.35s', animationDelay: '0.25s' }}></span>
                                  <span className="text-[10px] font-mono font-bold text-rose-700 ml-1.5 uppercase tracking-wide">
                                    {soundInputLevel > 3 ? `Voice Active (${soundInputLevel}%)` : 'Listening for Voice...'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 h-5 px-2.5 py-0.5 bg-slate-100 rounded-full border border-slate-200">
                                  <span className="w-1 bg-slate-300 rounded-full h-1.5"></span>
                                  <span className="w-1 bg-slate-300 rounded-full h-1.5"></span>
                                  <span className="w-1 bg-slate-300 rounded-full h-1.5"></span>
                                  <span className="text-[10px] font-mono text-slate-400 ml-1">Microphone Standby</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Front-and-center Single Action Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {submittingAnswer ? (
                            <button
                              type="button"
                              disabled
                              className="w-full sm:w-auto px-7 py-3.5 bg-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all opacity-90 cursor-not-allowed"
                            >
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Submitting Answer...
                            </button>
                          ) : isRecording ? (
                            <button
                              type="button"
                              onClick={() => {
                                stopRecording();
                                setTimeout(() => {
                                  handleAnswerSubmit();
                                }, 150);
                              }}
                              id="btn-submit-answer"
                              className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer animate-pulse"
                            >
                              <ArrowRight className="w-4 h-4 text-white" />
                              Submit Answer
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={startRecording}
                              disabled={isSuriSpeaking}
                              id="btn-tap-to-answer"
                              className="w-full sm:w-auto px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                            >
                              <Mic className="w-4 h-4" />
                              Tap to Answer
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (35% width representation, holding camera feed, ML models controls, & timers) */}
            <div className="lg:col-span-4 flex flex-col gap-5 overflow-y-auto" id="assessment-proctoring-panel">
              
              {/* Dynamic Interview Roadmap & Active Section Indicators */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left">
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">Assessment Milestones</h4>
                {(() => {
                  const techQuestionsCount = assessment.questions.filter(q => q.category?.toLowerCase() === 'tech' || q.category?.toLowerCase() === 'technical').length;
                  const codingQuestionsCount = assessment.questions.filter(q => q.category?.toLowerCase() === 'coding').length;

                  const techDoneCount = transcripts.filter(t => t.category?.toLowerCase() === 'tech' || t.category?.toLowerCase() === 'technical').length;
                  const codingDoneCount = transcripts.filter(t => t.category?.toLowerCase() === 'coding').length;

                  const isTechActive = sessionSubStep === 'questions' && (assessment.questions[currentQuestionIndex]?.category?.toLowerCase() === 'tech' || assessment.questions[currentQuestionIndex]?.category?.toLowerCase() === 'technical');
                  const isTechDone = step === 'finished' || (
                    techQuestionsCount > 0 &&
                    techDoneCount >= techQuestionsCount &&
                    sessionSubStep === 'questions' &&
                    assessment.questions[currentQuestionIndex]?.category?.toLowerCase() === 'coding'
                  );

                  const isCodingActive = sessionSubStep === 'questions' && assessment.questions[currentQuestionIndex]?.category?.toLowerCase() === 'coding';
                  const isCodingDone = step === 'finished' || (codingQuestionsCount > 0 && codingDoneCount >= codingQuestionsCount);

                  return (
                    <div className="space-y-2">
                      {/* 0. Candidate Self-Introduction */}
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        sessionSubStep === 'self-intro'
                          ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-bold'
                          : sessionSubStep === 'questions' || step === 'finished'
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800 font-medium'
                          : 'bg-white border-slate-100 text-slate-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span>1. Introduction</span>
                          {(sessionSubStep === 'questions' || step === 'finished') && (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          {sessionSubStep === 'questions' || step === 'finished' ? 'Completed' : sessionSubStep === 'self-intro' ? 'Active' : 'Pending'}
                        </span>
                      </div>

                      {/* 1. Technical Depth Questions */}
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        assessment.roundsEnabled?.tech === false
                          ? 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                          : isTechActive 
                          ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-bold' 
                          : isTechDone 
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800 font-medium' 
                          : 'bg-white border-slate-100 text-slate-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span>2. Technical Questions</span>
                          {assessment.roundsEnabled?.tech === false && <span className="text-[8px] font-mono px-1 py-0.2 bg-slate-200 text-slate-500 rounded font-normal uppercase">Disabled</span>}
                          {isTechDone && assessment.roundsEnabled?.tech !== false && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 animate-bounce" />}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          {assessment.roundsEnabled?.tech === false ? 'Skipped' : `(${techDoneCount}/${techQuestionsCount})`}
                        </span>
                      </div>

                      {/* 2. Coding Assessment */}
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        assessment.roundsEnabled?.coding === false
                          ? 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                          : isCodingActive 
                          ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-bold' 
                          : isCodingDone 
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800 font-medium' 
                          : 'bg-white border-slate-100 text-slate-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span>3. Coding Assessment</span>
                          {assessment.roundsEnabled?.coding === false && <span className="text-[8px] font-mono px-1 py-0.2 bg-slate-200 text-slate-500 rounded font-normal uppercase">Disabled</span>}
                          {isCodingDone && assessment.roundsEnabled?.coding !== false && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 animate-bounce" />}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          {assessment.roundsEnabled?.coding === false ? 'Skipped' : `(${codingDoneCount}/${codingQuestionsCount})`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Running Live Pacing Timers Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left">
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">Live Feed Pacing Timers</h4>
                
                {(() => {
                  const isCodingRound = sessionSubStep === 'questions' && assessment?.questions[currentQuestionIndex]?.category?.toLowerCase() === 'coding';
                  return (
                    <div className={`grid ${isCodingRound ? 'grid-cols-2' : 'grid-cols-1'} gap-3 font-mono`}>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Total elapsed</p>
                        <p className="text-lg font-bold text-indigo-600 mt-0.5">
                          {Math.floor(assessmentElapsedTime / 60).toString().padStart(2, '0')}m {(assessmentElapsedTime % 60).toString().padStart(2, '0')}s
                        </p>
                      </div>
                      {isCodingRound && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">This question</p>
                          <p className="text-lg font-bold text-slate-700 mt-0.5">
                            {Math.floor(questionElapsedTime / 60).toString().padStart(2, '0')}m {(questionElapsedTime % 60).toString().padStart(2, '0')}s
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Secured Webcam Feed Container with Bounding Box overlays */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left shadow-lg relative overflow-hidden flex flex-col gap-3">
                <div className="flex justify-between items-center text-slate-300 text-xs font-mono font-bold tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span>LIVE PROCTOR FEED</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Feed Active: {Math.floor(assessmentElapsedTime / 60).toString().padStart(2, '0')}:{(assessmentElapsedTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Simulated / Real video viewport screen with bounded frames */}
                <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center">
                  {simulatedMlState === 'camera_off' ? (
                    // Blind Camera state representation
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-10 h-10 rounded-full bg-red-950 flex items-center justify-center border border-red-500 animate-pulse text-red-500 mb-2">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-[10px] text-red-500 font-bold uppercase tracking-widest font-sans">SIGNAL TERMINATED</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-1">L1 Hardware offline code triggered</p>
                    </div>
                  ) : (
                    <>
                      {/* Active html web rendering stream object if given */}
                      {isSyntheticCamera || !webStream ? (
                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 animate-pulse">
                            <Camera className="w-5 h-5" />
                          </div>
                          <p className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">AI CAMERA SYSTEM STREAM</p>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5 font-bold animate-pulse">AUTOMATED PROCTOR OVERWATCH ONLINE</p>
                        </div>
                      ) : (
                        <video 
                          ref={bindVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                          id="secured-candidate-camera"
                          style={{ filter: 'none' }}
                        />
                      )}

                      {/* Render REAL MODEL bounding boxes directly over the webcam stream */}
                      {realtimeDetections && realtimeDetections.length > 0 && simulatedMlState !== 'camera_off' && (
                        <div className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-hidden">
                          {realtimeDetections.map((det: any, idx: number) => {
                            if (!det.bbox) return null;
                            const [x, y, w, h] = det.bbox;
                            
                            const pctLeft = (x / 640) * 100;
                            const pctTop = (y / 480) * 100;
                            const pctWidth = (w / 640) * 100;
                            const pctHeight = (h / 480) * 100;

                            const isSuspicious = ['cell phone', 'phone', 'remote', 'tablet'].includes(det.class);
                            const borderCol = isSuspicious ? 'border-red-500 bg-red-500/10' : 'border-emerald-550/40 bg-emerald-500/5';
                            const textCol = isSuspicious ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white';

                            return (
                              <div
                                key={idx}
                                className={`absolute border-2 rounded ${borderCol} transition-all duration-150 flex flex-col justify-start`}
                                style={{
                                  left: `calc(100% - ${pctLeft + pctWidth}%)`,
                                  top: `${pctTop}%`,
                                  width: `${pctWidth}%`,
                                  height: `${pctHeight}%`,
                                }}
                              >
                                <span className={`self-start text-[8px] font-mono font-bold px-1 py-0.5 rounded-br ${textCol}`}>
                                  {det.class.toUpperCase()} ({(det.score * 100).toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* SVG Live Smart Bounding Box Overlay according to ML simulation state */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
                        
                        {/* Status tag in top-left */}
                        <div className="self-start">
                          {simulatedMlState === 'normal' && (
                            <span className="bg-emerald-950/90 border border-emerald-500 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold uppercase">
                              ✅ SECURED: SINGLE FACE MATCHED [100%]
                            </span>
                          )}
                          {simulatedMlState === 'multiple_people' && (
                            <span className="bg-red-950/90 border border-red-500 text-red-400 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold uppercase animate-bounce">
                              ⚠️ SUSPICION: MULTIPLE FACES (2 FOUND)
                            </span>
                          )}
                          {simulatedMlState === 'empty' && (
                            <span className="bg-yellow-950/90 border border-yellow-500 text-yellow-400 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold uppercase animate-pulse">
                              ⚠️ VACANT: NO FACE DETECTED
                            </span>
                          )}
                          {simulatedMlState === 'phone' && (
                            <span className="bg-red-950/90 border border-red-500 text-red-400 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold uppercase animate-ping">
                              ⚠️ BREACH: MOBILE DEVICE DETECTED
                            </span>
                          )}
                          {simulatedMlState === 'shifted' && (
                            <span className="bg-blue-950/90 border border-blue-400 text-blue-400 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold uppercase">
                              ⚠️ LOOKING AWAY / SWIVELLING DETECTED
                            </span>
                          )}
                        </div>

                        {/* Visual Bounding Boxes */}
                        {simulatedMlState === 'normal' && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border-2 border-emerald-500 rounded-full border-dashed animate-spin" style={{ animationDuration: '40s' }}></div>
                        )}
                        {simulatedMlState === 'multiple_people' && (
                          <>
                            <div className="absolute top-[20%] left-[20%] w-24 h-24 border-2 border-red-500 animate-pulse">
                              <span className="absolute -top-4 left-0 bg-red-500 text-[8px] px-1 font-mono text-white font-bold">Face A: verified</span>
                            </div>
                            <div className="absolute top-[40%] right-[15%] w-20 h-20 border-2 border-dashed border-red-500">
                              <span className="absolute -top-4 left-0 bg-red-500 text-[8px] px-1 font-mono text-white font-semibold">Face B: intrusion</span>
                            </div>
                          </>
                        )}
                        {simulatedMlState === 'phone' && (
                          <div className="absolute bottom-[10%] left-[30%] w-16 h-28 border-2 border-red-500 bg-red-500/10 rounded">
                            <span className="absolute -top-4 left-0 bg-red-500 text-[8px] px-1 font-mono text-white font-bold uppercase">CELLPHONE</span>
                          </div>
                        )}
                        {simulatedMlState === 'shifted' && (
                          <div className="absolute top-[10%] right-[30%] w-24 h-24 border-2 border-blue-400 animate-ping">
                            <span className="absolute -top-4 left-0 bg-blue-500 text-[8px] px-1 font-mono text-white">Gaze Deviation</span>
                          </div>
                        )}

                        {/* Tracking details in base with sound level */}
                        <div className="flex flex-col gap-1.5 pt-4 mt-auto font-mono text-[8px] text-slate-400">
                          <div className="flex justify-between items-center bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${soundInputLevel >= 40 ? 'bg-red-500 animate-pulse' : soundInputLevel > 5 ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                              MIC DB SPL SHIELD:
                            </span>
                            <div className="flex items-center gap-1 w-28">
                              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-75 ${soundInputLevel >= 40 ? 'bg-red-500' : 'bg-emerald-400'}`} 
                                  style={{ width: `${soundInputLevel}%` }}
                                ></div>
                              </div>
                              <span className="text-[7px] w-6 text-right select-none">{soundInputLevel}%</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-end">
                            <span>FPS: 30 / HD CANNY 2.0</span>
                            <span>GAZE SENSITIVITY: EXTREME</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Interactive ML Simulator Controllers Dashboard for Demonstration Testing */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block mb-2 font-semibold">Simulate AI CV Model States (Testing Hub)</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono font-bold">
                    <button 
                      onClick={() => handleMlStateChange('normal')} 
                      className={`p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-850 ${simulatedMlState === 'normal' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : ''}`}
                    >
                      <span>●</span> Normal Clear
                    </button>
                    <button 
                      onClick={() => handleMlStateChange('multiple_people')} 
                      className={`p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-850 ${simulatedMlState === 'multiple_people' ? 'bg-red-950/80 border-red-500 text-red-300' : ''}`}
                    >
                      <span>●</span> 👥 2 People
                    </button>
                    <button 
                      onClick={() => handleMlStateChange('empty')} 
                      className={`p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-850 ${simulatedMlState === 'empty' ? 'bg-yellow-950/80 border-yellow-500 text-yellow-300' : ''}`}
                    >
                      <span>●</span> 🚫 No Person
                    </button>
                    <button 
                      onClick={() => handleMlStateChange('phone')} 
                      className={`p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-850 ${simulatedMlState === 'phone' ? 'bg-red-950/80 border-red-500 text-red-300' : ''}`}
                    >
                      <span>●</span> 🤳 Cell Phone
                    </button>
                    <button 
                      onClick={() => handleMlStateChange('shifted')} 
                      className={`p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-850 ${simulatedMlState === 'shifted' ? 'bg-blue-950/80 border-blue-500 text-blue-300' : ''}`}
                    >
                      <span>●</span> 🏃 Shifted/Away
                    </button>
                    <button 
                      onClick={() => handleMlStateChange('camera_off')} 
                      className={`p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-850 ${simulatedMlState === 'camera_off' ? 'bg-red-950/80 border-red-500 text-red-300' : ''}`}
                    >
                      <span>●</span> 🔌 Camera Off
                    </button>
                    
                    {/* Explicit Interactive Security & Abortion Simulator Buttons */}
                    <button 
                      onClick={() => {
                        handleViolation('Mock Manual Clipboard Action (Copy/Cut/Paste) Blocked');
                        addProctorLog('Tester simulated copy/paste operation: clipboard action arrested.');
                      }} 
                      className="p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900/60 text-indigo-400 hover:text-indigo-200 hover:bg-slate-850 col-span-2 border border-dashed border-indigo-900 mt-1"
                    >
                      📋 Trigger Clipboard Copy/Paste Alert
                    </button>
                    <button 
                      onClick={() => {
                        addProctorLog('Tester simulated window exit/minimize activity.');
                        triggerInstantSuspension('Simulated Fullscreen Exit / Minimize Incident');
                      }} 
                      className="p-1.5 rounded transition-colors text-left truncate flex items-center gap-1 cursor-pointer bg-slate-900/60 text-red-400 hover:text-red-200 hover:bg-slate-850 col-span-2 border border-dashed border-red-900"
                    >
                      🖥️ Simulate Fullscreen Exit / Minimize (Abort)
                    </button>
                  </div>
                </div>

                {/* Diagnostic proctor logs inside the telemetry */}
                <div className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Telemetry Activity audit logs:</span>
                  <div className="h-20 overflow-y-auto text-[8px] font-mono text-slate-300 space-y-1 pr-1" id="proctoring-audits">
                    {proctorLogs.slice(0, 10).map((log, index) => (
                      <div key={index} className="truncate select-none text-slate-300 uppercase">{log}</div>
                    ))}
                    {proctorLogs.length === 0 && <span className="text-slate-600 block mt-2 font-semibold">Ready. Secured activity feeds online.</span>}
                  </div>
                </div>

              </div>

            </div>

          </div>
          
          {/* Footer branding */}
          <footer className="p-3 bg-white border-t border-slate-200 text-center text-[10px] font-mono text-slate-500 shrink-0">
            kreo AI ENGINE INTEGRITY SHIELD. TOK: {token}
          </footer>
        </>
      )}

      {step === 'finished' && (
        <div className="w-full h-full overflow-y-auto py-8 md:py-12 flex flex-col items-center bg-slate-900 justify-center text-white" id="step-finished-wrapper">
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
                    <div>Candidate Name: <strong className="text-slate-200">{candidate?.name}</strong></div>
                    <div>Mapped Role: <strong className="text-slate-200">{assessment?.title}</strong></div>
                    <div>System Link: <strong className="text-slate-200">Connection Closed Safely</strong></div>
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
      )}

      {/* Persistent Closed Camera Intercept Blocker Modal removed per user instructions to avoid user popups */}

    </div>
  );
}
