import argparse
import time
import schedule
import pandas as pd
from datetime import datetime

import config
import database
import scraper
import google_collector

def run_pipeline():
    """Runs the full collection, de-duplication, and storage pipeline."""
    print("=" * 60)
    print(f"[Pipeline] Starting collection job at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 1. Run Target Scraper (Way A)
    print("[Pipeline] Running target site scrapers (Way A)...")
    df_a = pd.DataFrame()
    try:
        df_a = scraper.run_target_scraper()
        print(f"[Pipeline] Way A collected {len(df_a)} records.")
    except Exception as e:
        print(f"[Pipeline Error] Critical error during Way A scraping: {e}")
        
    # 2. Run Google Collector (Way B)
    print("[Pipeline] Running Google Alerts/Search collector (Way B)...")
    df_b = pd.DataFrame()
    try:
        df_b = google_collector.run_google_collector()
        print(f"[Pipeline] Way B collected {len(df_b)} records.")
    except Exception as e:
        print(f"[Pipeline Error] Critical error during Way B collection: {e}")
        
    # 3. Merge datasets
    merged_df = pd.concat([df_a, df_b], ignore_index=True)
    if merged_df.empty:
        print("[Pipeline] No records collected in this run. Job complete.")
        return
        
    # 3.5 Filter out unwanted projects (optional)
    initial_len = len(merged_df)
    merged_df = merged_df[~merged_df['title'].apply(scraper.should_filter_project)]
    filtered_len = initial_len - len(merged_df)
    if filtered_len > 0:
        print(f"[Pipeline] Filtered out {filtered_len} records by keyword filter.")
        
    if merged_df.empty:
        print("[Pipeline] No records remaining after filtering. Job complete.")
        return
        
    # 4. Storage & De-duplication using DB insert
    print(f"[Pipeline] Merged {len(merged_df)} total records after filtering. Saving to database & de-duplicating...")
    new_records = database.insert_projects(merged_df)
    
    print(f"[Pipeline] Job finished. Newly added records: {new_records}")
    print("=" * 60)
    
    # 5. Auto Push to GitHub (Only in local SQLite mode)
    if new_records > 0 and not database.is_github_mode():
        auto_git_push()

def auto_git_push():
    """Adds, commits, and pushes the new CSV data and configuration changes to GitHub."""
    import subprocess
    print("[Pipeline] Running automatic Git push...")
    try:
        # Add CSV file and configs
        subprocess.run(["git", "add", "data/support_projects.csv", ".gitignore", "config.py", "scraper.py"], check=True)
        
        # Check if there are staged changes
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
        if status.stdout.strip():
            commit_msg = f"Auto-update: Support projects ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
            subprocess.run(["git", "commit", "-m", commit_msg], check=True)
            subprocess.run(["git", "push"], check=True)
            print("[Pipeline] Successfully pushed updates to GitHub!")
        else:
            print("[Pipeline] No changes to push to GitHub.")
    except Exception as e:
        print(f"[Pipeline Warning] Automatic Git push failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="Support Project Monitoring System")
    parser.add_argument("--now", action="store_true", help="Run the collection pipeline immediately")
    args = parser.parse_args()
    
    # Initialize DB schema
    database.init_db()
    
    if args.now:
        print("[System] --now flag detected. Running pipeline immediately.")
        run_pipeline()
        return

    # Schedule the daily job
    schedule.every().day.at(config.SCHEDULE_TIME).do(run_pipeline)
    print(f"[System] Scheduler initialized. Job scheduled daily at {config.SCHEDULE_TIME}")
    
    # Keeping the script alive for the scheduler
    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        print("[System] Scheduler stopped by user.")

if __name__ == "__main__":
    main()
