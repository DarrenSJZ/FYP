#!/bin/bash

# ASR Benchmark Tool - Enhanced with Docker Services Support
# Usage: ./run_asr_benchmark.sh [OPTIONS]

# Default configuration
USE_SERVICES=false
# Remove SHOW_TIMING, SELECTED_MODELS, and all settings toggles
ORCHESTRATOR_URL="http://localhost:8000"
OUTPUT_FORMAT="json"
VERBOSE=false
PLAY_AUDIO=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services)
            USE_SERVICES=true
            shift
            ;;
        --orchestrator-url)
            ORCHESTRATOR_URL="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --play-audio)
            PLAY_AUDIO=true
            shift
            ;;
        --audio-dir)
            AUDIO_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --services              Use Docker services instead of local Python models"
            echo "  --orchestrator-url URL  Orchestrator service URL (default: http://localhost:8000)"
            echo "  --audio-dir DIR         Specify custom audio directory path"
            echo "  --verbose               Show detailed output"
            echo "  --play-audio            Play audio after transcription"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Interactive TUI mode"
            echo "  $0 --audio-dir /path/to/audio         # Use custom audio directory"
            echo "  $0 --services --format clean           # Use Docker services, clean output"
            echo "  $0 --services --play-audio             # Play audio after transcription"
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

# Check if ffplay is available for audio playback
if ! command -v ffplay &> /dev/null; then
    echo "Warning: ffplay is not installed. Audio playback will be disabled."
    echo "Install with: sudo pacman -S ffmpeg (Arch) or sudo apt-get install ffmpeg (Ubuntu)"
    PLAY_AUDIO=false
fi

# Directory containing the audio files - check multiple common locations
AUDIO_DIRS=(
    "/home/laughdiemeh/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/clips"
    "$HOME/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/clips"
    "$HOME/Downloads/clips"
    "$HOME/audio_samples"
    "$(pwd)/audio_samples"
    "$(pwd)/clips"
)

AUDIO_DIR=""
for dir in "${AUDIO_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        AUDIO_DIR="$dir"
        break
    fi
done

# Check if custom audio directory was specified via command line
if [ -n "$AUDIO_DIR" ] && [ ! -d "$AUDIO_DIR" ]; then
    dialog --msgbox "Error: Specified audio directory not found at $AUDIO_DIR" 10 60
    exit 1
fi

# If no directory found and not specified via command line, search for directories
if [ -z "$AUDIO_DIR" ]; then
    for dir in "${AUDIO_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            AUDIO_DIR="$dir"
            break
        fi
    done
fi

# If still no directory found, try current directory with audio files
if [ -z "$AUDIO_DIR" ]; then
    # Try to find any audio files in current directory
    if find . -maxdepth 2 -name "*.mp3" -o -name "*.wav" -o -name "*.flac" | head -1 | grep -q .; then
        AUDIO_DIR="$(pwd)"
    else
        dialog --msgbox "Error: No audio directory found. Please place audio files in:\n- $HOME/audio_samples\n- $(pwd)/audio_samples\n- $(pwd)/clips\n\nOr use --audio-dir to specify a custom path.\nRun with --help for more options." 15 70
        exit 1
    fi
fi

# Create a temporary file for the file list
TEMP_FILE=$(mktemp)

# Function to get audio files
get_audio_files() {
    find "$AUDIO_DIR" -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.flac" \) | sort > "$TEMP_FILE"
}

# Function to show simple file selector (no directory navigation, with Back option)
show_simple_file_selector() {
    local audio_dir="$1"
    local files_list
    
    # Limit to first 50 files for performance
    files_list=$(find "$audio_dir" -maxdepth 1 -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.flac" \) | sort | head -50)
    if [ -z "$files_list" ]; then
        dialog --msgbox "No audio files found in $audio_dir" 10 60
        return 1
    fi
    
    # Count total files for user info
    local total_count=$(find "$audio_dir" -maxdepth 1 -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.flac" \) | wc -l)
    
    local menu_items="Back BACK "
    local file
    local file_map=""
    local counter=1
    
    for file in $files_list; do
        menu_items+="$counter $(basename "$file") "
        file_map+="$counter:$file "
        counter=$((counter + 1))
    done
    
    local title="Select audio file (showing first 50 of $total_count files):"
    local selected_index
    selected_index=$(dialog --menu "$title" 20 80 15 $menu_items 3>&1 1>&2 2>&3)
    if [ $? -ne 0 ] || [ -z "$selected_index" ] || [ "$selected_index" = "BACK" ]; then
        return 1
    fi
    
    # Get the full path from the file_map using the selected index
    local selected_file=""
    for mapping in $file_map; do
        if [[ "$mapping" == "$selected_index:"* ]]; then
            selected_file="${mapping#*:}"
            break
        fi
    done
    
    echo "$selected_file"
    return 0
}

# Function to show main menu
show_main_menu() {
    while true; do
        local menu_text="ASR Benchmark Tool\nAudio Directory: $AUDIO_DIR"
        local menu_height=16
        local menu_options=4

        choice=$(dialog --menu "$menu_text" $menu_height 70 $menu_options \
            1 "Run Benchmark (Local ASR Models)" \
            2 "Run Benchmark (Docker Services)" \
            3 "Results" \
            4 "Check Audio Directory" \
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
                show_results_menu
                ;;
            4)
                check_audio_directory
                ;;
            *)
                break
                ;;
        esac
    done
}

# Function to check audio directory status
check_audio_directory() {
    local dir_info="Audio Directory Information\n\n"
    dir_info+="Current Directory: $AUDIO_DIR\n"
    
    if [ -d "$AUDIO_DIR" ]; then
        dir_info+="Status: ✓ Directory exists\n\n"
        
        # Count audio files
        local mp3_count=$(find "$AUDIO_DIR" -maxdepth 1 -name "*.mp3" | wc -l)
        local wav_count=$(find "$AUDIO_DIR" -maxdepth 1 -name "*.wav" | wc -l)
        local flac_count=$(find "$AUDIO_DIR" -maxdepth 1 -name "*.flac" | wc -l)
        local total_count=$((mp3_count + wav_count + flac_count))
        
        dir_info+="Audio Files Found:\n"
        dir_info+="  MP3: $mp3_count\n"
        dir_info+="  WAV: $wav_count\n"
        dir_info+="  FLAC: $flac_count\n"
        dir_info+="  Total: $total_count\n\n"
        
        if [ $total_count -eq 0 ]; then
            dir_info+="⚠️  No audio files found!\n"
            dir_info+="Please add audio files to this directory."
        else
            dir_info+="✓ Ready for benchmarking"
        fi
    else
        dir_info+="Status: ❌ Directory does not exist\n"
        dir_info+="Please check the path or use --audio-dir option."
    fi
    
    dialog --msgbox "$dir_info" 20 70
}

# Function to play audio file
play_audio_file() {
    local audio_file="$1"
    
    if [ ! -f "$audio_file" ]; then
        dialog --msgbox "Error: Audio file not found: $audio_file" 8 50
        return 1
    fi
    
    # Check if ffplay is available
    if ! command -v ffplay &> /dev/null; then
        dialog --msgbox "Error: ffplay is not installed. Cannot play audio." 8 50
        return 1
    fi
    
    # Show audio playback dialog
    dialog --msgbox "Playing audio file: $(basename "$audio_file")\n\nPress OK to stop playback" 8 60
    
    # Play audio in background
    ffplay -nodisp -autoexit "$audio_file" > /dev/null 2>&1 &
    local ffplay_pid=$!
    
    # Wait for user to press OK (which will kill ffplay)
    dialog --msgbox "Audio playback started.\n\nPress OK to stop." 8 50
    
    # Kill ffplay if it's still running
    if kill -0 $ffplay_pid 2>/dev/null; then
        kill $ffplay_pid 2>/dev/null
    fi
}

# Function to show Docker options menu
show_docker_options_menu() {
    while true; do
        local current_format="${OUTPUT_FORMAT}"
        
        choice=$(dialog --menu "Docker Services Configuration" 20 70 8 \
            1 "Output Format ($current_format)" \
            2 "Play Audio$audio_status" \
            3 "Test Connection" \
            4 "View Service Status" \
            5 "Back to Main Menu" \
            3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                # REMOVED: OUTPUT_FORMAT selection
                ;;
            2)
                # REMOVED: PLAY_AUDIO toggle
                ;;
            3)
                test_docker_connection
                ;;
            4)
                show_service_status
                ;;
            5)
                break
                ;;
            *)
                break
                ;;
        esac
    done
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
    
    while true; do
        selected_file=$(show_simple_file_selector "$AUDIO_DIR")
        if [ $? -ne 0 ] || [ -z "$selected_file" ]; then
            return 0  # Go back to main menu
        fi
        
        # Show configuration summary
        local config_text="Configuration Summary:\n\n"
        config_text+="File: $(basename "$selected_file")\n"
        config_text+="Format: $OUTPUT_FORMAT\n"
        config_text+="Play audio: $PLAY_AUDIO"
        
        dialog --yesno "$config_text\n\nProceed with benchmark?" 12 60
        if [ $? -ne 0 ]; then
            continue  # Go back to file selector
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
        
        # Play audio if enabled
        if [ "$PLAY_AUDIO" = true ]; then
            dialog --yesno "Transcription completed!\n\nWould you like to play the audio file?" 10 60
            if [ $? -eq 0 ]; then
                play_audio_file "$selected_file"
            fi
        fi

        # Show results in a text box
        dialog --textbox "$result_file" 20 80
        
        dialog --msgbox "Benchmark completed!\nResults saved to $result_file" 8 50
        return 0
    done
}

# Function to run Docker services benchmark
run_services_benchmark() {
    local audio_file="$1"
    local start_time=$(date +%s.%N)
    
    if [ "$VERBOSE" = true ]; then
        echo "Processing file: $(basename "$audio_file")"
        echo "Using orchestrator at: $ORCHESTRATOR_URL"
    fi
    
    # Build curl command
    local curl_cmd="curl -s -X POST -F \"file=@$audio_file\""
    
    curl_cmd="$curl_cmd $ORCHESTRATOR_URL/transcribe-consensus"
    
    # Execute request
    local response=$(eval "$curl_cmd")
    local curl_status=$?

    # Debug: print the raw response
    echo "DEBUG: Raw response from orchestrator:" >&2
    echo "$response" >&2
    
    if [ $curl_status -ne 0 ]; then
        echo "Error: Failed to connect to orchestrator service"
        return 1
    fi
    
    # Check if response is null or empty
    if [ -z "$response" ] || [ "$response" = "null" ]; then
        echo "Error: Received null or empty response from orchestrator service"
        echo "Response: $response"
        return 1
    fi
    
    # Check if response is valid JSON
    if ! echo "$response" | jq empty 2>/dev/null; then
        echo "Error: Invalid JSON response from orchestrator service"
        echo "Response: $response"
        return 1
    fi
    
    local end_time=$(date +%s.%N)
    # Use awk instead of bc for floating point arithmetic
    local total_time=$(awk "BEGIN {printf \"%.3f\", $end_time - $start_time}")
    
    # Process output based on format
    echo "$response" | jq '.' 2>/dev/null || echo "Error: Could not parse response"

    # Play audio if enabled (for non-interactive mode) - DISABLED to avoid double playback
    # if [ "$PLAY_AUDIO" = true ] && [ "$USE_SERVICES" = true ]; then
    #     echo ""
    #     echo "Transcription completed! Playing audio..."
    #     ffplay -nodisp -autoexit "$audio_file" > /dev/null 2>&1
    # fi

    echo ""
    echo "Timing: Total=${total_time}s"
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
    
    while true; do
        # Check audio directory status
        if [ ! -d "$AUDIO_DIR" ]; then
            dialog --msgbox "Error: Audio directory not accessible: $AUDIO_DIR" 10 60
            return 0
        fi
        
        # Count audio files before showing selector
        local file_count=$(find "$AUDIO_DIR" -maxdepth 1 -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.flac" \) | wc -l)
        
        if [ "$file_count" -eq 0 ]; then
            dialog --msgbox "No audio files found in:\n$AUDIO_DIR\n\nPlease add some .mp3, .wav, or .flac files to this directory, or use --audio-dir to specify a different path." 12 70
            return 0
        fi
        
        selected_file=$(show_simple_file_selector "$AUDIO_DIR")
        if [ $? -ne 0 ] || [ -z "$selected_file" ]; then
            return 0  # Go back to main menu
        fi
        
        # Confirm selection
        dialog --yesno "Process file: $(basename "$selected_file")?" 10 60
        if [ $? -ne 0 ]; then
            continue  # Go back to file selector
        fi
        
        # Create results directory if it doesn't exist
        mkdir -p results
        
        # Get timestamp for unique result file
        timestamp=$(date +%Y%m%d_%H%M%S)
        result_file="results/asr_results_${timestamp}.json"
        
        # Check if ASR models directory exists before running
        # Get the absolute path of the script directory
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        project_root="$(dirname "$script_dir")"
        asr_models_dir="$project_root/backend/src/asr_models"
        
        if [ ! -d "$asr_models_dir" ]; then
            dialog --msgbox "ERROR: ASR models directory not found at:\n$asr_models_dir\n\nPlease check your installation." 12 60
            continue
        fi
        
        # Check if Python script exists
        python_script="$script_dir/run_asr_models.py"
        if [ ! -f "$python_script" ]; then
            dialog --msgbox "ERROR: Python script not found at:\n$python_script" 12 60
            continue
        fi
        
        # Run ASR models with progress dialog
        (
            echo "10"
            echo "Initializing ASR models..."
            sleep 1
            echo "20"
            echo "Starting model execution..."
            
            # Run the Python script in parallel mode
            python3 "$python_script" "$selected_file" --output "$result_file" --parallel > /tmp/asr_output.log 2>&1 &
            python_pid=$!
            
            # Progress updates while Python script runs
            progress=30
            while kill -0 $python_pid 2>/dev/null; do
                echo "$progress"
                echo "Running 5 ASR models in parallel (30-60 seconds)..."
                sleep 3
                progress=$((progress + 5))
                if [ $progress -gt 90 ]; then
                    progress=90
                fi
            done
            
            # Wait for completion
            wait $python_pid
            exit_code=$?
            
            echo "95"
            echo "Finalizing results..."
            sleep 1
            echo "100"
            echo "Complete!"
            
        ) | dialog --gauge "Processing ASR Models..." 10 60 0
        
        if [ -f "$result_file" ]; then
            dialog --msgbox "Benchmarking completed successfully!\n\nResults saved to: $result_file" 10 60
            
            # Show results summary
            dialog --yesno "Would you like to view the detailed results?" 8 50
            if [ $? -eq 0 ]; then
                dialog --textbox "$result_file" 20 80
            fi
        else
            dialog --msgbox "ERROR: Benchmarking failed!\n\nCheck /tmp/asr_output.log for details." 10 60
            
            # Offer to show error log
            if [ -f "/tmp/asr_output.log" ]; then
                dialog --yesno "Would you like to view the error log?" 8 50
                if [ $? -eq 0 ]; then
                    dialog --textbox "/tmp/asr_output.log" 20 80
                fi
            fi
        fi
        return 0
    done
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

# Function to show results menu
show_results_menu() {
    while true; do
        local choice=$(dialog --menu "Results Menu" 15 60 3 \
            1 "View Results" \
            2 "Clear Results" \
            3 "Back" \
            3>&1 1>&2 2>&3)
        case $choice in
            1)
                view_results
                ;;
            2)
                clear_results
                ;;
            3)
                break
                ;;
            *)
                break
                ;;
        esac
    done
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