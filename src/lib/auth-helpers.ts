import { supabase } from './supabase';

/**
 * Authentication helper functions for FasalSetu
 */

export interface AuthUser {
  id: string;
  phone: string;
  created_at: string;
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  return {
    id: user.id,
    phone: user.phone || '',
    created_at: user.created_at
  };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Listen to authentication state changes
 */
export function onAuthStateChange(callback: (authenticated: boolean) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(!!session);
  });
}
