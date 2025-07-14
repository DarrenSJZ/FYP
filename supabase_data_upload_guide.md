# Supabase Data Upload Guide - Common Voice 21 Dataset

## Prerequisites
- [x] Supabase CLI installed (version 2.30.4)
- [ ] Supabase project created
- [ ] Common Voice dataset files available

## Step 1: Setup Supabase Authentication

### Get your Supabase Access Token
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click on your profile (top right)
3. Go to "Access Tokens" 
4. Generate a new token (or use existing one)
5. Copy the token

### Login to Supabase CLI
```bash
# Method 1: Using token directly
supabase login --token your_access_token_here

# Method 2: Set environment variable
export SUPABASE_ACCESS_TOKEN=your_access_token_here
supabase login
```

## Step 2: Link to Your Project

### Get your project reference
1. Go to your Supabase project dashboard
2. Go to Settings → General
3. Copy the "Reference ID"

### Link CLI to project
```bash
supabase link --project-ref your_project_ref_here
```

## Step 3: Prepare Database Schema

### Delete existing tables (if needed)
```sql
-- Run this in Supabase SQL Editor
DROP TABLE IF EXISTS clips CASCADE;
DROP TABLE IF EXISTS datasets CASCADE;
DROP TABLE IF EXISTS languages CASCADE;
```

### Create new schema
```sql
-- 1. Languages table
CREATE TABLE languages (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(10) NOT NULL UNIQUE,
  name text,
  created_at timestamptz DEFAULT now()
);

-- 2. Datasets table
CREATE TABLE datasets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  version varchar(50),
  language_id smallint REFERENCES languages(id),
  description text,
  gcs_bucket_name text NOT NULL,
  gcs_base_path text NOT NULL,
  metadata_source_file text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Clips table (with all Common Voice fields)
CREATE TABLE clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id uuid REFERENCES datasets(id) ON DELETE CASCADE,
  client_id text,
  gcs_filename text NOT NULL,
  sentence_id text,
  sentence text,
  sentence_domain text,
  up_votes integer DEFAULT 0,
  down_votes integer DEFAULT 0,
  age varchar(50),
  gender varchar(50),
  accent text,
  variant text,
  locale varchar(10),
  segment text,
  duration_ms integer,
  validation_status varchar(20) DEFAULT 'validated',
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dataset_id, gcs_filename)
);

-- 4. Create indexes for performance
CREATE INDEX idx_clips_dataset_id ON clips(dataset_id);
CREATE INDEX idx_clips_client_id ON clips(client_id);
CREATE INDEX idx_clips_locale ON clips(locale);
CREATE INDEX idx_clips_accent ON clips(accent);
CREATE INDEX idx_clips_sentence_fts ON clips USING gin(to_tsvector('english', sentence));
CREATE INDEX idx_clips_validation_status ON clips(validation_status);

-- 5. Insert English language
INSERT INTO languages (code, name) VALUES ('en', 'English');

-- 6. Insert Common Voice dataset
INSERT INTO datasets (name, version, language_id, description, gcs_bucket_name, gcs_base_path, metadata_source_file)
VALUES (
  'Common Voice 21.0',
  'v21.0',
  (SELECT id FROM languages WHERE code = 'en'),
  'Mozilla Common Voice English dataset version 21',
  'cv-corpus-21',
  'en/clips',
  'cv-corpus-21-2024-03-15/en/validated.tsv'
);
```

## Step 4: Prepare Data Files

### Create working directory
```bash
mkdir -p ~/supabase_upload
cd ~/supabase_upload
```

### Copy and prepare data files
```bash
# Copy the main data files
cp /home/laughdiemeh/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/validated.tsv .
cp /home/laughdiemeh/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/clip_durations.tsv .

# Check file structure
echo "=== validated.tsv header ==="
head -1 validated.tsv

echo "=== clip_durations.tsv header ==="
head -1 clip_durations.tsv

echo "=== Row counts ==="
wc -l *.tsv
```

## Step 5: Create Upload Script

### Create Python upload script
```bash
# Create upload script
cat > upload_data.py << 'EOF'
import pandas as pd
import os
from supabase import create_client, Client
import sys
from tqdm import tqdm

# Configuration
SUPABASE_URL = "your_supabase_url_here"
SUPABASE_KEY = "your_supabase_anon_key_here"
CHUNK_SIZE = 1000

def main():
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get dataset ID
    dataset_result = supabase.table('datasets').select('id').eq('name', 'Common Voice 21.0').execute()
    if not dataset_result.data:
        print("ERROR: Dataset not found. Run the schema setup first.")
        sys.exit(1)
    
    dataset_id = dataset_result.data[0]['id']
    print(f"Using dataset ID: {dataset_id}")
    
    # Load duration data
    print("Loading duration data...")
    durations = pd.read_csv('clip_durations.tsv', sep='\t')
    duration_dict = dict(zip(durations['clip'], durations['duration[ms]']))
    print(f"Loaded {len(duration_dict)} duration records")
    
    # Process validated.tsv in chunks
    print("Processing validated.tsv...")
    
    total_rows = sum(1 for line in open('validated.tsv')) - 1  # Subtract header
    processed = 0
    
    for chunk in tqdm(pd.read_csv('validated.tsv', sep='\t', chunksize=CHUNK_SIZE), 
                     desc="Processing chunks"):
        
        # Prepare data for upload
        records = []
        for _, row in chunk.iterrows():
            # Get duration from duration file
            duration = duration_dict.get(row['path'], None)
            
            record = {
                'dataset_id': dataset_id,
                'client_id': row['client_id'],
                'gcs_filename': row['path'],
                'sentence_id': row.get('sentence_id'),
                'sentence': row['sentence'],
                'sentence_domain': row.get('sentence_domain'),
                'up_votes': int(row['up_votes']) if pd.notna(row['up_votes']) else 0,
                'down_votes': int(row['down_votes']) if pd.notna(row['down_votes']) else 0,
                'age': row.get('age') if pd.notna(row.get('age')) else None,
                'gender': row.get('gender') if pd.notna(row.get('gender')) else None,
                'accent': row.get('accents') if pd.notna(row.get('accents')) else None,
                'variant': row.get('variant') if pd.notna(row.get('variant')) else None,
                'locale': row.get('locale') if pd.notna(row.get('locale')) else None,
                'segment': row.get('segment') if pd.notna(row.get('segment')) else None,
                'duration_ms': duration,
                'validation_status': 'validated'
            }
            records.append(record)
        
        # Upload chunk
        try:
            result = supabase.table('clips').insert(records).execute()
            processed += len(records)
            print(f"Uploaded chunk: {processed}/{total_rows} records")
        except Exception as e:
            print(f"Error uploading chunk: {e}")
            # Continue with next chunk
    
    print(f"Upload complete! Total records processed: {processed}")

if __name__ == "__main__":
    main()
EOF
```

### Install required Python packages
```bash
pip install pandas supabase tqdm
```

## Step 6: Configure and Run Upload

### Update the upload script with your credentials
```bash
# Edit the script to add your Supabase credentials
nano upload_data.py

# Update these lines:
# SUPABASE_URL = "https://your-project.supabase.co"
# SUPABASE_KEY = "your_anon_key_here"
```

### Run the upload
```bash
python upload_data.py
```

## Step 7: Verify Upload

### Check the data in Supabase
```sql
-- Check total records
SELECT COUNT(*) FROM clips;

-- Check sample data
SELECT 
  sentence,
  accent,
  locale,
  duration_ms,
  validation_status
FROM clips 
LIMIT 10;

-- Check data completeness
SELECT 
  COUNT(*) as total,
  COUNT(accent) as has_accent,
  COUNT(age) as has_age,
  COUNT(gender) as has_gender,
  COUNT(duration_ms) as has_duration
FROM clips;
```

## Troubleshooting

### Common Issues

**1. Authentication Error**
```bash
# Re-login with token
supabase login --token your_access_token
```

**2. Large File Upload Timeout**
- Reduce `CHUNK_SIZE` in the Python script
- Run upload in smaller batches

**3. Duplicate Key Errors**
- Check if data already exists
- Use `ON CONFLICT` in SQL or handle duplicates in Python

**4. Memory Issues**
- Process smaller chunks
- Clear processed data from memory

### Performance Tips

- Use indexes on frequently queried columns
- Process data in chunks (1000-5000 records)
- Monitor Supabase dashboard for performance metrics
- Consider using Supabase's bulk upload features for very large datasets

## Next Steps

After successful upload:
1. Update your frontend to use the new schema
2. Test random clip fetching
3. Set up Row Level Security (RLS) policies
4. Create views for optimized queries

## Files Created
- `~/supabase_upload/upload_data.py` - Upload script
- `~/supabase_upload/validated.tsv` - Main data file
- `~/supabase_upload/clip_durations.tsv` - Duration data