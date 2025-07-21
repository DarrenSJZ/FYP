#!/usr/bin/env python3
"""
CV22 Export Script
Aggregates data from cv22_clips and user_contributions tables to create a unified CV22-compatible dataset.
"""

import os
import csv
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import argparse


class CV22Exporter:
    def __init__(self, connection_string: str):
        """Initialize the exporter with database connection."""
        self.connection_string = connection_string
        self.conn = None
    
    def connect(self):
        """Connect to the database."""
        try:
            self.conn = psycopg2.connect(self.connection_string, cursor_factory=RealDictCursor)
            print("✅ Connected to database")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            raise
    
    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("✅ Database connection closed")
    
    def get_aggregated_data(self, quality_filter: str = None) -> List[Dict[str, Any]]:
        """
        Execute the aggregated export query to merge cv22_clips and user_contributions.
        
        Args:
            quality_filter: Optional filter ('high', 'medium', 'basic', or None for all)
        
        Returns:
            List of aggregated records
        """
        
        # Build the aggregation query based on strategy document
        base_query = """
        WITH combined_data AS (
            -- Original CV22 clips
            SELECT 
                client_id,
                path,
                sentence,
                up_votes,
                down_votes,
                age,
                gender,
                accents,
                locale,
                'cv22_clips' as source_table,
                'validated' as validation_status,
                NULL as session_type,
                created_at,
                created_at as updated_at
            FROM cv22_clips
            
            UNION ALL
            
            -- User contributions
            SELECT 
                client_id,
                path,
                sentence,
                up_votes,
                down_votes,
                age,
                gender,
                accent_detected as accents,
                locale_detected as locale,
                'user_contributions' as source_table,
                validation_status,
                session_type,
                created_at,
                updated_at
            FROM user_contributions
        ),
        aggregated_data AS (
            SELECT 
                sentence,
                
                -- Aggregate contributors
                STRING_AGG(DISTINCT client_id, ',' ORDER BY client_id) as all_contributors,
                COUNT(DISTINCT client_id) as contributor_count,
                
                -- Sum validation votes
                SUM(up_votes) as total_upvotes,
                SUM(down_votes) as total_downvotes,
                
                -- Take best available metadata (prefer validated data)
                COALESCE(
                    MAX(CASE WHEN validation_status = 'validated' THEN path END),
                    MAX(path)
                ) as final_path,
                
                COALESCE(
                    MAX(CASE WHEN validation_status = 'validated' THEN accents END),
                    MAX(accents)
                ) as final_accents,
                
                COALESCE(
                    MAX(CASE WHEN validation_status = 'validated' THEN locale END),
                    MAX(locale)
                ) as final_locale,
                
                COALESCE(
                    MAX(CASE WHEN validation_status = 'validated' THEN age END),
                    MAX(age)
                ) as final_age,
                
                COALESCE(
                    MAX(CASE WHEN validation_status = 'validated' THEN gender END),
                    MAX(gender)
                ) as final_gender,
                
                -- Quality metrics
                COALESCE(AVG(CASE WHEN session_type = 'practice' THEN 1.0 ELSE 0.0 END), 0) as practice_ratio,
                COUNT(CASE WHEN session_type = 'upload' THEN 1 END) as upload_contributions,
                COUNT(CASE WHEN session_type = 'practice' THEN 1 END) as practice_sessions,
                
                -- Timestamps
                MIN(created_at) as first_recorded,
                MAX(updated_at) as last_updated,
                
                -- Source diversity
                CASE 
                    WHEN COUNT(DISTINCT source_table) > 1 THEN 'mixed'
                    ELSE MAX(source_table)
                END as data_source_type,
                
                -- Quality score calculation
                CASE 
                    WHEN COUNT(DISTINCT client_id) >= 3 AND SUM(up_votes) >= 5 THEN 'high'
                    WHEN COUNT(DISTINCT client_id) >= 2 AND SUM(up_votes) >= 2 THEN 'medium'  
                    WHEN COUNT(CASE WHEN session_type = 'upload' THEN 1 END) > 0 THEN 'reviewed'
                    ELSE 'basic'
                END as quality_score
                
            FROM combined_data
            GROUP BY sentence
        )
        SELECT 
            -- CV22 Standard Export Fields
            all_contributors as client_id,
            final_path as path,
            sentence,
            total_upvotes as up_votes,
            total_downvotes as down_votes,
            final_age as age,
            final_gender as gender,
            final_accents as accents,
            final_locale as locale,
            NULL as segment,
            MD5(sentence) as sentence_id,
            
            -- Extended metadata (for analysis)
            contributor_count,
            upload_contributions,
            practice_sessions,
            data_source_type,
            quality_score,
            practice_ratio,
            first_recorded,
            last_updated
            
        FROM aggregated_data
        """
        
        # Add quality filter if specified
        if quality_filter:
            if quality_filter == 'high':
                base_query += " WHERE quality_score = 'high'"
            elif quality_filter == 'medium':
                base_query += " WHERE quality_score IN ('high', 'medium')"
            elif quality_filter == 'validated':
                base_query += " WHERE upload_contributions > 0 OR data_source_type = 'cv22_clips'"
        
        base_query += " ORDER BY up_votes DESC, contributor_count DESC"
        
        try:
            with self.conn.cursor() as cursor:
                print(f"🔄 Executing aggregation query...")
                cursor.execute(base_query)
                results = cursor.fetchall()
                print(f"✅ Retrieved {len(results)} aggregated records")
                return [dict(row) for row in results]
        
        except Exception as e:
            print(f"❌ Query execution failed: {e}")
            raise
    
    def export_to_csv(self, data: List[Dict[str, Any]], output_file: str, format_type: str = 'cv22'):
        """
        Export data to CSV in specified format.
        
        Args:
            data: Aggregated data records
            output_file: Output CSV file path
            format_type: 'cv22' for standard CV22 format, 'extended' for enhanced format
        """
        
        if format_type == 'cv22':
            # Standard CV22 fields only
            fieldnames = [
                'client_id', 'path', 'sentence', 'up_votes', 'down_votes',
                'age', 'gender', 'accents', 'locale', 'segment', 'sentence_id'
            ]
        else:
            # Extended format with additional metadata
            fieldnames = [
                'client_id', 'path', 'sentence', 'up_votes', 'down_votes',
                'age', 'gender', 'accents', 'locale', 'segment', 'sentence_id',
                'contributor_count', 'upload_contributions', 'practice_sessions',
                'data_source_type', 'quality_score', 'practice_ratio',
                'first_recorded', 'last_updated'
            ]
        
        try:
            with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for row in data:
                    # Convert datetime objects to strings
                    processed_row = {}
                    for field in fieldnames:
                        value = row.get(field)
                        if isinstance(value, datetime):
                            processed_row[field] = value.isoformat()
                        else:
                            processed_row[field] = value
                    
                    writer.writerow(processed_row)
            
            print(f"✅ Exported {len(data)} records to {output_file}")
            
        except Exception as e:
            print(f"❌ CSV export failed: {e}")
            raise
    
    def export_to_json(self, data: List[Dict[str, Any]], output_file: str):
        """Export data to JSON format."""
        try:
            # Convert datetime objects to strings for JSON serialization
            json_data = []
            for row in data:
                json_row = {}
                for key, value in row.items():
                    if isinstance(value, datetime):
                        json_row[key] = value.isoformat()
                    else:
                        json_row[key] = value
                json_data.append(json_row)
            
            with open(output_file, 'w', encoding='utf-8') as jsonfile:
                json.dump(json_data, jsonfile, indent=2, ensure_ascii=False)
            
            print(f"✅ Exported {len(data)} records to {output_file}")
            
        except Exception as e:
            print(f"❌ JSON export failed: {e}")
            raise
    
    def print_summary(self, data: List[Dict[str, Any]]):
        """Print export summary statistics."""
        if not data:
            print("⚠️  No data to summarize")
            return
        
        total_records = len(data)
        total_contributors = sum(row.get('contributor_count', 0) for row in data)
        total_upvotes = sum(row.get('up_votes', 0) for row in data)
        
        # Quality distribution
        quality_counts = {}
        source_counts = {}
        
        for row in data:
            quality = row.get('quality_score', 'unknown')
            source = row.get('data_source_type', 'unknown')
            
            quality_counts[quality] = quality_counts.get(quality, 0) + 1
            source_counts[source] = source_counts.get(source, 0) + 1
        
        print("\n📊 Export Summary:")
        print(f"Total Records: {total_records}")
        print(f"Total Contributors: {total_contributors}")
        print(f"Total Upvotes: {total_upvotes}")
        print(f"Average Contributors per Record: {total_contributors/total_records:.1f}")
        
        print("\nQuality Distribution:")
        for quality, count in sorted(quality_counts.items()):
            percentage = (count / total_records) * 100
            print(f"  {quality}: {count} ({percentage:.1f}%)")
        
        print("\nSource Distribution:")
        for source, count in sorted(source_counts.items()):
            percentage = (count / total_records) * 100
            print(f"  {source}: {count} ({percentage:.1f}%)")


def main():
    parser = argparse.ArgumentParser(description='Export aggregated CV22 dataset')
    parser.add_argument('--db-url', required=True, help='Database connection string')
    parser.add_argument('--output', '-o', required=True, help='Output file path')
    parser.add_argument('--format', choices=['csv', 'json'], default='csv', help='Output format')
    parser.add_argument('--cv22-format', choices=['cv22', 'extended'], default='cv22', 
                       help='CV22 standard format or extended with metadata')
    parser.add_argument('--quality-filter', choices=['high', 'medium', 'validated'], 
                       help='Filter by quality level')
    
    args = parser.parse_args()
    
    # Initialize exporter
    exporter = CV22Exporter(args.db_url)
    
    try:
        # Connect to database
        exporter.connect()
        
        # Get aggregated data
        print(f"🔄 Starting CV22 export...")
        data = exporter.get_aggregated_data(quality_filter=args.quality_filter)
        
        if not data:
            print("⚠️  No data found matching criteria")
            return
        
        # Print summary
        exporter.print_summary(data)
        
        # Export data
        if args.format == 'csv':
            exporter.export_to_csv(data, args.output, args.cv22_format)
        else:
            exporter.export_to_json(data, args.output)
        
        print(f"\n🎉 Export completed successfully!")
        
    except Exception as e:
        print(f"💥 Export failed: {e}")
        return 1
    
    finally:
        exporter.disconnect()
    
    return 0


if __name__ == '__main__':
    exit(main())