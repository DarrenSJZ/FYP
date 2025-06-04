#!/bin/bash

# Check if dialog is installed
if ! command -v dialog &> /dev/null; then
    echo "Error: dialog is not installed. Please install it first."
    echo "On Arch Linux: sudo pacman -S dialog"
    echo "On Ubuntu/Debian: sudo apt-get install dialog"
    exit 1
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
        choice=$(dialog --menu "ASR Benchmark Tool" 15 60 4 \
            1 "Select and Run Benchmark" \
            2 "View Previous Results" \
            3 "Clear Results" \
            4 "Exit" \
            3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                run_benchmark
                ;;
            2)
                view_results
                ;;
            3)
                clear_results
                ;;
            4)
                break
                ;;
            *)
                break
                ;;
        esac
    done
}

# Function to run benchmark
run_benchmark() {
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

# Show main menu
show_main_menu 