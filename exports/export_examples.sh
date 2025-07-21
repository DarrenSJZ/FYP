#!/bin/bash
# CV22 Export Examples - Standard CV22 Format Only
# Automated UV environment setup with working Supabase connection

# Database connection string with working password
DB_URL="postgresql://postgres.hzquxnzusgiiclvrzbqy:4NtuyG5Cu7X1KVmP@aws-0-us-east-2.pooler.supabase.com:6543/postgres"

# Function to setup UV environment
setup_uv_env() {
    echo "🔧 Setting up UV environment..."
    
    # Check if uv is installed
    if ! command -v uv &> /dev/null; then
        echo "❌ UV is not installed. Please install UV first:"
        echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi
    
    # Create venv if it doesn't exist
    if [ ! -d ".venv" ]; then
        echo "📁 Creating UV virtual environment..."
        uv venv
    fi
    
    # Activate the virtual environment
    echo "🔄 Activating UV virtual environment..."
    source .venv/bin/activate
    
    # Install requirements
    echo "📦 Installing requirements with UV..."
    if [ -f "requirements_export.txt" ]; then
        uv pip install -r requirements_export.txt
    else
        echo "❌ requirements_export.txt not found!"
        exit 1
    fi
    
    echo "✅ UV environment ready!"
    echo ""
}

echo "🔄 CV22 Export Examples - Standard Format Only"
echo "=============================================="

# Setup UV environment
setup_uv_env

# Example 1: Standard CV22 format export (all data)
echo "📦 Example 1: Standard CV22 format (all data)"
python export_cv22.py \
    --db-url "$DB_URL" \
    --output "cv22_standard_export.csv" \
    --format csv \
    --cv22-format cv22

echo ""

# Example 2: High quality data only
echo "📦 Example 2: High quality data only"
python export_cv22.py \
    --db-url "$DB_URL" \
    --output "cv22_high_quality.csv" \
    --format csv \
    --cv22-format cv22 \
    --quality-filter high

echo ""

# Example 3: Medium quality and above
echo "📦 Example 3: Medium quality and above"
python export_cv22.py \
    --db-url "$DB_URL" \
    --output "cv22_medium_quality.csv" \
    --format csv \
    --cv22-format cv22 \
    --quality-filter medium

echo ""

# Example 4: Validated content only
echo "📦 Example 4: Validated content only"
python export_cv22.py \
    --db-url "$DB_URL" \
    --output "cv22_validated.csv" \
    --format csv \
    --cv22-format cv22 \
    --quality-filter validated

echo ""
echo "✅ All examples completed!"
echo ""
echo "Output files (Standard CV22 format):"
echo "- cv22_standard_export.csv (All data)"
echo "- cv22_high_quality.csv (High quality only)"
echo "- cv22_medium_quality.csv (Medium+ quality)"
echo "- cv22_validated.csv (Validated content only)"
echo ""
echo "All files contain standard Common Voice 22 fields:"
echo "client_id, path, sentence, up_votes, down_votes, age, gender, accents, locale, segment, sentence_id"