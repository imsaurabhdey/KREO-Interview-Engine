/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import RecruiterPortal from './components/RecruiterPortal';
import CandidateExperience from './components/CandidateExperience';
import SafeStorage from './utils/safeStorage';

export default function App() {
  // Determine if URL has a candidate evaluation code token (e.g. ?token=tok-amit-123)
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'Admin' | 'Recruiter' | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setTokenParam(token);
    }

    // Persist login state in session
    const storedRole = SafeStorage.getItem('prism_role', 'sessionStorage');
    const storedEmail = SafeStorage.getItem('prism_email', 'sessionStorage');
    if (storedRole && storedEmail) {
      setUserRole(storedRole as 'Admin' | 'Recruiter');
      setUserEmail(storedEmail);
    }
  }, []);

  const handleLoginSuccess = (role: 'Admin' | 'Recruiter', email: string) => {
    setUserRole(role);
    setUserEmail(email);
    SafeStorage.setItem('prism_role', role, 'sessionStorage');
    SafeStorage.setItem('prism_email', email, 'sessionStorage');
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserEmail('');
    SafeStorage.removeItem('prism_role', 'sessionStorage');
    SafeStorage.removeItem('prism_email', 'sessionStorage');
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

  // 2. Otherwise direct to the Admin/Recruiter dashboard or Login module
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
