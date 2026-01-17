# DEPLOYMENT GUIDE - Data Persistence Fix

## Summary of Changes

This fix resolves the critical issue where **all data vanished when opening the application the next day**.

### What Was Fixed:

1. **✅ Data Loading Race Condition** - Modified `AppInitializer.tsx` to load cloud data BEFORE localStorage
2. **✅ Error Visibility** - Added error banner to show when cloud sync fails
3. **⚠️ RLS Policies** - Created SQL script that must be run manually in Supabase

---

## Deployment Steps

### Step 1: Run the SQL Script in Supabase (CRITICAL)

> [!IMPORTANT]
> You MUST run this SQL script or data will NOT save properly!

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Open the file: `FIX_DATABASE_RLS.sql` in this directory
6. Copy the ENTIRE contents of that file
7. Paste into the Supabase SQL Editor
8. Click "Run" or press Ctrl+Enter
9. Verify you see success message: "✓ RLS policies created successfully!"

**Why this is required:**
- Your app uses a fallback user ID for single-user mode
- Row Level Security (RLS) blocks access unless explicitly allowed
- The SQL script creates policies that allow your fallback user to save data

---

### Step 2: Deploy to Vercel

The code changes have already been made and built successfully. Now deploy:

```powershell
# Make sure you're in the project directory
cd S:\\projects\\Task_Orcestration\\goal-tracker-web

# Deploy to Vercel
vercel --prod
```

Or use the Vercel GitHub integration if you prefer:

```powershell
# Commit changes
git add .
git commit -m "fix: resolve data persistence issue - load cloud data first"
git push origin main
```

Vercel will auto-deploy if GitHub integration is set up.

---

### Step 3: Test the Deployment

After deploying, thoroughly test the fixes:

#### A. Test Cloud Data Loading

1. Open browser DevTools (F12) → Console tab
2. Navigate to your deployed app
3. **Expected console output:**
   ```
   [AppInit] Starting app initialization...
   [AppInit] STEP 1: Loading data from cloud (Supabase)...
   [Supabase] Loading all data from server...
   [Supabase] Loaded: X goals, Y tasks, Z slots
   [Store] ✓ Cloud data loaded successfully
   [AppInit] ✓ Cloud data loaded successfully
   ```

4. **If you see an error:**
   - Red banner at top of page
   - Console error: `[AppInit] ✗ Cloud load failed: ...`
   - **Action:** Check if you ran the SQL script in Step 1

#### B. Test Data Creation \u0026 Persistence

1. **Create a test goal:**
   - Go to dashboard
   - Create a goal called "Test  Persistence"
   - Check console for: `[Supabase] ✓ Goal saved successfully`
   
2. **Test same-session persistence:**
   - Refresh the page (F5)
   - Goal should still be there
   
3. **Test new-session persistence:**
   - Close browser completely
   - Re-open and navigate to app
   - Goal should still be there
   
4. **Test overnight persistence:**
   - Create several goals/tasks
   - Close browser
   - Open app the next day
   - **ALL data should be present** ✅

#### C. Verify No RLS Errors

Check the browser console for any errors containing:
- ❌ `new row violates row-level security policy`
- ❌ `[Supabase] ✗ Save failed`

If you see these, the SQL script in Step 1 was not run correctly.

---

## Troubleshooting

### Issue: Red error banner appears

**Error:** "Failed to load data from cloud: [error message]"

**Solutions:**
1. Check Supabase credentials in `.env.local` are correct
2. Verify Supabase project is running (not paused)
3. Check browser console for specific error details
4. Ensure RLS policies were created (run SQL script)

### Issue: Data still vanishes

**Check these in order:**

1. **Verify RLS policies exist:**
   - Go to Supabase SQL Editor
   - Run:
     ```sql
     SELECT tablename, policyname
     FROM pg_policies
     WHERE schemaname = 'public'
     AND policyname LIKE '%Fallback%';
     ```
   - Should return 6 rows (one for each table)

2. **Check browser console:**
   - Look for `[Supabase] ✗ Save failed: ...` errors
   - The error message will tell you exactly what's wrong

3. **Verify environment variables:**
   - Ensure `.env.local` has NEXT_PUBLIC_USER_ID set
   - Should be: `2c32a446-1bbc-4294-8a29-3e4fef5649e6`

4. **Test manual insert:**
   - In Supabase SQL Editor, run:
     ```sql
     INSERT INTO goals (id, user_id, title, level, status)
     VALUES (
       gen_random_uuid(),
       '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid,
       'Manual Test Goal',
       'ad_hoc',
       'not_started'
     );
     ```
   - If this fails with RLS error → SQL script wasn't run correctly
   - If this succeeds → Issue is in app code, check console errors

### Issue: Build fails on Vercel

**Solution:**
- The build passed locally (verified)
- Clear Vercel build cache and rebuild
- Check Vercel environment variables match `.env.local`

---

## Files Changed

Only ONE file was modified:
- **src/components/AppInitializer.tsx** - Fixed data loading order

Files created for reference:
- **FIX_DATABASE_RLS.sql** - Manual SQL script
- **walkthrough.md** - Detailed documentation
- **implementation_plan.md** - Technical plan

---

## Monitoring After Deployment

For the next few days, monitor:

1. **Browser console** - Look for any unexpected errors
2. **User feedback** - Ask if data is persisting across sessions
3. **Supabase dashboard** - Check if data is being written to tables

If issues persist, check the [walkthrough.md](file:///C:/Users/aksha/.gemini/antigravity/brain/802e2d84-54d8-4a9e-8b25-0c88d82072ca/walkthrough.md) for detailed debugging steps.

---

## Success Criteria

✅ No red error banner on app load  
✅ Console shows: "[AppInit] ✓ Cloud data loaded successfully"  
✅ Goals/tasks persist after page refresh  
✅ Goals/tasks persist after browser restart  
✅ Goals/tasks persist overnight  
✅ No RLS errors in browser console  
✅ No "Save failed" errors in console

---

## Rollback Plan

If the fix causes issues:

1. **Revert code changes:**
   ```powershell
   git revert HEAD
   git push origin main
   ```

2. **Or manually revert AppInitializer.tsx:**
   - Restore previous version from git history
   - The old version loaded cloud data asynchronously (line 39)

3. **RLS policies are safe:**
   - The SQL script only ADDS policies, doesn't remove existing ones
   - If needed, policies can be dropped manually in SQL Editor

---

**End of Deployment Guide**
