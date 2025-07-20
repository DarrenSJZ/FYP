# Row Level Security (RLS) Setup for Accentric Database

This document contains SQL scripts and instructions for configuring Row Level Security policies for safe user data access.

## 1. Enable Row Level Security

```sql
-- Enable RLS on user_contributions table
ALTER TABLE user_contributions ENABLE ROW LEVEL SECURITY;

-- cv22_clips remains public read-only (no RLS needed for practice data)
```

## 2. User Contribution Policies

```sql
-- Policy 1: Users can view their own contributions
CREATE POLICY "Users can view own contributions" ON user_contributions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own contributions
CREATE POLICY "Users can insert own contributions" ON user_contributions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own contributions (before moderation)
CREATE POLICY "Users can update own pending contributions" ON user_contributions
  FOR UPDATE 
  USING (auth.uid() = user_id AND validation_status = 'pending')
  WITH CHECK (auth.uid() = user_id AND validation_status = 'pending');

-- Policy 4: Moderators can view all contributions
-- Note: This requires a moderator role system. For now, we'll use a simple approach
-- based on user metadata or specific user IDs
CREATE POLICY "Moderators can view all contributions" ON user_contributions
  FOR SELECT 
  USING (
    -- Option 1: Check for moderator flag in user metadata
    (auth.jwt()->>'user_metadata'->>'role' = 'moderator')
    OR
    -- Option 2: Specific moderator user IDs (update with actual moderator UUIDs)
    auth.uid() IN (
      -- Add moderator UUIDs here when you create moderator accounts
      -- 'uuid-of-moderator-1',
      -- 'uuid-of-moderator-2'
    )
  );

-- Policy 5: Moderators can update any contribution (for moderation)
CREATE POLICY "Moderators can moderate contributions" ON user_contributions
  FOR UPDATE 
  USING (
    (auth.jwt()->>'user_metadata'->>'role' = 'moderator')
    OR
    auth.uid() IN (
      -- Add moderator UUIDs here
    )
  )
  WITH CHECK (
    (auth.jwt()->>'user_metadata'->>'role' = 'moderator')
    OR
    auth.uid() IN (
      -- Add moderator UUIDs here
    )
  );
```

## 3. Storage Bucket Policies

### Enable RLS on Storage Objects Table

```sql
-- Enable RLS on storage.objects table (required for file upload policies)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

### Storage Policies for user-contributions Bucket

```sql
-- Policy 1: Users can upload to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'user-contributions' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy 2: Users can view their own uploads (REQUIRED for upsert functionality)
CREATE POLICY "Users can view own uploads" ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'user-contributions' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy 3: Public read access for audio playback
CREATE POLICY "Public read for audio playbook" ON storage.objects 
FOR SELECT TO anon 
USING (bucket_id = 'user-contributions');
```

### Expected Folder Structure

Files will be uploaded with the following structure:
```
user-contributions/
├── {user-uuid-1}/
│   ├── audio1.wav
│   └── audio2.wav
└── {user-uuid-2}/
    └── audio3.wav
```

### Policy Explanation

1. **INSERT Policy**: Users can only upload files to folders matching their user ID
2. **SELECT (authenticated)**: Users can only view files in their own folders - **CRITICAL for upsert functionality**
3. **SELECT (anon)**: Anyone can read files for audio playback (needed for frontend audio players)

### Important Notes

- **SELECT policy for authenticated users is REQUIRED** when using `upsert: true` in file uploads
- Supabase performs a SELECT operation first to check if file exists before INSERT/UPDATE
- Without authenticated SELECT policy, uploads fail with "new row violates row-level security policy"
- Use `anon` target role instead of `public` in Supabase Dashboard UI

## 4. Utility Functions for Moderation

```sql
-- Function to promote user to moderator (run manually for each moderator)
CREATE OR REPLACE FUNCTION promote_to_moderator(user_email text)
RETURNS void AS $$
BEGIN
  -- Update user metadata to include moderator role
  -- Note: This requires admin privileges to modify auth.users
  -- In practice, you'd handle this through Supabase Auth Admin API
  
  -- For now, document the process:
  -- 1. Go to Supabase Dashboard → Authentication → Users
  -- 2. Find the user by email
  -- 3. Edit user metadata to add: {"role": "moderator"}
  
  RAISE NOTICE 'To promote %, add {"role": "moderator"} to user metadata in Supabase Dashboard', user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user is moderator
CREATE OR REPLACE FUNCTION is_moderator()
RETURNS boolean AS $$
BEGIN
  RETURN (
    auth.jwt()->>'user_metadata'->>'role' = 'moderator'
    OR
    auth.uid() IN (
      -- Add known moderator UUIDs here
    )
  );
END;
$$ LANGUAGE plpgsql;
```

## 5. Moderator Dashboard Views (Optional)

```sql
-- View for moderator dashboard showing pending contributions
CREATE OR REPLACE VIEW moderator_pending_queue AS
SELECT 
  uc.id,
  uc.original_filename,
  uc.sentence,
  uc.file_size_bytes,
  uc.accent_detected,
  uc.locale_detected,
  uc.created_at,
  u.email as contributor_email,
  EXTRACT(EPOCH FROM (now() - uc.created_at))/3600 as hours_pending
FROM user_contributions uc
JOIN auth.users u ON uc.user_id = u.id
WHERE uc.validation_status = 'pending'
ORDER BY uc.created_at ASC;

-- Grant access to moderators only
GRANT SELECT ON moderator_pending_queue TO authenticated;

-- Create RLS policy for the view
ALTER VIEW moderator_pending_queue SET (security_barrier = true);
```

## 6. Testing Queries

```sql
-- Test user can see only their own contributions
SELECT * FROM user_contributions; -- Should only return current user's data

-- Test moderator can see all contributions (after promoting to moderator)
SELECT * FROM user_contributions; -- Should return all data for moderators

-- Test pending queue for moderators
SELECT * FROM moderator_pending_queue;
```

## 7. Setup Instructions

To complete RLS setup:

1. **Run SQL Scripts**: Execute the above SQL in Supabase SQL Editor

2. **Storage Policies**: Run the storage SQL scripts from Section 3 to enable file upload security.

3. **Promote moderators manually**:
   - Go to Dashboard → Authentication → Users
   - Find moderator user
   - Edit Raw User Meta Data to add: `{"role": "moderator"}`

4. **Test RLS policies**:
   - Create test user account
   - Upload contribution through frontend
   - Verify user only sees own data
   - Test moderator can see all data

5. **Monitor policy performance**:
   - Check query execution plans
   - Add indexes if needed for RLS queries

## 8. Troubleshooting Common Issues

### "new row violates row-level security policy" Error

**Symptoms:**
- 403 Unauthorized error when uploading files
- Error message: "new row violates row-level security policy"

**Common Causes & Solutions:**

1. **Missing SELECT Policy for Authenticated Users**
   - **Cause**: Using `upsert: true` without SELECT permission
   - **Solution**: Create SELECT policy for authenticated users (see Policy 2 above)
   - **Why**: Supabase checks if file exists before upload (SELECT), then INSERT/UPDATE

2. **RLS Not Enabled on storage.objects**
   - **Cause**: storage.objects table doesn't have RLS enabled
   - **Solution**: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`

3. **Incorrect Target Roles**
   - **Cause**: Policies applied to `public` instead of `authenticated`
   - **Solution**: Use `authenticated` for user policies, `anon` for public access

4. **Missing WITH CHECK Conditions**
   - **Cause**: INSERT policies without WITH CHECK clause
   - **Solution**: Ensure INSERT policies have proper WITH CHECK conditions

5. **Dashboard UI Issues**
   - **Cause**: Supabase Dashboard doesn't always create storage policies correctly
   - **Solution**: Create policies via SQL Editor instead of Dashboard UI

### Verification Steps

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage';

-- Check existing storage policies
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Test policy conditions
SELECT 
  auth.uid() as current_user,
  auth.uid()::text = (storage.foldername('test-user-id/file.mp3'))[1] as condition_result;
```

## 9. Security Notes

### Security Considerations:

**RLS Performance:**
- Policies add WHERE clauses to queries
- Ensure user_id columns are indexed
- Monitor query performance

**JWT Token Security:**
- auth.uid() relies on JWT validation
- Tokens expire and need refresh
- Handle token refresh in frontend

**Moderator Access:**
- Currently based on user metadata
- Consider separate moderator table for better control
- Implement audit logs for moderator actions

**Storage Access:**
- Audio files are publicly readable (needed for playback)
- User files are isolated by folder structure
- Consider signed URLs for sensitive content
- Implement file scanning for malicious content

**Rate Limiting:**
- Implement upload quotas per user
- Monitor storage usage
- Prevent spam uploads