#!/usr/bin/env python3
"""
CV22 Export Tool - Interactive TUI
Exports aggregated CV22-compatible dataset from cv22_clips and user_contributions tables.
"""

import os
import csv
import hashlib
import subprocess
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
import getpass

# Colors for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    YELLOW = '\033[1;33m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


class CV22ExporterTUI:
    def __init__(self):
        """Initialize the exporter TUI."""
        self.connection_string = None
        self.conn = None
        self.setup_environment()
    
    def setup_environment(self):
        """Setup UV virtual environment and install dependencies automatically."""
        print(f"{Colors.BLUE}🔧 Setting up UV environment...{Colors.NC}")
        
        # Check if uv is installed
        try:
            subprocess.run(['uv', '--version'], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"{Colors.RED}❌ UV is not installed. Please install UV first:{Colors.NC}")
            print("   curl -LsSf https://astral.sh/uv/install.sh | sh")
            sys.exit(1)
        
        # Create venv if it doesn't exist
        if not os.path.exists('.venv'):
            print(f"{Colors.BLUE}📁 Creating UV virtual environment...{Colors.NC}")
            try:
                subprocess.run(['uv', 'venv'], check=True)
            except subprocess.CalledProcessError as e:
                print(f"{Colors.RED}❌ Failed to create virtual environment: {e}{Colors.NC}")
                sys.exit(1)
        
        # Install requirements
        if os.path.exists('requirements_export.txt'):
            print(f"{Colors.BLUE}📦 Installing requirements with UV...{Colors.NC}")
            try:
                subprocess.run(['uv', 'pip', 'install', '-r', 'requirements_export.txt'], check=True)
            except subprocess.CalledProcessError as e:
                print(f"{Colors.RED}❌ Failed to install requirements: {e}{Colors.NC}")
                sys.exit(1)
        else:
            print(f"{Colors.RED}❌ requirements_export.txt not found!{Colors.NC}")
            sys.exit(1)
        
        # Re-execute script with UV Python if not already using it
        if not self.is_running_in_uv():
            print(f"{Colors.BLUE}🔄 Restarting with UV Python environment...{Colors.NC}")
            venv_python = os.path.join('.venv', 'bin', 'python')
            if os.path.exists(venv_python):
                os.execv(venv_python, [venv_python] + sys.argv)
            else:
                print(f"{Colors.RED}❌ UV Python not found at {venv_python}{Colors.NC}")
                sys.exit(1)
        
        print(f"{Colors.GREEN}✅ UV environment ready!{Colors.NC}")
        
        # Import psycopg2 after environment setup
        try:
            global psycopg2, RealDictCursor
            import psycopg2
            from psycopg2.extras import RealDictCursor
        except ImportError as e:
            print(f"{Colors.RED}❌ Failed to import psycopg2: {e}{Colors.NC}")
            print("Make sure requirements_export.txt contains psycopg2-binary")
            sys.exit(1)
        
        print()
    
    def is_running_in_uv(self):
        """Check if currently running in UV virtual environment."""
        return sys.prefix != sys.base_prefix and '.venv' in sys.prefix
    
    def print_header(self):
        """Print the application header."""
        os.system('clear' if os.name == 'posix' else 'cls')
        print(f"{Colors.GREEN}╔══════════════════════════════════════════════════╗{Colors.NC}")
        print(f"{Colors.GREEN}║              CV22 Dataset Exporter               ║{Colors.NC}")
        print(f"{Colors.GREEN}║          Common Voice Compatible Format          ║{Colors.NC}")
        print(f"{Colors.GREEN}╚══════════════════════════════════════════════════╝{Colors.NC}")
        print()
    
    def get_database_connection(self):
        """Get database connection details from user with helpful instructions."""
        self.print_header()
        
        print(f"{Colors.CYAN}🔗 Database Connection Setup{Colors.NC}")
        print("=" * 60)
        print()
        print("To export your CV22 dataset, you need your Supabase database connection string.")
        print()
        print(f"{Colors.YELLOW}📋 How to get your connection string:{Colors.NC}")
        print("1. Go to your Supabase Dashboard: https://app.supabase.io/")
        print("2. Select your project")
        print("3. Click the 'Connect' button at the top of the page")
        print("4. Choose 'Transaction pooler' (recommended for this export)")
        print("5. Copy the connection string")
        print()
        print(f"{Colors.YELLOW}💡 Expected format:{Colors.NC}")
        print("postgresql://postgres.ref:password@aws-0-region.pooler.supabase.com:6543/postgres")
        print()
        print(f"{Colors.BLUE}🔒 Your password will be hidden when typing{Colors.NC}")
        print()
        
        while True:
            try:
                # Get connection details
                print(f"{Colors.CYAN}Enter your database connection details:{Colors.NC}")
                host = input("Database Host (e.g., aws-0-us-east-2.pooler.supabase.com): ").strip()
                if not host:
                    print(f"{Colors.RED}❌ Host cannot be empty!{Colors.NC}")
                    continue
                
                username = input("Username (e.g., postgres.hzquxnzusgiiclvrzbqy): ").strip()
                if not username:
                    print(f"{Colors.RED}❌ Username cannot be empty!{Colors.NC}")
                    continue
                
                # Hide password input
                password = getpass.getpass("Password (hidden): ").strip()
                if not password:
                    print(f"{Colors.RED}❌ Password cannot be empty!{Colors.NC}")
                    continue
                
                port = input("Port (default: 6543): ").strip() or "6543"
                database = input("Database name (default: postgres): ").strip() or "postgres"
                
                # Build connection string
                self.connection_string = f"postgresql://{username}:{password}@{host}:{port}/{database}"
                
                # Test connection
                print(f"\n{Colors.BLUE}🔄 Testing database connection...{Colors.NC}")
                self.connect()
                
                print(f"{Colors.GREEN}✅ Connection successful!{Colors.NC}")
                print()
                input("Press Enter to continue...")
                break
                
            except Exception as e:
                print(f"\n{Colors.RED}❌ Connection failed: {e}{Colors.NC}")
                print(f"\n{Colors.YELLOW}💡 Common issues:{Colors.NC}")
                print("- Wrong password (check your Supabase dashboard)")
                print("- Wrong host format (should include pooler.supabase.com)")
                print("- Wrong username format (should include project ref)")
                print("- Network connectivity issues")
                print()
                
                retry = input("Try again? (y/n): ").strip().lower()
                if retry != 'y':
                    print(f"{Colors.RED}Export cancelled.{Colors.NC}")
                    exit(1)
                print()
    
    def connect(self):
        """Connect to the database."""
        self.conn = psycopg2.connect(self.connection_string, cursor_factory=RealDictCursor)
    
    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
    
    def get_export_options(self):
        """Get export options from user."""
        self.print_header()
        
        print(f"{Colors.CYAN}📦 Export Configuration{Colors.NC}")
        print("=" * 60)
        print()
        
        # Get output filename
        default_filename = f"cv22_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filename = input(f"Output filename (default: {default_filename}): ").strip()
        if not filename:
            filename = default_filename
        
        # Get quality filter
        print(f"\n{Colors.YELLOW}📊 Quality Filter Options:{Colors.NC}")
        print("1) All data (no filter)")
        print("2) High quality only (3+ contributors, 5+ votes)")
        print("3) Medium+ quality (2+ contributors, 2+ votes)")
        print("4) Validated content only")
        print()
        
        while True:
            choice = input("Choose quality filter (1-4, default: 1): ").strip()
            if choice == "2":
                quality_filter = "high"
                break
            elif choice == "3":
                quality_filter = "medium"
                break
            elif choice == "4":
                quality_filter = "validated"
                break
            elif choice in ["1", ""]:
                quality_filter = None
                break
            else:
                print(f"{Colors.RED}❌ Invalid choice. Please enter 1-4.{Colors.NC}")
        
        return filename, quality_filter
    
    def get_aggregated_data(self, quality_filter: str = None) -> List[Dict[str, Any]]:
        """Execute the aggregated export query to merge cv22_clips and user_contributions."""
        
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
            -- Standard CV22 Export Fields Only
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
            MD5(sentence) as sentence_id
            
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
                print(f"{Colors.BLUE}🔄 Executing aggregation query...{Colors.NC}")
                cursor.execute(base_query)
                results = cursor.fetchall()
                print(f"{Colors.GREEN}✅ Retrieved {len(results)} aggregated records{Colors.NC}")
                return [dict(row) for row in results]
        except Exception as e:
            print(f"{Colors.RED}❌ Query execution failed: {e}{Colors.NC}")
            raise
    
    def export_to_csv(self, data: List[Dict[str, Any]], filename: str):
        """Export data to CSV in standard CV22 format."""
        if not data:
            print(f"{Colors.YELLOW}⚠️  No data to export{Colors.NC}")
            return
        
        # Standard CV22 fields
        fieldnames = [
            'client_id', 'path', 'sentence', 'up_votes', 'down_votes',
            'age', 'gender', 'accents', 'locale', 'segment', 'sentence_id'
        ]
        
        try:
            print(f"{Colors.BLUE}💾 Writing {len(data)} records to {filename}...{Colors.NC}")
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for row in data:
                    # Only write standard CV22 fields
                    cv22_row = {field: row.get(field) for field in fieldnames}
                    writer.writerow(cv22_row)
            
            print(f"{Colors.GREEN}✅ Export completed successfully!{Colors.NC}")
            print(f"{Colors.GREEN}📁 Output file: {filename}{Colors.NC}")
            print(f"{Colors.GREEN}📊 Records exported: {len(data)}{Colors.NC}")
            
        except Exception as e:
            print(f"{Colors.RED}❌ Export failed: {e}{Colors.NC}")
            raise
    
    def run(self):
        """Main TUI loop."""
        try:
            # Setup database connection
            self.get_database_connection()
            
            # Get export options
            filename, quality_filter = self.get_export_options()
            
            # Connect to database
            self.connect()
            
            # Get aggregated data
            print(f"\n{Colors.BLUE}🚀 Starting CV22 export...{Colors.NC}")
            data = self.get_aggregated_data(quality_filter)
            
            # Export to CSV
            self.export_to_csv(data, filename)
            
            # Show summary
            print(f"\n{Colors.CYAN}📋 Export Summary:{Colors.NC}")
            print(f"Format: Standard Common Voice 22 CSV")
            print(f"Quality Filter: {quality_filter or 'None (all data)'}")
            print(f"Records: {len(data)}")
            print(f"Output: {filename}")
            print()
            print(f"{Colors.GREEN}🎉 Export completed successfully!{Colors.NC}")
            
        except KeyboardInterrupt:
            print(f"\n{Colors.YELLOW}⚠️  Export cancelled by user{Colors.NC}")
        except Exception as e:
            print(f"\n{Colors.RED}💥 Export failed: {e}{Colors.NC}")
            print(f"\n{Colors.YELLOW}💡 Need help?{Colors.NC}")
            print("- Check your database connection")
            print("- Verify your Supabase project is active")
            print("- Ensure tables cv22_clips and user_contributions exist")
        finally:
            self.disconnect()


def main():
    """Main entry point."""
    exporter = CV22ExporterTUI()
    exporter.run()


if __name__ == "__main__":
    main()