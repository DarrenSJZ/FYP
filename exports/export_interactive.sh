#!/bin/bash
# CV22 Export Interactive TUI
# Interactive terminal UI for CV22 data export

# Colors for TUI
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to setup UV environment
setup_uv_env() {
    echo -e "${BLUE}🔧 Setting up UV environment...${NC}"
    
    # Check if uv is installed
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ UV is not installed. Please install UV first:${NC}"
        echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi
    
    # Create venv if it doesn't exist
    if [ ! -d ".venv" ]; then
        echo -e "${BLUE}📁 Creating UV virtual environment...${NC}"
        uv venv
    fi
    
    # Activate the virtual environment
    echo -e "${BLUE}🔄 Activating UV virtual environment...${NC}"
    source .venv/bin/activate
    
    # Install requirements
    echo -e "${BLUE}📦 Installing requirements with UV...${NC}"
    if [ -f "requirements_export.txt" ]; then
        uv pip install -r requirements_export.txt
    else
        echo -e "${RED}❌ requirements_export.txt not found!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ UV environment ready!${NC}"
    echo ""
}

# Function to get database URL
get_database_url() {
    echo -e "${CYAN}🔗 Database Connection${NC}"
    echo "=================================================="
    echo ""
    echo "Please enter your Supabase database URL:"
    echo -e "${YELLOW}Format: postgresql://postgres:password@db.project.supabase.co:5432/postgres${NC}"
    echo ""
    read -p "Database URL: " DB_URL
    
    if [[ -z "$DB_URL" ]]; then
        echo -e "${RED}❌ Database URL cannot be empty!${NC}"
        return 1
    fi
    
    if [[ "$DB_URL" == *"host:port"* ]] || [[ "$DB_URL" == *"user:password"* ]]; then
        echo -e "${RED}❌ Please enter a real database URL, not the placeholder!${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Database URL set${NC}"
    echo ""
    return 0
}

# Function to show export options menu
show_export_menu() {
    echo -e "${CYAN}📦 Export Options${NC}"
    echo "=================================================="
    echo ""
    echo "1) Standard CV22 Export (all data)"
    echo "2) High Quality Export (3+ contributors, 5+ votes)"
    echo "3) Medium Quality Export (2+ contributors, 2+ votes)"
    echo "4) Validated Content Only"
    echo "5) Extended Format (with metadata)"
    echo "6) JSON Format Export"
    echo "7) Custom Export (choose your options)"
    echo "8) Run All Examples"
    echo ""
    echo "0) Exit"
    echo ""
}

# Function to get output filename
get_output_filename() {
    local default_name="$1"
    echo ""
    read -p "Output filename (default: $default_name): " filename
    if [[ -z "$filename" ]]; then
        filename="$default_name"
    fi
    echo "$filename"
}

# Function to run export with parameters
run_export() {
    local output="$1"
    local format="${2:-csv}"
    local cv22_format="${3:-cv22}"
    local quality_filter="$4"
    
    echo -e "${BLUE}🚀 Running export...${NC}"
    echo "Output: $output"
    echo "Format: $format"
    echo "CV22 Format: $cv22_format"
    if [[ -n "$quality_filter" ]]; then
        echo "Quality Filter: $quality_filter"
    fi
    echo ""
    
    # Build command
    cmd="python export_cv22.py --db-url \"$DB_URL\" --output \"$output\" --format $format --cv22-format $cv22_format"
    if [[ -n "$quality_filter" ]]; then
        cmd="$cmd --quality-filter $quality_filter"
    fi
    
    # Execute command
    echo -e "${YELLOW}Executing: $cmd${NC}"
    echo ""
    eval $cmd
    
    if [[ $? -eq 0 ]]; then
        echo ""
        echo -e "${GREEN}✅ Export completed successfully!${NC}"
        echo -e "${GREEN}📁 Output file: $output${NC}"
    else
        echo ""
        echo -e "${RED}❌ Export failed!${NC}"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function for custom export options
custom_export() {
    echo -e "${CYAN}🔧 Custom Export Configuration${NC}"
    echo "=================================================="
    echo ""
    
    # Get output filename
    read -p "Output filename: " output
    if [[ -z "$output" ]]; then
        output="cv22_custom_export.csv"
    fi
    
    # Get format
    echo ""
    echo "Export format:"
    echo "1) CSV"
    echo "2) JSON"
    read -p "Choose format (1-2, default: 1): " format_choice
    case $format_choice in
        2) format="json" ;;
        *) format="csv" ;;
    esac
    
    # Get CV22 format
    echo ""
    echo "CV22 schema:"
    echo "1) Standard CV22 fields"
    echo "2) Extended with metadata"
    read -p "Choose schema (1-2, default: 1): " schema_choice
    case $schema_choice in
        2) cv22_format="extended" ;;
        *) cv22_format="cv22" ;;
    esac
    
    # Get quality filter
    echo ""
    echo "Quality filter:"
    echo "1) No filter (all data)"
    echo "2) High quality only"
    echo "3) Medium quality and above"
    echo "4) Validated content only"
    read -p "Choose quality filter (1-4, default: 1): " quality_choice
    case $quality_choice in
        2) quality_filter="high" ;;
        3) quality_filter="medium" ;;
        4) quality_filter="validated" ;;
        *) quality_filter="" ;;
    esac
    
    run_export "$output" "$format" "$cv22_format" "$quality_filter"
}

# Function to run all examples
run_all_examples() {
    echo -e "${CYAN}🚀 Running All Export Examples${NC}"
    echo "=================================================="
    echo ""
    
    # Standard export
    echo -e "${BLUE}📦 1/4: Standard CV22 Export${NC}"
    run_export "cv22_standard_export.csv" "csv" "cv22" ""
    
    # High quality export
    echo -e "${BLUE}📦 2/4: High Quality Export${NC}"
    run_export "cv22_high_quality.csv" "csv" "cv22" "high"
    
    # Extended format export
    echo -e "${BLUE}📦 3/4: Extended Format Export${NC}"
    run_export "cv22_extended_export.csv" "csv" "extended" ""
    
    # JSON export
    echo -e "${BLUE}📦 4/4: JSON Export${NC}"
    run_export "cv22_export.json" "json" "cv22" "medium"
    
    echo -e "${GREEN}🎉 All exports completed!${NC}"
    echo ""
    echo "Output files:"
    echo "- cv22_standard_export.csv (Standard CV22 format)"
    echo "- cv22_high_quality.csv (High quality only)"
    echo "- cv22_extended_export.csv (With metadata)"
    echo "- cv22_export.json (JSON format)"
    echo ""
    read -p "Press Enter to continue..."
}

# Main TUI loop
main() {
    clear
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              CV22 Export Tool                    ║${NC}"
    echo -e "${GREEN}║          Interactive Terminal Interface          ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Setup UV environment
    setup_uv_env
    
    # Get database URL
    while ! get_database_url; do
        echo ""
        echo -e "${YELLOW}Please try again...${NC}"
        echo ""
    done
    
    # Main menu loop
    while true; do
        clear
        echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║              CV22 Export Tool                    ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${GREEN}🔗 Database: Connected${NC}"
        echo ""
        
        show_export_menu
        read -p "Choose an option (0-8): " choice
        
        case $choice in
            1)
                filename=$(get_output_filename "cv22_standard_export.csv")
                run_export "$filename" "csv" "cv22" ""
                ;;
            2)
                filename=$(get_output_filename "cv22_high_quality.csv")
                run_export "$filename" "csv" "cv22" "high"
                ;;
            3)
                filename=$(get_output_filename "cv22_medium_quality.csv")
                run_export "$filename" "csv" "cv22" "medium"
                ;;
            4)
                filename=$(get_output_filename "cv22_validated.csv")
                run_export "$filename" "csv" "cv22" "validated"
                ;;
            5)
                filename=$(get_output_filename "cv22_extended.csv")
                run_export "$filename" "csv" "extended" ""
                ;;
            6)
                filename=$(get_output_filename "cv22_export.json")
                run_export "$filename" "json" "cv22" ""
                ;;
            7)
                custom_export
                ;;
            8)
                run_all_examples
                ;;
            0)
                echo -e "${GREEN}👋 Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid option. Please choose 0-8.${NC}"
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Run the main function
main