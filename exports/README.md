# CV22 Export Tools

This directory contains tools for exporting the aggregated CV22 dataset from both `cv22_clips` and `user_contributions` tables.

## Files

- **`export_cv22.py`** - Main export script with aggregation logic
- **`export_examples.sh`** - Example usage commands  
- **`requirements_export.txt`** - Python dependencies
- **`README.md`** - This file

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements_export.txt
```

### 2. Get Your Database URL
Your Supabase connection string format:
```
postgresql://postgres:[password]@[host]:5432/postgres
```

### 3. Run Export
```bash
# Standard CV22 format
python3 export_cv22.py \
    --db-url "postgresql://postgres:password@host:5432/postgres" \
    --output "cv22_dataset.csv"
```

## Export Options

### Formats
- **`--format csv`** - CSV format (default)
- **`--format json`** - JSON format

### CV22 Schema
- **`--cv22-format cv22`** - Standard CV22 fields only (default)
- **`--cv22-format extended`** - Includes additional metadata

### Quality Filters
- **`--quality-filter high`** - High quality (3+ contributors, 5+ upvotes)
- **`--quality-filter medium`** - Medium+ quality (2+ contributors, 2+ upvotes)  
- **`--quality-filter validated`** - Only validated/uploaded content

## Output Examples

### Standard CV22 Export
```csv
client_id,path,sentence,up_votes,down_votes,age,gender,accents,locale,segment,sentence_id
"cv22_001,john@email.com",audio1.wav,"Hello world",3,0,,,US,en-US,,5d41402abc4b2a76b9719d911017c592
```

### Extended Export (with metadata)
Includes additional fields:
- `contributor_count` - Number of unique contributors
- `upload_contributions` - Number of user uploads
- `practice_sessions` - Number of practice sessions
- `data_source_type` - Source: cv22_clips, user_contributions, or mixed
- `quality_score` - Quality assessment: high, medium, reviewed, basic
- `practice_ratio` - Ratio of practice vs upload sessions

## How It Works

1. **Combines Tables**: Merges `cv22_clips` and `user_contributions` data
2. **Groups by Sentence**: Aggregates multiple recordings of same sentence
3. **Smart Merging**: Prefers validated data over pending, uploads over practice
4. **Quality Scoring**: Automatically calculates quality based on contributors and votes
5. **CV22 Compatible**: Outputs in standard Common Voice format

## Use Cases

- **Research Dataset**: Export high-quality data for academic research
- **Model Training**: Get validated transcriptions for ASR model training  
- **Data Analysis**: Export with metadata for contribution analysis
- **Backup**: Create snapshots of your dataset at any point

## Implementation

The export script implements the aggregation strategy documented in `/aggregate_export_strategy.md`. It preserves the original CV22 data while intelligently merging user contributions to create a unified, high-quality dataset.

For detailed aggregation logic and examples, see the main strategy document.