import React, { createContext, useContext, useState, useEffect } from 'react';
import supabase from '../config/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Fallback: if getSession hangs for more than 6 seconds, unblock the app
    const timeout = setTimeout(() => {
      console.warn('[AuthContext] getSession timed out — proceeding without session');
      setIsLoadingAuth(false);
    }, 6000);

    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        clearTimeout(timeout);
        setSession(existingSession);
        setIsLoadingAuth(false);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('[AuthContext] getSession error:', error);
        setIsLoadingAuth(false);
      });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // userId is the Supabase auth UUID stored as a string — matches user_id TEXT in DB
  const userId = session?.user?.id ?? null;

  return (
    <AuthContext.Provider value={{ session, userId, isLoadingAuth, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
