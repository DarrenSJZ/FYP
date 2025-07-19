#!/usr/bin/env python3
"""
Upload CV22 audio files to Supabase Storage and update database paths
"""

import os
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
import argparse

load_dotenv()

def upload_cv22_audio_files(dataset_path, limit=10):
    """
    Upload CV22 audio files to Supabase Storage validated-clips bucket
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables required")
        return False
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get clips that need audio files
    clips_response = supabase.table("cv22_clips").select("id, path, sentence").limit(limit).execute()
    clips = clips_response.data
    
    print(f"Found {len(clips)} clips to process")
    
    for clip in clips:
        original_path = clip['path']
        
        # Find the actual audio file in CV22 dataset
        # CV22 structure: cv-corpus-22.0-2024-12-11/en/clips/filename.mp3
        for lang_dir in Path(dataset_path).iterdir():
            if lang_dir.is_dir():
                clips_dir = lang_dir / "clips"
                if clips_dir.exists():
                    # Extract filename from path
                    filename = Path(original_path).name
                    audio_file = clips_dir / filename
                    
                    if audio_file.exists():
                        print(f"Uploading {filename}...")
                        
                        # Upload to Supabase Storage
                        with open(audio_file, 'rb') as f:
                            storage_path = f"practice/{filename}"
                            upload_response = supabase.storage.from_("validated-clips").upload(
                                storage_path, f, {"content-type": "audio/mp3"}
                            )
                            
                            if upload_response:
                                # Get public URL
                                public_url = supabase.storage.from_("validated-clips").get_public_url(storage_path)
                                
                                # Update database with new URL
                                update_response = supabase.table("cv22_clips").update({
                                    "path": public_url
                                }).eq("id", clip['id']).execute()
                                
                                print(f"✅ Updated {filename}")
                            else:
                                print(f"❌ Failed to upload {filename}")
                        break
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Upload CV22 audio to Supabase Storage')
    parser.add_argument('--dataset-path', required=True, help='Path to CV22 dataset directory')
    parser.add_argument('--limit', type=int, default=10, help='Number of files to upload')
    
    args = parser.parse_args()
    upload_cv22_audio_files(args.dataset_path, args.limit)