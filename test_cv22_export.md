# CV22 Schema Export Testing

This document provides SQL queries and test scripts to validate CV22 export compatibility from the Accentric database.

## 1. CV22 Export Query

This query combines practice data and validated user contributions into CV22-compatible format:

```sql
-- Generate CV22-compatible export combining both data paths
SELECT 
  -- From validated practice dataset
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
  'cv22_dataset' as source_type,
  created_at
FROM cv22_clips

UNION ALL

-- From validated user contributions (transformed to CV22 format)
SELECT 
  COALESCE(u.email, 'anonymous') as client_id,
  uc.audio_url as path,
  uc.sentence,
  0 as up_votes,
  0 as down_votes,
  NULL as age,
  NULL as gender,
  uc.accent_detected as accents,
  uc.locale_detected as locale,
  NULL as segment,
  uc.id::text as sentence_id,
  'user_contribution' as source_type,
  uc.created_at
FROM user_contributions uc
LEFT JOIN auth.users u ON uc.user_id = u.id
WHERE uc.validation_status = 'validated'

ORDER BY created_at DESC;
```

## 2. Export Statistics Query

```sql
-- Get export statistics by source
SELECT 
  source_type,
  COUNT(*) as total_clips,
  COUNT(DISTINCT client_id) as unique_contributors,
  COUNT(DISTINCT locale) as locales_covered,
  AVG(LENGTH(sentence)) as avg_sentence_length,
  MIN(created_at) as earliest_clip,
  MAX(created_at) as latest_clip
FROM (
  -- CV22 clips
  SELECT 
    client_id,
    sentence,
    locale,
    created_at,
    'cv22_dataset' as source_type
  FROM cv22_clips
  
  UNION ALL
  
  -- User contributions
  SELECT 
    COALESCE(u.email, 'anonymous') as client_id,
    uc.sentence,
    uc.locale_detected as locale,
    uc.created_at,
    'user_contribution' as source_type
  FROM user_contributions uc
  LEFT JOIN auth.users u ON uc.user_id = u.id
  WHERE uc.validation_status = 'validated'
) combined_data
GROUP BY source_type;
```

## 3. Data Quality Validation

```sql
-- Check for data quality issues in export
WITH export_data AS (
  SELECT 
    client_id,
    path,
    sentence,
    locale,
    'cv22_dataset' as source_type
  FROM cv22_clips
  
  UNION ALL
  
  SELECT 
    COALESCE(u.email, 'anonymous') as client_id,
    uc.audio_url as path,
    uc.sentence,
    uc.locale_detected as locale,
    'user_contribution' as source_type
  FROM user_contributions uc
  LEFT JOIN auth.users u ON uc.user_id = u.id
  WHERE uc.validation_status = 'validated'
)
SELECT 
  -- Data completeness check
  COUNT(*) as total_records,
  COUNT(client_id) as records_with_client_id,
  COUNT(path) as records_with_audio_path,
  COUNT(sentence) as records_with_transcription,
  COUNT(locale) as records_with_locale,
  
  -- Data quality metrics
  COUNT(CASE WHEN LENGTH(sentence) < 10 THEN 1 END) as short_transcriptions,
  COUNT(CASE WHEN LENGTH(sentence) > 1000 THEN 1 END) as long_transcriptions,
  COUNT(CASE WHEN sentence ~ '[0-9]' THEN 1 END) as transcriptions_with_numbers,
  COUNT(CASE WHEN path ~ '^https?://' THEN 1 END) as valid_audio_urls,
  
  -- Source breakdown
  COUNT(CASE WHEN source_type = 'cv22_dataset' THEN 1 END) as cv22_records,
  COUNT(CASE WHEN source_type = 'user_contribution' THEN 1 END) as user_contribution_records
FROM export_data;
```

## 4. Export File Generation (TSV Format)

```sql
-- Generate clips.tsv content (CV22 standard format)
COPY (
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
  FROM (
    -- CV22 data
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
    FROM cv22_clips
    
    UNION ALL
    
    -- User contributions
    SELECT 
      COALESCE(u.email, 'anonymous') as client_id,
      uc.audio_url as path,
      uc.sentence,
      0 as up_votes,
      0 as down_votes,
      NULL as age,
      NULL as gender,
      uc.accent_detected as accents,
      uc.locale_detected as locale,
      NULL as segment,
      uc.id::text as sentence_id
    FROM user_contributions uc
    LEFT JOIN auth.users u ON uc.user_id = u.id
    WHERE uc.validation_status = 'validated'
  ) combined_export
  ORDER BY sentence_id
) TO '/tmp/clips.tsv' WITH (FORMAT CSV, DELIMITER E'\t', HEADER);
```

## 5. Sample Test Data

```sql
-- Insert sample test data for export validation
INSERT INTO cv22_clips (client_id, path, sentence, locale, accents, up_votes, down_votes) VALUES
('test_user_001', 'https://example.com/test1.wav', 'The quick brown fox jumps over the lazy dog.', 'en-US', 'General American', 2, 0),
('test_user_002', 'https://example.com/test2.wav', 'Pack my box with five dozen liquor jugs.', 'en-GB', 'Received Pronunciation', 1, 0),
('test_user_003', 'https://example.com/test3.wav', 'How vexingly quick daft zebras jump!', 'en-AU', 'General Australian', 3, 1);

-- Verify test data appears in export
SELECT COUNT(*) as test_records_in_export 
FROM cv22_clips 
WHERE client_id LIKE 'test_user_%';
```

## 6. Export Validation Tests

### Test 1: Schema Compatibility
```sql
-- Verify all required CV22 fields are present
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cv22_clips'
ORDER BY ordinal_position;

-- Expected fields: client_id, path, sentence, up_votes, down_votes, age, gender, accents, locale, segment, sentence_id
```

### Test 2: Data Integrity
```sql
-- Check for duplicate sentence_ids
SELECT sentence_id, COUNT(*) 
FROM cv22_clips 
GROUP BY sentence_id 
HAVING COUNT(*) > 1;

-- Check for missing required fields
SELECT 
  COUNT(CASE WHEN sentence IS NULL OR sentence = '' THEN 1 END) as missing_sentences,
  COUNT(CASE WHEN path IS NULL OR path = '' THEN 1 END) as missing_paths,
  COUNT(CASE WHEN client_id IS NULL OR client_id = '' THEN 1 END) as missing_client_ids
FROM cv22_clips;
```

### Test 3: Export Performance
```sql
-- Measure export query performance
EXPLAIN ANALYZE
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
FROM cv22_clips
UNION ALL
SELECT 
  COALESCE(u.email, 'anonymous') as client_id,
  uc.audio_url as path,
  uc.sentence,
  0 as up_votes,
  0 as down_votes,
  NULL as age,
  NULL as gender,
  uc.accent_detected as accents,
  uc.locale_detected as locale,
  NULL as segment,
  uc.id::text as sentence_id
FROM user_contributions uc
LEFT JOIN auth.users u ON uc.user_id = u.id
WHERE uc.validation_status = 'validated';
```

## 7. Frontend Export Integration

Create a simple export endpoint that can be called from the frontend:

```typescript
// Frontend export function
const exportCV22Data = async () => {
  try {
    const { data, error } = await supabase.rpc('export_cv22_data');
    
    if (error) throw error;
    
    // Convert to TSV format
    const tsvContent = data.map(row => 
      Object.values(row).join('\t')
    ).join('\n');
    
    // Download file
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv22_export_${new Date().toISOString().split('T')[0]}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
  }
};
```

## 8. Database Function for Export

```sql
-- Create a database function for CV22 export
CREATE OR REPLACE FUNCTION export_cv22_data()
RETURNS TABLE (
  client_id text,
  path text,
  sentence text,
  up_votes integer,
  down_votes integer,
  age varchar(50),
  gender varchar(50),
  accents text,
  locale varchar(10),
  segment text,
  sentence_id text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.client_id,
    c.path,
    c.sentence,
    c.up_votes,
    c.down_votes,
    c.age,
    c.gender,
    c.accents,
    c.locale,
    c.segment,
    c.sentence_id
  FROM cv22_clips c
  
  UNION ALL
  
  SELECT 
    COALESCE(u.email, 'anonymous')::text as client_id,
    uc.audio_url as path,
    uc.sentence,
    0 as up_votes,
    0 as down_votes,
    NULL::varchar(50) as age,
    NULL::varchar(50) as gender,
    uc.accent_detected as accents,
    uc.locale_detected::varchar(10) as locale,
    NULL::text as segment,
    uc.id::text as sentence_id
  FROM user_contributions uc
  LEFT JOIN auth.users u ON uc.user_id = u.id
  WHERE uc.validation_status = 'validated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION export_cv22_data() TO authenticated;
```

## 9. Running the Tests

1. **Setup test data**: Run the sample data insert queries
2. **Execute export query**: Run the main CV22 export query
3. **Validate results**: Check data quality and completeness
4. **Performance test**: Run EXPLAIN ANALYZE on export queries
5. **File generation**: Test TSV export functionality
6. **Frontend integration**: Test export from user interface

## 10. Expected Results

After running these tests, you should see:
- ✅ All CV22 required fields present
- ✅ No data integrity issues
- ✅ Both cv22_clips and validated user_contributions in export
- ✅ Proper TSV formatting
- ✅ Reasonable query performance (< 1 second for typical datasets)
- ✅ Frontend export functionality working