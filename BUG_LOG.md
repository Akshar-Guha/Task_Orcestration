# 🐛 Bug Registry
This document tracks recurring issues to prevent regression.

## 🔴 Active Bugs
*(None currently - moving "Stuck Modal" to Resolved)*

## 🟢 Resolved Bugs

### 1. Wake-Up Modal Infinite Loop / Re-appearance
- **Symptoms**: Modal appears on every page refresh, even after dismissal.
- **Root Cause**: 
  1. `AppInitializer` logic only tracked "initialized" state in React memory (lost on refresh).
  2. No persistence of "Dismissed" action.
- **Fix**: 
  - Added `localStorage` flag `mto_wake_modal_dismissed_{DATE}`.
  - App checks this flag before showing modal.
- **Date**: 2026-01-25

### 2. Sleep Logs RLS Permission Error
- **Symptoms**: "Permission denied" when clicking Sleep/Wake buttons.
- **Root Cause**: `sleep_wake_logs.user_id` was TEXT, but RLS compared it to `auth.uid()` (UUID).
- **Fix**: Applied migration to cast `auth.uid()::text` in policies (and eventually migrated column to UUID).
- **Date**: 2026-01-25

### 3. Missing Morning Emails
- **Symptoms**: "Wake Up" recorded but no email sent.
- **Root Cause**: `useRecordWakeUp` hook updated DB but was missing the `triggerWakeUpEmail()` call.
- **Fix**: Added explicit trigger call with mood mapping.
- **Date**: 2026-01-25
