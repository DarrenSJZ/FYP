# CV22 Export Tool

This directory contains an interactive tool for exporting aggregated CV22-compatible datasets from both `cv22_clips` and `user_contributions` tables.

## Files

- **`export_cv22_tui.py`** - Interactive export tool with TUI
- **`export_examples.sh`** - Automated examples script (standard CV22 format)
- **`requirements_export.txt`** - Python dependencies
- **`README.md`** - This file

## Quick Start

### Option 1: Interactive TUI (Recommended)
```bash
cd exports/
python3 export_cv22_tui.py
```

**That's it!** The tool automatically:
1. ✅ **Checks for UV** (with installation instructions if missing)
2. ✅ **Creates virtual environment** (if doesn't exist)
3. ✅ **Installs dependencies** via UV
4. ✅ **Restarts in clean environment** automatically
5. ✅ **Guides you through export** with interactive prompts

### Option 2: Automated Examples
```bash
cd exports/
./export_examples.sh
```

**Runs 4 example exports automatically:**
- All data (standard CV22 format)
- High quality data only
- Medium+ quality data
- Validated content only

### What The Tools Do:
1. **Environment Setup** - Automatic UV environment creation and dependency installation
2. **Database Connection** - Interactive prompts (TUI) or pre-configured (examples)
3. **Export Options** - Choose quality filters and output filename
4. **Export Process** - Automatic data aggregation and CSV generation

## Database Connection

The tool will prompt you for your Supabase database connection details with step-by-step instructions:

### Getting Your Connection String:
1. **Go to**: https://app.supabase.io/
2. **Select** your project
3. **Click** the "Connect" button at the top
4. **Choose** "Transaction pooler" (recommended for exports)
5. **Copy** the connection details

### Connection Format:
```
Host: aws-0-region.pooler.supabase.com
Username: postgres.your_project_ref
Password: [your_password]
Port: 6543 (default for transaction pooler)
Database: postgres (default)
```

## Export Options

### Quality Filters Available:
- **All data** - No filtering (includes all records)
- **High quality** - 3+ contributors, 5+ upvotes
- **Medium+ quality** - 2+ contributors, 2+ upvotes  
- **Validated only** - Only validated/uploaded content

### Output Format:
Standard Common Voice 22 CSV format with fields:
- `client_id`, `path`, `sentence`, `up_votes`, `down_votes`
- `age`, `gender`, `accents`, `locale`, `segment`, `sentence_id`

## How It Works

1. **Smart Aggregation**: Merges `cv22_clips` and `user_contributions` by sentence
2. **Quality Scoring**: Automatically calculates quality based on contributors and votes
3. **Conflict Resolution**: Prefers validated data over pending, uploads over practice
4. **CV22 Compatible**: Outputs in standard Common Voice format

## Features

- 🎨 **Interactive TUI** with colored output and clear instructions
- 🔒 **Secure Input** - Password masking during entry
- 🔄 **Connection Testing** - Validates database connection before export
- 📊 **Quality Filtering** - Multiple options for data quality
- ✅ **Error Handling** - Clear error messages and troubleshooting tips
- 📁 **Automatic Naming** - Timestamped filenames by default

## Troubleshooting

### Common Connection Issues:
- **Wrong password**: Check your Supabase dashboard and reset if needed
- **Wrong host format**: Should include `pooler.supabase.com`
- **Wrong username**: Should include your project reference ID
- **Network issues**: Try different internet connection

### Database Issues:
- **Tables not found**: Ensure `cv22_clips` and `user_contributions` tables exist
- **No data**: Check if your tables contain data
- **Permission errors**: Verify your database user has read access

## Implementation

The export tool implements the aggregation strategy documented in `/aggregate_export_strategy.md`. It preserves original CV22 data while intelligently merging user contributions to create a unified, high-quality dataset suitable for Common Voice compatibility.