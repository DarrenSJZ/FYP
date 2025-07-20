# Unified CV22 Schema Migration

This migration aligns both `cv22_clips` and `user_contributions` tables to use the same CV22-compatible schema for easy export.

## 1. Add CV22 Fields to user_contributions

```sql
-- Add missing CV22 standard fields to user_contributions
ALTER TABLE user_contributions 
ADD COLUMN client_id text,
ADD COLUMN path text,
ADD COLUMN up_votes integer DEFAULT 0,
ADD COLUMN down_votes integer DEFAULT 0,
ADD COLUMN age varchar(50),
ADD COLUMN gender varchar(50),
ADD COLUMN accents text,
ADD COLUMN locale varchar(10),
ADD COLUMN segment text,
ADD COLUMN sentence_id text;

-- Add session tracking fields
ALTER TABLE user_contributions
ADD COLUMN session_type varchar(20) DEFAULT 'upload' CHECK (session_type IN ('upload', 'practice')),
ADD COLUMN practice_clip_id uuid REFERENCES cv22_clips(id) ON DELETE SET NULL;
```

## 2. Migrate Existing Data

```sql
-- Migrate existing user_contributions data to CV22 format
UPDATE user_contributions SET
  path = audio_url,                          -- Map audio_url to path
  accents = accent_detected,                 -- Map accent_detected to accents  
  locale = locale_detected,                  -- Map locale_detected to locale
  client_id = COALESCE(                      -- Map user to client_id
    (SELECT email FROM auth.users WHERE id = user_contributions.user_id),
    'anonymous_' || user_id::text
  ),
  sentence_id = id::text                     -- Use record ID as sentence_id
WHERE path IS NULL;  -- Only update records that haven't been migrated yet
```

## 3. Add Session Tracking Fields to cv22_clips

```sql
-- Add session tracking to cv22_clips for consistency
ALTER TABLE cv22_clips
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN session_type varchar(20) DEFAULT 'practice' CHECK (session_type IN ('upload', 'practice')),
ADD COLUMN transcription_results jsonb,
ADD COLUMN validation_status text DEFAULT 'validated' CHECK (validation_status IN ('pending', 'validated', 'rejected'));
```

## 4. Create Unified View for Export

```sql
-- Create unified view that combines both tables with CV22 schema
CREATE OR REPLACE VIEW cv22_unified_export AS
SELECT 
  -- CV22 Standard Fields
  id,
  client_id,
  path,
  sentence,
  up_votes,
  down_votes,
  age,
  gender,
  accents,
  locale,
  segment,
  sentence_id,
  
  -- Session Tracking
  user_id,
  session_type,
  validation_status,
  created_at,
  
  -- Extended Metadata (for internal use)
  transcription_results,
  CASE 
    WHEN session_type = 'practice' THEN practice_clip_id
    ELSE NULL 
  END as source_clip_id,
  
  -- Source table indicator
  'user_contributions' as source_table
FROM user_contributions

UNION ALL

SELECT 
  -- CV22 Standard Fields  
  id,
  client_id,
  path,
  sentence,
  up_votes,
  down_votes,
  age,
  gender,
  accents,
  locale,
  segment,
  sentence_id,
  
  -- Session Tracking
  user_id,
  session_type,
  validation_status,
  created_at,
  
  -- Extended Metadata
  transcription_results,
  NULL as source_clip_id,
  
  -- Source table indicator
  'cv22_clips' as source_table
FROM cv22_clips;
```

## 5. Update Indexes for Performance

```sql
-- Add indexes for the new fields
CREATE INDEX idx_user_contributions_session_type ON user_contributions(session_type);
CREATE INDEX idx_user_contributions_practice_clip ON user_contributions(practice_clip_id);
CREATE INDEX idx_user_contributions_client_id ON user_contributions(client_id);
CREATE INDEX idx_user_contributions_locale ON user_contributions(locale);
CREATE INDEX idx_user_contributions_accents ON user_contributions(accents);

-- Add indexes to cv22_clips for consistency  
CREATE INDEX idx_cv22_clips_user_id ON cv22_clips(user_id);
CREATE INDEX idx_cv22_clips_session_type ON cv22_clips(session_type);
CREATE INDEX idx_cv22_clips_validation_status ON cv22_clips(validation_status);
```

## 6. Pure CV22 Export Query

```sql
-- Clean CV22 export query (no app-specific fields)
SELECT 
  client_id,
  path,
  sentence,
  up_votes,
  down_votes,
  age,
  gender,
  accents,
  locale,
  segment,
  sentence_id
FROM cv22_unified_export
WHERE validation_status = 'validated'
ORDER BY created_at;
```

## 7. Extended Export with Session Data

```sql
-- Extended export with session metadata for analysis
SELECT 
  -- CV22 Standard Fields
  client_id,
  path,
  sentence,
  up_votes,
  down_votes,
  age,
  gender,
  accents,
  locale,
  segment,
  sentence_id,
  
  -- Session Metadata
  session_type,
  validation_status,
  created_at,
  source_table,
  
  -- User association (for analytics)
  CASE 
    WHEN user_id IS NOT NULL THEN 'registered_user'
    ELSE 'anonymous'
  END as user_type
FROM cv22_unified_export
ORDER BY created_at DESC;
```

## 8. Practice Session Insert Template

```sql
-- Template for inserting practice session data
INSERT INTO user_contributions (
  -- CV22 Fields
  client_id,
  path,
  sentence,
  up_votes,
  down_votes,
  age,
  gender,
  accents,
  locale,
  segment,
  sentence_id,
  
  -- Session Fields
  user_id,
  session_type,
  practice_clip_id,
  validation_status,
  transcription_results
) VALUES (
  $1, -- client_id (user email or anonymous)
  $2, -- path (original clip path)  
  $3, -- sentence (ground truth)
  0,  -- up_votes
  0,  -- down_votes
  NULL, -- age
  NULL, -- gender
  $4, -- accents (detected)
  $5, -- locale (detected)
  NULL, -- segment
  $6, -- sentence_id (practice clip ID)
  
  $7, -- user_id
  'practice', -- session_type
  $8, -- practice_clip_id
  'completed', -- validation_status
  $9  -- transcription_results (ASR output + user choices)
);
```

## 9. Data Validation Queries

```sql
-- Check migration completeness
SELECT 
  COUNT(*) as total_records,
  COUNT(path) as records_with_path,
  COUNT(client_id) as records_with_client_id,
  COUNT(sentence_id) as records_with_sentence_id,
  session_type,
  source_table
FROM cv22_unified_export
GROUP BY session_type, source_table;

-- Check for missing CV22 fields
SELECT 
  COUNT(CASE WHEN client_id IS NULL THEN 1 END) as missing_client_id,
  COUNT(CASE WHEN path IS NULL THEN 1 END) as missing_path,
  COUNT(CASE WHEN sentence IS NULL THEN 1 END) as missing_sentence,
  COUNT(CASE WHEN sentence_id IS NULL THEN 1 END) as missing_sentence_id
FROM cv22_unified_export;
```

## 10. Benefits of Unified Schema

1. **Single Export Query**: Both tables can be queried with same CV22 headers
2. **Practice Session Tracking**: User practice sessions are now saved
3. **Consistent Data Model**: Same fields across both data sources
4. **Easy Merging**: Tables can be combined for analysis
5. **CV22 Compatibility**: Direct export to Common Voice format
6. **Session Analytics**: Track user progress and engagement
7. **Flexible Validation**: Same validation workflow for all data

## 11. Migration Execution Order

1. Run ALTER TABLE statements (adds new columns)
2. Run UPDATE statement (migrates existing data)  
3. Create unified view
4. Add indexes
5. Test export queries
6. Update application code to use new schema

This unified approach makes the database much cleaner and export much simpler!