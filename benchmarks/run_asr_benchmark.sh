#!/bin/bash

# ASR Benchmark Tool - Enhanced with Docker Services Support
# Usage: ./run_asr_benchmark.sh [OPTIONS]

# Default configuration
USE_SERVICES=false
CLEAN_OUTPUT=false
SHOW_TIMING=false
SELECTED_MODELS=""
ORCHESTRATOR_URL="http://localhost:8000"
OUTPUT_FORMAT="json"
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services)
            USE_SERVICES=true
            shift
            ;;
        --clean)
            CLEAN_OUTPUT=true
            shift
            ;;
        --time)
            SHOW_TIMING=true
            shift
            ;;
        --models)
            SELECTED_MODELS="$2"
            shift 2
            ;;
        --orchestrator-url)
            ORCHESTRATOR_URL="$2"
            shift 2
            ;;
        --format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --services              Use Docker services instead of local Python models"
            echo "  --clean                 Clean output (transcriptions only)"
            echo "  --time                  Show processing times"
            echo "  --models MODEL_LIST     Comma-separated list of models to use"
            echo "                          Available: whisper,wav2vec,moonshine,mesolitica,vosk,allosaurus"
            echo "  --orchestrator-url URL  Orchestrator service URL (default: http://localhost:8000)"
            echo "  --format FORMAT         Output format: json, table, clean (default: json)"
            echo "  --verbose               Show detailed output"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Interactive TUI mode"
            echo "  $0 --services --clean                # Use Docker services, clean output"
            echo "  $0 --services --models whisper,vosk  # Only test whisper and vosk"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check dependencies based on mode
if [ "$USE_SERVICES" = true ]; then
    # Check if Docker services are available
    if ! command -v curl &> /dev/null; then
        echo "Error: curl is required for Docker services mode"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "Error: jq is required for Docker services mode"
        echo "Install with: sudo pacman -S jq (Arch) or sudo apt-get install jq (Ubuntu)"
        exit 1
    fi
    
    # Check if orchestrator is running
    if ! curl -s "$ORCHESTRATOR_URL/health" > /dev/null 2>&1; then
        echo "Error: Orchestrator service not available at $ORCHESTRATOR_URL"
        echo "Start with: docker-compose up orchestrator -d"
        exit 1
    fi
else
    # Check if dialog is installed for TUI mode
    if ! command -v dialog &> /dev/null; then
        echo "Error: dialog is not installed. Please install it first."
        echo "On Arch Linux: sudo pacman -S dialog"
        echo "On Ubuntu/Debian: sudo apt-get install dialog"
        exit 1
    fi
fi

# Directory containing the audio files
AUDIO_DIR="/home/laughdiemeh/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/clips"

# Check if directory exists
if [ ! -d "$AUDIO_DIR" ]; then
    dialog --msgbox "Error: Audio directory not found at $AUDIO_DIR" 10 60
    exit 1
fi

# Create a temporary file for the file list
TEMP_FILE=$(mktemp)

# Function to get audio files
get_audio_files() {
    find "$AUDIO_DIR" -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.flac" \) | sort > "$TEMP_FILE"
}

# Function to show file selector
show_file_selector() {
    local current_dir="$1"
    local selected_file=""
    
    while true; do
        # Create a temporary file for the menu items
        local menu_file=$(mktemp)
        
        # Add parent directory option if not in root
        if [ "$current_dir" != "$AUDIO_DIR" ]; then
            echo ".. \"Go to parent directory\"" >> "$menu_file"
        fi
        
        # Add directories and files
        while IFS= read -r item; do
            if [ -d "$current_dir/$item" ]; then
                echo "$item \"Directory\"" >> "$menu_file"
            elif [[ "$item" =~ \.(mp3|wav|flac)$ ]]; then
                echo "$item \"Audio file\"" >> "$menu_file"
            fi
        done < <(ls -1 "$current_dir" | sort)
        
        # Show file selection dialog
        selected_file=$(dialog --title "File Selector - $current_dir" \
                              --menu "Select a file or directory:" \
                              20 80 15 \
                              --file "$menu_file" \
                              3>&1 1>&2 2>&3)
        
        # Clean up menu file
        rm -f "$menu_file"
        
        # Handle selection
        if [ $? -ne 0 ]; then
            return 1
        fi
        
        if [ "$selected_file" = ".." ]; then
            current_dir=$(dirname "$current_dir")
        elif [ -d "$current_dir/$selected_file" ]; then
            current_dir="$current_dir/$selected_file"
        else
            echo "$current_dir/$selected_file"
            return 0
        fi
    done
}

# Function to show main menu
show_main_menu() {
    while true; do
        local menu_text="ASR Benchmark Tool"
        local menu_height=18
        local menu_options=6
        
        # Check Docker services status
        local docker_status=""
        if curl -s "$ORCHESTRATOR_URL/health" > /dev/null 2>&1; then
            docker_status=" (✓ Docker services available)"
        else
            docker_status=" (✗ Docker services unavailable)"
        fi
        
        choice=$(dialog --menu "$menu_text$docker_status" $menu_height 70 $menu_options \
            1 "Run Benchmark (Local Python Models)" \
            2 "Run Benchmark (Docker Services)" \
            3 "Docker Services Options" \
            4 "View Previous Results" \
            5 "Clear Results" \
            6 "Exit" \
            3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                USE_SERVICES=false
                run_benchmark
                ;;
            2)
                USE_SERVICES=true
                run_docker_benchmark_tui
                ;;
            3)
                show_docker_options_menu
                ;;
            4)
                view_results
                ;;
            5)
                clear_results
                ;;
            6)
                break
                ;;
            *)
                break
                ;;
        esac
    done
}

# Function to show Docker options menu
show_docker_options_menu() {
    while true; do
        local current_models="${SELECTED_MODELS:-all models}"
        local current_format="${OUTPUT_FORMAT}"
        local timing_status=""
        local clean_status=""
        
        if [ "$SHOW_TIMING" = true ]; then
            timing_status=" (enabled)"
        else
            timing_status=" (disabled)"
        fi
        
        if [ "$CLEAN_OUTPUT" = true ]; then
            clean_status=" (enabled)"
        else
            clean_status=" (disabled)"
        fi
        
        choice=$(dialog --menu "Docker Services Configuration" 18 70 7 \
            1 "Select Models ($current_models)" \
            2 "Output Format ($current_format)" \
            3 "Show Timing$timing_status" \
            4 "Clean Output$clean_status" \
            5 "Test Connection" \
            6 "View Service Status" \
            7 "Back to Main Menu" \
            3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                select_models_tui
                ;;
            2)
                select_output_format_tui
                ;;
            3)
                if [ "$SHOW_TIMING" = true ]; then
                    SHOW_TIMING=false
                else
                    SHOW_TIMING=true
                fi
                ;;
            4)
                if [ "$CLEAN_OUTPUT" = true ]; then
                    CLEAN_OUTPUT=false
                else
                    CLEAN_OUTPUT=true
                fi
                ;;
            5)
                test_docker_connection
                ;;
            6)
                show_service_status
                ;;
            7)
                break
                ;;
            *)
                break
                ;;
        esac
    done
}

# Function to select models in TUI
select_models_tui() {
    local selected=$(dialog --checklist "Select ASR Models to Use:" 15 60 6 \
        "whisper" "OpenAI Whisper" on \
        "wav2vec" "Facebook Wav2Vec" on \
        "moonshine" "Useful Sensors Moonshine" on \
        "mesolitica" "Malaysian Mesolitica" on \
        "vosk" "Offline Vosk" on \
        "allosaurus" "Universal Allosaurus" on \
        3>&1 1>&2 2>&3)
    
    if [ $? -eq 0 ]; then
        # Convert dialog output to comma-separated list
        SELECTED_MODELS=$(echo "$selected" | tr ' ' ',' | sed 's/"//g')
        if [ -z "$SELECTED_MODELS" ]; then
            SELECTED_MODELS=""
            dialog --msgbox "All models deselected - will use all available models" 8 50
        fi
    fi
}

# Function to select output format in TUI
select_output_format_tui() {
    local format=$(dialog --menu "Select Output Format:" 12 50 3 \
        "clean" "Clean transcriptions only" \
        "table" "Formatted table output" \
        "json" "Full JSON response" \
        3>&1 1>&2 2>&3)
    
    if [ $? -eq 0 ]; then
        OUTPUT_FORMAT="$format"
    fi
}

# Function to test Docker connection
test_docker_connection() {
    local temp_file=$(mktemp)
    
    (
        echo "10"
        echo "Testing orchestrator connection..."
        if curl -s "$ORCHESTRATOR_URL/health" > "$temp_file" 2>&1; then
            echo "50"
            echo "Connection successful, checking services..."
            local health_data=$(cat "$temp_file")
            echo "100"
            echo "All checks complete"
        else
            echo "100"
            echo "Connection failed"
        fi
    ) | dialog --gauge "Testing Docker Services..." 8 50 0
    
    if curl -s "$ORCHESTRATOR_URL/health" > /dev/null 2>&1; then
        local healthy_count=$(curl -s "$ORCHESTRATOR_URL/health" | jq -r '.healthy_services | length' 2>/dev/null || echo "unknown")
        dialog --msgbox "Connection successful!\nHealthy services: $healthy_count" 8 40
    else
        dialog --msgbox "Connection failed!\nCheck if Docker services are running:\ndocker-compose up orchestrator -d" 10 50
    fi
    
    rm -f "$temp_file"
}

# Function to show service status
show_service_status() {
    local temp_file=$(mktemp)
    
    if curl -s "$ORCHESTRATOR_URL/health" > "$temp_file" 2>&1; then
        local status_text="Docker Services Status\n\n"
        status_text+="Orchestrator: ✓ Running\n"
        status_text+="URL: $ORCHESTRATOR_URL\n\n"
        
        # Parse service status
        local services=$(cat "$temp_file" | jq -r '.service_health | to_entries[] | "\(.key): \(.value.status)"' 2>/dev/null)
        if [ -n "$services" ]; then
            status_text+="Individual Services:\n$services"
        else
            status_text+="Service details unavailable"
        fi
        
        dialog --msgbox "$status_text" 15 60
    else
        dialog --msgbox "Cannot connect to orchestrator!\nError: $(cat "$temp_file")" 10 50
    fi
    
    rm -f "$temp_file"
}

# Function to run Docker benchmark with TUI
run_docker_benchmark_tui() {
    # Check if Docker services are available
    if ! curl -s "$ORCHESTRATOR_URL/health" > /dev/null 2>&1; then
        dialog --msgbox "Docker services are not available!\n\nPlease start them with:\ndocker-compose up orchestrator -d" 10 60
        return
    fi
    
    # Show file selector
    selected_file=$(show_file_selector "$AUDIO_DIR")
    
    if [ $? -ne 0 ] || [ -z "$selected_file" ]; then
        return
    fi
    
    # Show configuration summary
    local config_text="Configuration Summary:\n\n"
    config_text+="File: $(basename "$selected_file")\n"
    config_text+="Models: ${SELECTED_MODELS:-all available}\n"
    config_text+="Format: $OUTPUT_FORMAT\n"
    config_text+="Timing: $SHOW_TIMING\n"
    config_text+="Clean output: $CLEAN_OUTPUT"
    
    dialog --yesno "$config_text\n\nProceed with benchmark?" 12 60
    if [ $? -ne 0 ]; then
        return
    fi
    
    # Create results directory if it doesn't exist
    mkdir -p results
    
    # Get timestamp for unique result file
    timestamp=$(date +%Y%m%d_%H%M%S)
    result_file="results/docker_asr_results_${timestamp}.txt"
    
    # Process file with progress bar
    (
        echo "0"
        echo "Connecting to Docker services..."
        echo "XXX"
        echo "25"
        echo "Sending audio file..."
        echo "XXX"
        echo "50"
        echo "Processing with ASR models..."
        echo "XXX"
        
        # Run the actual benchmark
        run_services_benchmark "$selected_file" > "$result_file" 2>&1
        
        echo "100"
        echo "Completed!"
    ) | dialog --gauge "Running Docker Benchmark..." 10 60 0
    
    # Show results in a text box
    dialog --textbox "$result_file" 20 80
    
    dialog --msgbox "Benchmark completed!\nResults saved to $result_file" 8 50
}

# Function to run Docker services benchmark
run_services_benchmark() {
    local audio_file="$1"
    local start_time=$(date +%s.%N)
    
    if [ "$VERBOSE" = true ]; then
        echo "Processing file: $(basename "$audio_file")"
        echo "Using orchestrator at: $ORCHESTRATOR_URL"
        if [ -n "$SELECTED_MODELS" ]; then
            echo "Selected models: $SELECTED_MODELS"
        fi
    fi
    
    # Build curl command
    local curl_cmd="curl -s -X POST -F \"file=@$audio_file\""
    
    if [ -n "$SELECTED_MODELS" ]; then
        curl_cmd="$curl_cmd -F \"models=$SELECTED_MODELS\""
    fi
    
    curl_cmd="$curl_cmd $ORCHESTRATOR_URL/transcribe"
    
    # Execute request
    local response=$(eval "$curl_cmd")
    local curl_status=$?
    
    if [ $curl_status -ne 0 ]; then
        echo "Error: Failed to connect to orchestrator service"
        return 1
    fi
    
    local end_time=$(date +%s.%N)
    local total_time=$(echo "$end_time - $start_time" | bc -l)
    
    # Process output based on format
    case "$OUTPUT_FORMAT" in
        "clean")
            echo "$response" | jq -r '.results | to_entries[] | "\(.key): \(.value.transcription)"'
            ;;
        "table")
            echo "File: $(basename "$audio_file")"
            if [ "$SHOW_TIMING" = true ]; then
                local service_time=$(echo "$response" | jq -r '.total_processing_time')
                echo "Total processing time: ${service_time}s (request time: ${total_time}s)"
            fi
            echo ""
            echo "$response" | jq -r '.results | to_entries[] | "\(.key | ascii_upcase | .[0:12]): \(.value.transcription)"'
            ;;
        "json")
            if [ "$CLEAN_OUTPUT" = true ]; then
                # Clean JSON with just essential info
                echo "$response" | jq '{
                    filename: .audio_filename,
                    processing_time: .total_processing_time,
                    successful_models: .successful_models,
                    transcriptions: (.results | to_entries | map({
                        model: .key,
                        transcription: .value.transcription,
                        time: .value.service_processing_time
                    }))
                }'
            else
                echo "$response" | jq '.'
            fi
            ;;
    esac
    
    if [ "$SHOW_TIMING" = true ] && [ "$OUTPUT_FORMAT" != "table" ]; then
        local service_time=$(echo "$response" | jq -r '.total_processing_time')
        echo ""
        echo "Timing: Service=${service_time}s, Total=${total_time}s"
    fi
}

# Function to run benchmark (enhanced for both modes)
run_benchmark() {
    if [ "$USE_SERVICES" = true ]; then
        # Non-interactive mode for services
        if [ $# -eq 0 ]; then
            echo "Error: Audio file required in services mode"
            echo "Usage: $0 --services [audio_file]"
            return 1
        fi
        
        local audio_file="$1"
        if [ ! -f "$audio_file" ]; then
            echo "Error: Audio file not found: $audio_file"
            return 1
        fi
        
        run_services_benchmark "$audio_file"
        return
    fi
    
    # Original TUI mode
    # Show file selector
    selected_file=$(show_file_selector "$AUDIO_DIR")
    
    if [ $? -ne 0 ] || [ -z "$selected_file" ]; then
        return
    fi
    
    # Confirm selection
    dialog --yesno "Process file: $(basename "$selected_file")?" 10 60
    if [ $? -ne 0 ]; then
        return
    fi
    
    # Create results directory if it doesn't exist
    mkdir -p results
    
    # Get timestamp for unique result file
    timestamp=$(date +%Y%m%d_%H%M%S)
    result_file="results/asr_results_${timestamp}.json"
    
    # Process file with progress bar
    (
        echo "0"
        echo "Processing file..."
        echo "XXX"
        echo "0"
        echo "Starting ASR models..."
        echo "XXX"
        python3 "$(dirname "$0")/asr_model_comparison.py" "$selected_file" --output "$result_file" --parallel
        echo "100"
        echo "Done!"
    ) | dialog --gauge "Processing file..." 10 60 0
    
    dialog --msgbox "Benchmark completed! Results saved to $result_file" 10 60
}

# Function to view results
view_results() {
    if [ ! -d "results" ] || [ -z "$(ls -A results)" ]; then
        dialog --msgbox "No results found!" 10 40
        return
    fi
    
    # Create a list of result files
    result_files=$(find results -name "asr_results_*.json" -printf "%f\n" | sort -r)
    
    if [ -z "$result_files" ]; then
        dialog --msgbox "No result files found!" 10 40
        return
    fi
    
    # Show result file selection
    selected_file=$(dialog --menu "Select result file to view:" 20 60 10 \
        $(echo "$result_files" | awk '{print $0 " " $0}') \
        3>&1 1>&2 2>&3)
    
    if [ $? -eq 0 ]; then
        # Show results in a scrollable text box
        dialog --textbox "results/$selected_file" 20 80
    fi
}

# Function to clear results
clear_results() {
    if [ -d "results" ] && [ -n "$(ls -A results)" ]; then
        dialog --yesno "Are you sure you want to clear all results?" 10 40
        if [ $? -eq 0 ]; then
            rm -f results/asr_results_*.json
            dialog --msgbox "Results cleared!" 10 40
        fi
    else
        dialog --msgbox "No results to clear!" 10 40
    fi
}

# Clean up function
cleanup() {
    rm -f "$TEMP_FILE"
}

# Set up cleanup on script exit
trap cleanup EXIT

# Main execution logic
main() {
    # Handle services mode with command line audio file
    if [ "$USE_SERVICES" = true ]; then
        # Check if audio file provided as argument
        if [ $# -gt 0 ]; then
            local audio_file="$1"
            if [ ! -f "$audio_file" ]; then
                echo "Error: Audio file not found: $audio_file"
                exit 1
            fi
            run_services_benchmark "$audio_file"
        else
            echo "Error: Audio file required in services mode"
            echo "Usage: $0 --services [audio_file]"
            echo "Example: $0 --services /path/to/audio.mp3"
            exit 1
        fi
    else
        # Original TUI mode
        show_main_menu
    fi
}

# Handle remaining arguments (audio file for services mode)
main "$@" 