#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import argparse
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional
import time

class ASRModelRunner:
    def __init__(self, audio_file: str, output_file: str, parallel: bool = False, diagnostic: bool = True):
        self.audio_file = audio_file
        self.output_file = output_file
        self.parallel = parallel
        self.diagnostic = diagnostic
        # Always resolve from project root, regardless of where this script is run from
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.script_dir = os.path.join(project_root, 'backend', 'src', 'asr_models')
        
        # Define model configurations - start with simpler models
        self.models = {
            "vosk": {
                "script": "run_vosk.sh",
                "args": [],
                "timeout": 60
            },
            "wav2vec": {
                "script": "run_wav2vec.sh",
                "args": [],
                "timeout": 60
            },
            "whisper": {
                "script": "run_whisper.sh",
                "args": ["medium"],  # Medium model - good balance of speed/accuracy
                "timeout": 120
            },
            "moonshine": {
                "script": "run_moonshine.sh",
                "args": [],
                "timeout": 60
            },
            "mesolitica": {
                "script": "run_mesolitica.sh",
                "args": [],
                "timeout": 60
            },
            # Skip allosaurus for now as it often hangs during setup
            # "allosaurus": {
            #     "script": "run_allosaurus.sh",
            #     "args": ["eng"],  # Using English by default
            #     "timeout": 180
            # }
        }

    @staticmethod
    def clean_transcription(text: str, model_name: str) -> str:
        """Clean up transcription output by removing setup messages and keeping only the actual transcription"""
        # Split by newlines and get non-empty lines
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if not lines:
            return text

        # Model-specific cleaning patterns
        patterns = {
            "vosk": [
                "Loading Vosk model:",
                "✅ Vosk model loaded successfully.",
                "Loading and processing audio...",
                "Running speech recognition..."
            ],
            "wav2vec": [
                "Loading Wav2Vec 2.0 model:",
                "Using device:",
                "Loading and processing audio..."
            ],
            "whisper": [
                "Loading Whisper model:",
                "Using device:",
                "Loading and processing audio..."
            ],
            "moonshine": [
                "Loading Moonshine model:",
                "Using device:",
                "Loading and processing audio..."
            ],
            "mesolitica": [
                "Loading Mesolitica Wav2Vec2 model:",
                "Using device:",
                "Loading and processing audio..."
            ],
            "allosaurus": [
                "SCRIPT_DIR:",
                "PROJECT_ROOT:",
                "Checking if Python",
                "Python",
                "Virtual environment",
                "Activated Python",
                "Checking if Allosaurus",
                "Core Allosaurus",
                "Allosaurus will download",
                "Environment setup",
                "-----------------------------------------------------",
                "Using Allosaurus language ID:",
                "Successfully loaded Allosaurus model"
            ]
        }

        # Get the patterns for this model
        model_patterns = patterns.get(model_name, [])
        
        # Filter out lines that match any of the patterns
        filtered_lines = []
        for line in lines:
            if not any(pattern in line for pattern in model_patterns):
                filtered_lines.append(line)

        # Return the last non-empty line if we have filtered lines
        if filtered_lines:
            return filtered_lines[-1]
        
        # If no filtered lines, return the last line
        return lines[-1]

    def run_model(self, model_name: str) -> Dict:
        """Run a single ASR model and return its results"""
        model_config = self.models[model_name]
        script_path = os.path.join(self.script_dir, model_name, model_config["script"])
        
        if not os.path.exists(script_path):
            return {
                "model": model_name,
                "status": "error",
                "error": f"Script not found: {script_path}"
            }

        try:
            # Construct command with model-specific arguments and audio file
            cmd = [script_path] + model_config["args"] + [self.audio_file]
            timeout = model_config.get("timeout", 60)
            
            if self.diagnostic:
                print(f"Running {model_name}...")
            
            # Run the model with timeout
            start_time = time.time()
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=timeout
            )
            end_time = time.time()
            
            # Clean up the transcription
            cleaned_transcription = self.clean_transcription(result.stdout.strip(), model_name)
            
            # Base result structure
            base_result = {
                "model": model_name,
                "status": "success",
                "transcription": cleaned_transcription
            }
            
            # Add diagnostic information if in diagnostic mode
            if self.diagnostic:
                base_result.update({
                    "processing_time": end_time - start_time,
                    "command": " ".join(cmd),
                    "stderr": result.stderr.strip()
                })
            
            return base_result
            
        except subprocess.TimeoutExpired:
            return {
                "model": model_name,
                "status": "timeout", 
                "error": f"Model timed out after {timeout} seconds",
                "processing_time": timeout,
                "command": " ".join(cmd) if self.diagnostic else None
            }
        except subprocess.CalledProcessError as e:
            error_result = {
                "model": model_name,
                "status": "error",
                "error": e.stderr if e.stderr else "Process failed with no error output"
            }
            
            # Add diagnostic information if in diagnostic mode
            if self.diagnostic:
                error_result.update({
                    "processing_time": time.time() - start_time,
                    "command": " ".join(cmd),
                    "stdout": e.stdout,
                    "returncode": e.returncode
                })
            
            return error_result
        except Exception as e:
            return {
                "model": model_name,
                "status": "error",
                "error": f"Unexpected error: {str(e)}",
                "processing_time": time.time() - start_time if 'start_time' in locals() else 0,
                "command": " ".join(cmd) if self.diagnostic else None
            }

    def run_all_models(self):
        """Run all ASR models and save results to JSON"""
        results = {}
        
        if self.parallel:
            # Run models in parallel
            with ProcessPoolExecutor() as executor:
                future_to_model = {
                    executor.submit(self.run_model, model_name): model_name 
                    for model_name in self.models.keys()
                }
                
                for future in future_to_model:
                    result = future.result()
                    results[result["model"]] = result
        else:
            # Run models sequentially
            for model_name in self.models.keys():
                results[model_name] = self.run_model(model_name)

        # Add metadata
        output = {
            "audio_file": self.audio_file,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "parallel_execution": self.parallel,
            "diagnostic_mode": self.diagnostic,
            "results": results
        }

        # Create output directory if it doesn't exist
        output_dir = os.path.dirname(self.output_file)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Save results to JSON file
        with open(self.output_file, 'w') as f:
            json.dump(output, f, indent=2)

        return output

def main():
    parser = argparse.ArgumentParser(description='Run multiple ASR models on an audio file')
    parser.add_argument('audio_file', help='Path to the audio file to transcribe')
    parser.add_argument('--output', '-o', default='results/asr_results.json',
                      help='Output JSON file path (default: results/asr_results.json)')
    parser.add_argument('--parallel', '-p', action='store_true',
                      help='Run models in parallel')
    parser.add_argument('--diagnostic', '-d', action='store_true', default=True,
                      help='Run in diagnostic mode (default: True)')
    parser.add_argument('--no-diagnostic', action='store_false', dest='diagnostic',
                      help='Run in non-diagnostic mode (only transcriptions)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.audio_file):
        print(f"Error: Audio file not found: {args.audio_file}")
        sys.exit(1)
    
    # Ensure the results directory exists
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
    if not os.path.exists(results_dir):
        os.makedirs(results_dir)
    
    # Make the output path relative to the script's directory
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.output)
    
    runner = ASRModelRunner(args.audio_file, output_path, args.parallel, args.diagnostic)
    results = runner.run_all_models()
    
    print(f"\nResults have been saved to: {output_path}")
    print("\nTranscription Results:")
    print("-" * 80)
    for model_name, result in results["results"].items():
        print(f"\n{model_name.upper()}:")
        print("-" * 40)
        if result["status"] == "success":
            print(f"Transcription: {result['transcription']}")
            if args.diagnostic:
                print(f"Processing time: {result['processing_time']:.2f} seconds")
        else:
            print(f"Error: {result['error']}")

if __name__ == "__main__":
    main() 