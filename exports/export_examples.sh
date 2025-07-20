#!/bin/bash
# CV22 Export Examples with UV Environment Management
# Replace with your actual Supabase connection string

# Replace this with your actual Supabase connection string:
# DB_URL="postgresql://postgres:your_password@db.your_project.supabase.co:5432/postgres"
DB_URL="postgresql://user:password@host:port/database"

# Check if DB_URL is still the placeholder
if [[ "$DB_URL" == *"host:port"* ]]; then
    echo "❌ Please update DB_URL with your actual Supabase connection string!"
    echo "   Edit this file and replace the DB_URL variable with:"
    echo "   DB_URL=\"postgresql://postgres:your_password@db.your_project.supabase.co:5432/postgres\""
    exit 1
fi

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

echo "🔄 CV22 Export Examples"
echo "========================"

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

# Example 3: Extended format with metadata
echo "📦 Example 3: Extended format with metadata"
python export_cv22.py \
    --db-url "$DB_URL" \
    --output "cv22_extended_export.csv" \
    --format csv \
    --cv22-format extended

echo ""

# Example 4: JSON export for analysis
echo "📦 Example 4: JSON export for analysis"
python export_cv22.py \
    --db-url "$DB_URL" \
    --output "cv22_export.json" \
    --format json \
    --quality-filter medium

echo ""
echo "✅ All examples completed!"
echo ""
echo "Output files:"
echo "- cv22_standard_export.csv (Standard CV22 format)"
echo "- cv22_high_quality.csv (High quality only)"
echo "- cv22_extended_export.csv (With metadata)"
echo "- cv22_export.json (JSON format)"