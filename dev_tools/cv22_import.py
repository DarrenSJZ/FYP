#!/usr/bin/env python3
"""
Common Voice 22 Dataset Import Script
Extracts first 100 validated clips and imports to Supabase cv22_clips table
"""

import os
import pandas as pd
import psycopg2
from supabase import create_client, Client
from dotenv import load_dotenv
import argparse
from pathlib import Path

# Load environment variables
load_dotenv()

def find_cv22_dataset(base_path=None):
    """
    Find Common Voice 22 dataset directory
    Looks in common locations for CV22 downloads
    """
    common_paths = [
        base_path,
        "./common_voice_22",
        "../common_voice_22", 
        "~/Downloads/common_voice_22",
        "~/datasets/common_voice_22",
        "/data/common_voice_22",
        "./cv-corpus-22.0-2024-12-11"
    ]
    
    for path in common_paths:
        if path and Path(path).exists():
            # Look for validated.tsv files in language subdirectories
            for lang_dir in Path(path).iterdir():
                if lang_dir.is_dir():
                    validated_file = lang_dir / "validated.tsv"
                    if validated_file.exists():
                        print(f"Found CV22 dataset: {path}")
                        return Path(path)
    
    return None

def analyze_cv22_structure(dataset_path):
    """
    Analyze CV22 directory structure and find the best validated.tsv file
    Returns the file with the most complete header coverage
    """
    best_file = None
    best_score = 0
    analysis = []
    
    # Expected CV22 headers based on Common Voice schema
    expected_headers = {
        'client_id', 'path', 'sentence', 'up_votes', 'down_votes', 
        'age', 'gender', 'accents', 'locale', 'segment', 'sentence_id'
    }
    
    print("Analyzing CV22 directory structure...")
    
    for lang_dir in dataset_path.iterdir():
        if not lang_dir.is_dir():
            continue
            
        validated_file = lang_dir / "validated.tsv"
        if not validated_file.exists():
            continue
            
        try:
            # Read just the header to analyze structure
            df = pd.read_csv(validated_file, sep='\t', nrows=0)
            headers = set(df.columns)
            
            # Calculate coverage score
            coverage = headers.intersection(expected_headers)
            score = len(coverage)
            row_count = sum(1 for _ in open(validated_file)) - 1  # Subtract header
            
            info = {
                'language': lang_dir.name,
                'file_path': validated_file,
                'headers': headers,
                'coverage': coverage,
                'score': score,
                'row_count': row_count,
                'missing_headers': expected_headers - headers
            }
            analysis.append(info)
            
            print(f"  {lang_dir.name}: {score}/{len(expected_headers)} headers, {row_count} rows")
            
            if score > best_score and row_count >= 100:
                best_score = score
                best_file = info
                
        except Exception as e:
            print(f"  {lang_dir.name}: Error reading file - {e}")
    
    return best_file, analysis

def extract_cv22_sample(file_info, limit=100):
    """
    Extract sample data from the best CV22 file
    """
    print(f"\nExtracting {limit} rows from {file_info['language']} dataset...")
    print(f"File: {file_info['file_path']}")
    print(f"Coverage: {len(file_info['coverage'])}/{len(file_info['coverage']) + len(file_info['missing_headers'])} headers")
    
    if file_info['missing_headers']:
        print(f"Missing headers: {', '.join(file_info['missing_headers'])}")
    
    # Read the sample data
    df = pd.read_csv(file_info['file_path'], sep='\t', nrows=limit)
    
    # Map to our database schema
    mapped_data = []
    
    for _, row in df.iterrows():
        record = {
            'client_id': row.get('client_id', None),
            'path': row.get('path', None),
            'sentence': row.get('sentence', ''),
            'up_votes': int(row.get('up_votes', 0)) if pd.notna(row.get('up_votes')) else 0,
            'down_votes': int(row.get('down_votes', 0)) if pd.notna(row.get('down_votes')) else 0,
            'age': row.get('age', None),
            'gender': row.get('gender', None),
            'accents': row.get('accents', None),
            'locale': row.get('locale', file_info['language']),  # Fallback to directory name
            'segment': row.get('segment', None),
            'sentence_id': row.get('sentence_id', None)
        }
        
        # Only include records with valid sentences
        if record['sentence'] and len(record['sentence'].strip()) > 0:
            mapped_data.append(record)
    
    print(f"Mapped {len(mapped_data)} valid records")
    return mapped_data

def import_to_supabase(data, dry_run=False):
    """
    Import data to Supabase cv22_clips table
    """
    if dry_run:
        print("\n=== DRY RUN MODE ===")
        print("Sample records that would be imported:")
        for i, record in enumerate(data[:3]):
            print(f"\nRecord {i+1}:")
            for key, value in record.items():
                print(f"  {key}: {value}")
        print(f"\nTotal records: {len(data)}")
        return True
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
        return False
    
    print(f"\nConnecting to Supabase: {supabase_url}")
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        # Check if table exists and get current count
        existing = supabase.table("cv22_clips").select("id", count="exact").execute()
        print(f"Current cv22_clips records: {existing.count}")
        
        # Batch insert data
        batch_size = 50
        total_inserted = 0
        
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            result = supabase.table("cv22_clips").insert(batch).execute()
            
            if result.data:
                total_inserted += len(result.data)
                print(f"Inserted batch {i//batch_size + 1}: {len(result.data)} records")
            else:
                print(f"Error in batch {i//batch_size + 1}: {result}")
        
        print(f"\nSuccessfully imported {total_inserted} records to cv22_clips table")
        return True
        
    except Exception as e:
        print(f"Error importing to Supabase: {e}")
        return False

def generate_audio_urls(data, base_audio_url="https://commonvoice.mozilla.org/datasets"):
    """
    Generate proper audio URLs for the clips
    In a real scenario, you'd upload these to your Supabase Storage
    """
    for record in data:
        if record['path']:
            # For demo purposes, create a placeholder URL
            # In production, you'd upload the actual audio files
            record['path'] = f"{base_audio_url}/sample_audio/{record['path']}"
    
    return data

def main():
    parser = argparse.ArgumentParser(description='Import Common Voice 22 dataset to Supabase')
    parser.add_argument('--dataset-path', help='Path to CV22 dataset directory')
    parser.add_argument('--limit', type=int, default=100, help='Number of records to import (default: 100)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be imported without actually importing')
    parser.add_argument('--analyze-only', action='store_true', help='Only analyze dataset structure')
    
    args = parser.parse_args()
    
    print("🎤 Common Voice 22 Dataset Import Tool")
    print("=" * 50)
    
    # Find CV22 dataset
    dataset_path = find_cv22_dataset(args.dataset_path)
    if not dataset_path:
        print("❌ CV22 dataset not found!")
        print("\nPlease:")
        print("1. Download Common Voice 22 dataset from https://commonvoice.mozilla.org/datasets")
        print("2. Extract it to a known location")
        print("3. Run: python cv22_import.py --dataset-path /path/to/cv22")
        return False
    
    # Analyze structure
    best_file, analysis = analyze_cv22_structure(dataset_path)
    
    if not best_file:
        print("❌ No suitable validated.tsv files found with enough data")
        return False
    
    if args.analyze_only:
        print("\n📊 Dataset Analysis Complete")
        print(f"Best file: {best_file['language']} ({best_file['score']} headers, {best_file['row_count']} rows)")
        return True
    
    # Extract sample data
    sample_data = extract_cv22_sample(best_file, args.limit)
    
    if not sample_data:
        print("❌ No valid data extracted")
        return False
    
    # Generate audio URLs (placeholder)
    sample_data = generate_audio_urls(sample_data)
    
    # Import to Supabase
    success = import_to_supabase(sample_data, args.dry_run)
    
    if success:
        print("\n✅ Import completed successfully!")
        if not args.dry_run:
            print("You can now test practice mode with real CV22 data")
    else:
        print("\n❌ Import failed")
    
    return success

if __name__ == "__main__":
    main()