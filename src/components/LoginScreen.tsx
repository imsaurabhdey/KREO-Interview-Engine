/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, CheckCircle2, AlertCircle, Mail, Eye, EyeOff, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onSuccess: (role: 'Admin' | 'Recruiter', email: string) => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  // Mode: 'login' | 'forgot'
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  
  // Login States
  const [email, setEmail] = useState('saurabh.dey@irisoftware.com');
  const [password, setPassword] = useState('saurabh$123%');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1 = request code, 2 = enter code & reset password
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (response.ok && data.success) {
        onSuccess(data.user.role, data.user.email);
      } else {
        setError(data.error || 'Verification failed. Invalid email, password, or security credentials.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Connection failure. Unable to contact secure authentication gateway.');
    }
  };

  // Step 1: Send verification code via Brevo transactional email
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    if (!forgotEmail.trim()) {
      setError('Please provide your corporate email address.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setForgotStep(2);
        setSuccessMsg(data.message || 'Verification code sent to your email.');
      } else {
        setError(data.error || 'Failed to dispatch password reset code.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Network failure dispatching verification code. Please try again.');
    }
  };

  // Step 2: Verify reset code & apply new password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    if (!resetCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: resetCode.trim(),
          newPassword
        })
      });

      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setSuccessMsg('Password reset successfully! Redirecting to login...');
        setEmail(forgotEmail.trim());
        setPassword(newPassword);
        setTimeout(() => {
          setMode('login');
          setForgotStep(1);
          setResetCode('');
          setNewPassword('');
          setConfirmPassword('');
          setSuccessMsg('Your password has been updated. You can now login.');
        }, 1200);
      } else {
        setError(data.error || 'Password reset failed.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Network failure during password update. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white" id="login-container">
      {/* Premium Subtle Geometric Visual Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-10 right-10 w-80 h-80 rounded-full bg-indigo-100 blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-slate-100 blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl relative z-10"
        id="login-card"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-indigo-600 text-[11px] font-mono mb-4 tracking-wider uppercase">
            <Shield className="w-3.5 h-3.5" /> Interview Assessment Gateway
          </div>
          <h1 className="text-2xl font-display font-semibold text-slate-900 tracking-tight flex items-center justify-center gap-2">
            <svg 
              viewBox="0 0 100 100" 
              className="w-10 h-10 shrink-0 select-none" 
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
            <span><strong className="font-bold">KREO</strong> AI Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise Automated Proctoring & Talent Assessment Platform
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2" id="error-alert">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2" id="success-alert">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === 'login' ? (
          <div id="login-form-block">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Corporate Email Address</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-sans"
                    placeholder="name@company.com"
                    id="login-email-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Confidential Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setMode('forgot');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-10 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-sans font-medium"
                    placeholder="••••••••"
                    id="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-450 hover:text-indigo-600 transition-colors focus:outline-none cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    id="password-visibility-toggle-btn"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                id="login-submit-btn"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        ) : (
          /* 2. FORGOT PASSWORD MODE */
          <div id="forgot-password-block" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMsg('');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
              </button>
              <span className="text-[10px] font-mono font-semibold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                Reset via Brevo Email
              </span>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered corporate email. We will send a secure 6-digit verification code to reset your password.
                </p>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    Corporate Email
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-sans"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> Send Verification Code
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter the 6-digit code sent to <strong className="text-slate-800">{forgotEmail}</strong> and choose your new password.
                </p>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      6-Digit Security Code
                    </label>
                    <button
                      type="button"
                      onClick={handleRequestResetCode}
                      disabled={isLoading}
                      className="text-[10px] font-mono text-indigo-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Resend
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="123456"
                    className="w-full py-2.5 px-4 text-center tracking-[0.3em] font-mono font-bold text-lg text-indigo-600 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    New Confidential Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-450 hover:text-indigo-600 transition-colors focus:outline-none cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-sans"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Reset Password & Login'
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer info text */}
        <p className="text-[10px] text-slate-400 text-center mt-6 font-sans">
          Secured by kreo Software AI Cryptographic Identity Tokens.
        </p>
      </motion.div>
    </div>
  );
}
