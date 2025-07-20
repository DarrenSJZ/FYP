# Aggregate-on-Export Strategy for CV22 Data

This approach keeps original CV22 data pristine while aggregating user contributions during export.

## 1. Data Architecture

### **Separate Storage, Aggregate Export**
- **`cv22_clips`**: Original read-only Common Voice data (untouched)
- **`user_contributions`**: All user sessions (practice + upload) with CV22 schema
- **Export**: Intelligent aggregation that merges records by sentence

## 2. Aggregation Logic

### **Group by Sentence for Merging**
```sql
-- Aggregate export query that merges same sentences
WITH aggregated_data AS (
  SELECT 
    sentence,
    
    -- Aggregate contributors
    STRING_AGG(DISTINCT client_id, ',' ORDER BY client_id) as all_contributors,
    COUNT(DISTINCT client_id) as contributor_count,
    
    -- Sum validation votes
    SUM(up_votes) as total_upvotes,
    SUM(down_votes) as total_downvotes,
    
    -- Take best available metadata (prefer validated data)
    MAX(CASE WHEN validation_status = 'validated' THEN path END) as best_audio_path,
    MAX(CASE WHEN validation_status = 'validated' THEN accents END) as best_accents,
    MAX(CASE WHEN validation_status = 'validated' THEN locale END) as best_locale,
    
    -- Fallback to any available data if no validated version
    COALESCE(
      MAX(CASE WHEN validation_status = 'validated' THEN path END),
      MAX(path)
    ) as final_path,
    
    COALESCE(
      MAX(CASE WHEN validation_status = 'validated' THEN accents END),
      MAX(accents)
    ) as final_accents,
    
    COALESCE(
      MAX(CASE WHEN validation_status = 'validated' THEN locale END),
      MAX(locale)
    ) as final_locale,
    
    -- Quality metrics
    AVG(CASE WHEN session_type = 'practice' THEN 1.0 ELSE 0.0 END) as practice_ratio,
    COUNT(CASE WHEN session_type = 'upload' THEN 1 END) as upload_contributions,
    COUNT(CASE WHEN session_type = 'practice' THEN 1 END) as practice_sessions,
    
    -- Timestamps
    MIN(created_at) as first_recorded,
    MAX(created_at) as last_updated,
    
    -- Source diversity
    CASE 
      WHEN COUNT(DISTINCT source_table) > 1 THEN 'mixed'
      ELSE MAX(source_table)
    END as data_source_type
    
  FROM cv22_unified_export
  GROUP BY sentence
)
SELECT 
  -- CV22 Standard Export Fields
  all_contributors as client_id,
  final_path as path,
  sentence,
  total_upvotes as up_votes,
  total_downvotes as down_votes,
  NULL as age,        -- Could aggregate if collected
  NULL as gender,     -- Could aggregate if collected  
  final_accents as accents,
  final_locale as locale,
  NULL as segment,    -- Could be enhanced
  MD5(sentence) as sentence_id,  -- Generate consistent ID from sentence
  
  -- Extended metadata (optional for analysis)
  contributor_count,
  upload_contributions,
  practice_sessions,
  data_source_type,
  first_recorded,
  last_updated
  
FROM aggregated_data
ORDER BY total_upvotes DESC, contributor_count DESC;
```

## 3. Smart Merging Rules

### **Conflict Resolution Priority**
1. **Validated data** over pending/rejected
2. **Upload contributions** over practice sessions (for metadata)
3. **Most recent data** for ties
4. **Majority vote** for conflicting accents/locales

### **Field Aggregation Strategy**
```sql
-- Contributors: Combine all unique contributors
client_id = "cv22_user_001,john@email.com,mary@email.com"

-- Votes: Sum all validation votes  
up_votes = cv22_upvotes + user_upvotes + practice_validations
down_votes = cv22_downvotes + user_downvotes + practice_rejections

-- Metadata: Best available (validated > upload > practice > cv22)
accents = COALESCE(validated_accent, upload_accent, practice_accent, cv22_accent)
locale = COALESCE(validated_locale, upload_locale, practice_locale, cv22_locale)
path = COALESCE(validated_audio, upload_audio, cv22_audio)
```

## 4. Export Variants

### **A. Pure CV22 Export (Standard)**
```sql
-- Clean CV22 format for Common Voice compatibility
SELECT 
  all_contributors as client_id,
  final_path as path,
  sentence,
  total_upvotes as up_votes,
  total_downvotes as down_votes,
  NULL as age,
  NULL as gender,
  final_accents as accents,
  final_locale as locale,
  NULL as segment,
  MD5(sentence) as sentence_id
FROM aggregated_cv22_export;
```

### **B. Enhanced Export (Research)**
```sql
-- Extended format with contribution analytics
SELECT 
  *,
  contributor_count,
  upload_contributions,
  practice_sessions,
  practice_ratio,
  data_source_type,
  quality_score
FROM aggregated_cv22_export;
```

### **C. Quality-Filtered Export**
```sql
-- Only high-quality aggregated records
SELECT * FROM aggregated_cv22_export
WHERE 
  total_upvotes >= 2 
  AND contributor_count >= 2
  AND practice_ratio < 0.8  -- Not just practice sessions
  AND data_source_type IN ('mixed', 'user_contributions');
```

## 5. Quality Scoring

### **Automatic Quality Assessment**
```sql
-- Add quality score to aggregated data
CASE 
  WHEN contributor_count >= 3 AND total_upvotes >= 5 THEN 'high'
  WHEN contributor_count >= 2 AND total_upvotes >= 2 THEN 'medium'  
  WHEN upload_contributions > 0 THEN 'reviewed'
  ELSE 'basic'
END as quality_score
```

## 6. Example Aggregation

### **Before (Separate Records)**
```
cv22_clips:
- sentence: "The quick brown fox", client_id: "cv22_001", up_votes: 2, accents: "US"

user_contributions:  
- sentence: "The quick brown fox", client_id: "john@email.com", up_votes: 1, session_type: "practice"
- sentence: "The quick brown fox", client_id: "mary@email.com", up_votes: 1, session_type: "upload", accents: "UK"
```

### **After (Aggregated Export)**
```
Aggregated:
- sentence: "The quick brown fox"
- client_id: "cv22_001,john@email.com,mary@email.com"  
- up_votes: 4 (2+1+1)
- accents: "UK" (upload data preferred over CV22)
- contributor_count: 3
- upload_contributions: 1
- practice_sessions: 1
- data_source_type: "mixed"
```

## 7. Benefits

### **Data Integrity**
- ✅ Original CV22 data remains untouched
- ✅ User contributions tracked separately  
- ✅ No risk of corrupting source dataset

### **Enhanced Quality**
- ✅ Multiple contributors validate same sentences
- ✅ Vote aggregation improves confidence
- ✅ Quality scoring for export filtering

### **Flexibility**
- ✅ Can export pure CV22 format
- ✅ Can include enhanced metadata
- ✅ Can filter by quality thresholds
- ✅ Maintains data provenance

### **Analytics**
- ✅ Track contribution patterns
- ✅ Measure user engagement
- ✅ Identify high-quality sentences
- ✅ Monitor validation consensus

## 8. Implementation Steps

1. **Keep current table structure** (cv22_clips + user_contributions) ✅
2. **Create aggregation view** with smart merging logic ✅
3. **Add export functions** for different formats ✅
4. **Create Python export script** that calls aggregation query ✅
5. **Add quality filters** and export options ✅

## 9. Usage Instructions

### Prerequisites
```bash
cd exports/
pip install -r requirements_export.txt
```

### Basic Usage
```bash
# Standard CV22 export
python3 exports/export_cv22.py \
    --db-url "postgresql://user:pass@host:port/db" \
    --output "cv22_export.csv"

# High quality data only
python3 export_cv22.py \
    --db-url "postgresql://user:pass@host:port/db" \
    --output "cv22_high_quality.csv" \
    --quality-filter high

# Extended format with metadata
python3 export_cv22.py \
    --db-url "postgresql://user:pass@host:port/db" \
    --output "cv22_extended.csv" \
    --cv22-format extended

# JSON export
python3 export_cv22.py \
    --db-url "postgresql://user:pass@host:port/db" \
    --output "cv22_export.json" \
    --format json
```

### Export Options

**Formats:**
- `csv` - CSV format (default)
- `json` - JSON format

**CV22 Format:**
- `cv22` - Standard CV22 fields only (default)
- `extended` - Includes additional metadata

**Quality Filters:**
- `high` - High quality records only (3+ contributors, 5+ upvotes)
- `medium` - Medium+ quality (2+ contributors, 2+ upvotes)
- `validated` - Only validated or uploaded content

### Output Fields

**Standard CV22 Format:**
- client_id, path, sentence, up_votes, down_votes
- age, gender, accents, locale, segment, sentence_id

**Extended Format (adds):**
- contributor_count, upload_contributions, practice_sessions
- data_source_type, quality_score, practice_ratio
- first_recorded, last_updated

This approach gives us the best of both worlds: pristine source data + intelligent aggregation for export! 🎯