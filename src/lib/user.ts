/**
 * Single User Configuration
 * 
 * This is a personal app for one user only.
 * This file stores the user ID that will be used for all database operations.
 */

// Your Supabase user ID - will be set after creating the user
export const SINGLE_USER_ID = process.env.NEXT_PUBLIC_USER_ID || '';

/**
 * Get the current user ID (always returns the same single user)
 */
export function getCurrentUserId(): string {
  if (!SINGLE_USER_ID) {
    console.warn('[Auth] NEXT_PUBLIC_USER_ID not set in .env.local');
    return '';
  }
  return SINGLE_USER_ID;
}

/**
 * Check if user is "authenticated" (always true for personal app)
 */
export function isAuthenticated(): boolean {
  return SINGLE_USER_ID !== '';
}
