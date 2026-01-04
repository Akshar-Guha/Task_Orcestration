'use client';

import { supabase } from './supabase';

const DEVICE_TOKEN_KEY = 'device_trust_token';

/**
 * Get device token from localStorage
 */
export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

/**
 * Save device token to localStorage
 */
export function saveDeviceToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

/**
 * Clear device token from localStorage
 */
export function clearDeviceToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_TOKEN_KEY);
}

/**
 * Generate a new device token
 */
export function generateDeviceToken(): string {
  return crypto.randomUUID();
}

/**
 * Validate PIN against environment variable
 */
export async function validatePin(pin: string): Promise<boolean> {
  // Call API route to validate PIN (keeps SITE_PIN server-side)
  const response = await fetch('/api/auth/validate-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = await response.json();
  return data.valid === true;
}

/**
 * Register device token in Supabase
 */
export async function registerDevice(token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('authorized_devices')
      .insert({ device_token: token });
    
    if (error) {
      console.error('[DeviceAuth] Failed to register device:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[DeviceAuth] Error registering device:', e);
    return false;
  }
}

/**
 * Check if device token is valid (exists in database)
 */
export async function isDeviceAuthorized(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('authorized_devices')
      .select('id')
      .eq('device_token', token)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    // Update last_seen timestamp
    await supabase
      .from('authorized_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('device_token', token);
    
    return true;
  } catch (e) {
    console.error('[DeviceAuth] Error checking authorization:', e);
    return false;
  }
}

/**
 * Kill Switch: Revoke ALL device authorizations
 */
export async function revokeAllSessions(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('authorized_devices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
    if (error) {
      console.error('[DeviceAuth] Failed to revoke sessions:', error);
      return false;
    }
    
    // Clear local token too
    clearDeviceToken();
    return true;
  } catch (e) {
    console.error('[DeviceAuth] Error revoking sessions:', e);
    return false;
  }
}
