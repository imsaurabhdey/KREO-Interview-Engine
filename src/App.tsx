/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import RecruiterPortal from './components/RecruiterPortal';
import CandidateExperience from './components/CandidateExperience';
import SafeStorage from './utils/safeStorage';
import { apiFetch, clearAuthToken, getAuthToken, onUnauthorized } from './utils/authFetch';

export default function App() {
  // Determine if URL has a candidate evaluation code token (e.g. ?token=tok-amit-123)
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'Admin' | 'Recruiter' | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [checkingSession, setCheckingSession] = useState<boolean>(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setTokenParam(token);
      setCheckingSession(false);
      return;
    }

    // Remove legacy client-trusted role keys so role is always server-verified
    SafeStorage.removeItem('prism_role', 'sessionStorage');
    SafeStorage.removeItem('prism_email', 'sessionStorage');

    let isMounted = true;
    const verifyServerSession = async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (isMounted && res.ok) {
          const data = await res.json();
          if (data?.success && data?.user?.role && data?.user?.email) {
            setUserRole(data.user.role);
            setUserEmail(data.user.email);
          } else {
            clearAuthToken();
            setUserRole(null);
            setUserEmail('');
          }
        } else if (isMounted) {
          if (getAuthToken()) clearAuthToken();
          setUserRole(null);
          setUserEmail('');
        }
      } catch {
        if (isMounted) {
          setUserRole(null);
          setUserEmail('');
        }
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    };

    verifyServerSession();

    const unsubscribe = onUnauthorized(() => {
      setUserRole(null);
      setUserEmail('');
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (role: 'Admin' | 'Recruiter', email: string) => {
    setUserRole(role);
    setUserEmail(email);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('[App] Server logout request failed; clearing local session:', err);
    }
    clearAuthToken();
    SafeStorage.removeItem('prism_role', 'sessionStorage');
    SafeStorage.removeItem('prism_email', 'sessionStorage');
    SafeStorage.removeItem('prism_local_candidates');
    SafeStorage.removeItem('prism_local_assessments');
    setUserRole(null);
    setUserEmail('');
  };

  const handleCandidateFinished = () => {
    // Navigate home and clear query param
    window.history.replaceState({}, document.title, window.location.pathname);
    setTokenParam(null);
  };

  // 1. If Candidate token is present in the parameters, direct instantly to Proctoring interface
  if (tokenParam) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800" id="kreo-candidate-portal">
        <CandidateExperience
          token={tokenParam}
          onFinished={handleCandidateFinished}
        />
      </div>
    );
  }

  // 2. While verifying server-side session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans text-slate-500 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></span>
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  // 3. Otherwise direct to the Admin/Recruiter dashboard or Login module
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800" id="kreo-recruiter-portal">
      {userRole ? (
        <RecruiterPortal
          userRole={userRole}
          userEmail={userEmail}
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
