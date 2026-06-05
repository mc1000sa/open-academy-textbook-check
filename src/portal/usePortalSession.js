import { useState, useEffect } from 'react';

const SESSION_KEY = 'eyap_portal_session.v1';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePortalSession() {
  const [session, setSessionState] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      
      // Expiry check
      if (parsed.loginAt && Date.now() - parsed.loginAt > SESSION_EXPIRY_MS) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });

  const login = (sessionData) => {
    const payload = {
      ...sessionData,
      loginAt: Date.now()
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save session to localStorage', e);
    }
    setSessionState(payload);
  };

  const logout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error('Failed to remove session from localStorage', e);
    }
    setSessionState(null);
  };

  return {
    session,
    login,
    logout,
    isLoggedIn: !!session
  };
}
