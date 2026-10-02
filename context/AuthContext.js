import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
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
      if (newSession?.user?.id) {
        Sentry.setUser({ id: newSession.user.id });
      } else {
        Sentry.setUser(null);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://auth.fantasy-water-polo.com/confirmed/',
      },
    });
  
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

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://auth.fantasy-water-polo.com',
    });
    return { data, error };
  };

  /**
   * Permanently delete the signed-in user's app data + auth account via
   * the delete-account Edge Function, then clear the local session.
   */
  const deleteAccount = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return { data: null, error: sessionError };
    }
    if (!sessionData?.session?.access_token) {
      return { data: null, error: new Error('Not signed in') };
    }

    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    if (error) {
      let message = error.message || 'Failed to delete account';
      try {
        // FunctionsHttpError may expose the response body via context
        const body = await error?.context?.json?.();
        if (body?.error) message = body.error;
      } catch (_) {
        // ignore parse failures
      }
      return { data: null, error: new Error(message) };
    }

    if (data?.error) {
      return { data: null, error: new Error(String(data.error)) };
    }

    // Clear local SecureStore session; auth user is already gone server-side
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    return { data: data ?? { success: true }, error: signOutError };
  };

  // userId is the Supabase auth UUID stored as a string — matches user_id TEXT in DB
  const userId = session?.user?.id ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        userId,
        isLoadingAuth,
        signUp,
        signIn,
        signOut,
        resetPassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
