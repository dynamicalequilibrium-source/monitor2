import sqlite3
import os
import base64
import json
import requests
import pandas as pd
from datetime import datetime
import config

# Global state to keep track of the GitHub file SHA to avoid extra network requests
_github_file_sha = None

def get_github_config():
    """Retrieves GitHub repository and token from environment variables."""
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY") # format: "owner/repo"
    return token, repo

def is_github_mode() -> bool:
    """Returns True if the system is configured to run in GitHub storage mode."""
    token, repo = get_github_config()
    return bool(token and repo)

def get_all_projects_github() -> tuple[pd.DataFrame, str]:
    """
    Fetches the CSV dataset directly from the GitHub repository.
    Returns a tuple of (DataFrame, sha_string).
    """
    global _github_file_sha
    token, repo = get_github_config()
    
    url = f"https://api.github.com/repos/{repo}/contents/data/support_projects.csv"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    print(f"[GitHub Storage] Fetching CSV from GitHub: {url} ...")
    try:
        res = requests.get(url, headers=headers, timeout=12)
        if res.status_code == 200:
            data = res.json()
            _github_file_sha = data.get("sha")
            # GitHub returns base64 content with newlines, clean it up
            content_b64 = data.get("content", "").replace("\n", "").replace("\r", "")
            content_bytes = base64.b64decode(content_b64)
            
            # Read CSV bytes into DataFrame
            from io import BytesIO
            df = pd.read_csv(BytesIO(content_bytes), encoding="utf-8-sig")
            print(f"[GitHub Storage] Successfully loaded {len(df)} records from GitHub.")
            return df, _github_file_sha
            
        elif res.status_code == 404:
            print("[GitHub Storage] CSV file not found on GitHub. Initializing new dataset.")
            return pd.DataFrame(), None
        else:
            print(f"[GitHub Storage Error] Failed to fetch file (Status {res.status_code}): {res.text}")
            return pd.DataFrame(), None
            
    except Exception as e:
        print(f"[GitHub Storage Error] Exception while fetching CSV: {e}")
        return pd.DataFrame(), None

def insert_projects_github(df: pd.DataFrame) -> int:
    """
    Deduplicates and appends new records in memory,
    then writes the updated CSV back to GitHub.
    """
    if df.empty:
        return 0
        
    token, repo = get_github_config()
    existing_df, sha = get_all_projects_github()
    
    # Identify new rows
    if not existing_df.empty:
        # Deduplicate using the 'link' column
        existing_links = set(existing_df['link'].astype(str).tolist())
        new_rows = df[~df['link'].astype(str).isin(existing_links)]
    else:
        new_rows = df
        
    new_count = len(new_rows)
    if new_count == 0:
        print("[GitHub Storage] No new records to save.")
        return 0
        
    print(f"[GitHub Storage] Found {new_count} new records to append.")
    
    # Merge and format
    if not existing_df.empty:
        merged_df = pd.concat([existing_df, new_rows], ignore_index=True)
    else:
        merged_df = new_rows
        
    # Ensure ID is unique and auto-incrementing
    if 'id' in merged_df.columns:
        merged_df['id'] = range(1, len(merged_df) + 1)
    else:
        merged_df.insert(0, 'id', range(1, len(merged_df) + 1))
        
    # Convert DataFrame to CSV string (with BOM for Korean characters in Excel)
    from io import BytesIO
    csv_buffer = BytesIO()
    merged_df.to_csv(csv_buffer, index=False, encoding="utf-8-sig")
    csv_bytes = csv_buffer.getvalue()
    csv_b64 = base64.b64encode(csv_bytes).decode("utf-8")
    
    # Put content
    url = f"https://api.github.com/repos/{repo}/contents/data/support_projects.csv"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    commit_msg = f"Auto-update: Support projects ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
    payload = {
        "message": commit_msg,
        "content": csv_b64
    }
    if sha:
        payload["sha"] = sha
        
    print(f"[GitHub Storage] Committing updated CSV to GitHub...")
    try:
        res = requests.put(url, headers=headers, json=payload, timeout=12)
        if res.status_code in [200, 201]:
            print(f"[GitHub Storage] Successfully committed CSV update to GitHub. New total: {len(merged_df)} records.")
            return new_count
        else:
            print(f"[GitHub Storage Error] Commit failed (Status {res.status_code}): {res.text}")
            return 0
    except Exception as e:
        print(f"[GitHub Storage Error] Exception while committing to GitHub: {e}")
        return 0

# --- SQLite Local Fallback Methods ---

def init_db():
    """Initializes the SQLite database and creates the projects table if it doesn't exist.
    
    If the database is freshly created (no existing records) and a CSV file
    already exists, seed the database from the CSV. This is critical for
    GitHub Actions where the SQLite DB is ephemeral but the CSV is persisted
    in the git repository.
    """
    if is_github_mode():
        return # Skip SQLite initialization in GitHub mode
        
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            link TEXT NOT NULL UNIQUE,
            post_date TEXT,
            collected_at TEXT NOT NULL
        )
    """)
    conn.commit()
    
    # Check if DB is empty and CSV exists — seed DB from CSV
    cursor.execute("SELECT COUNT(*) FROM projects")
    count = cursor.fetchone()[0]
    if count == 0 and os.path.exists(config.CSV_PATH):
        try:
            existing_df = pd.read_csv(config.CSV_PATH, encoding="utf-8-sig")
            if not existing_df.empty and 'link' in existing_df.columns:
                seeded = 0
                for _, row in existing_df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO projects (source, title, link, post_date, collected_at)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            row.get('source', ''),
                            row.get('title', ''),
                            row.get('link', ''),
                            row.get('post_date', ''),
                            row.get('collected_at', '')
                        ))
                        if cursor.rowcount > 0:
                            seeded += 1
                    except Exception as e:
                        pass
                conn.commit()
                print(f"[DB Init] Seeded {seeded} existing records from CSV into fresh database.")
        except Exception as e:
            print(f"[DB Init Warning] Failed to seed from CSV: {e}")
    
    conn.close()

def insert_projects_local(df: pd.DataFrame) -> int:
    """Inserts collected projects into the SQLite database locally."""
    if df.empty:
        return 0

    init_db()
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    new_rows_count = 0
    
    for _, row in df.iterrows():
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO projects (source, title, link, post_date, collected_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                row['source'],
                row['title'],
                row['link'],
                row['post_date'],
                row['collected_at']
            ))
            if cursor.rowcount > 0:
                new_rows_count += 1
        except Exception as e:
            print(f"[DB Error] Failed to insert row: {e}")
            
    conn.commit()
    conn.close()
    
    if new_rows_count > 0:
        export_to_csv()
        
    return new_rows_count

def get_all_projects_local() -> pd.DataFrame:
    """Retrieves all projects from local SQLite database."""
    init_db()
    conn = sqlite3.connect(config.DB_PATH)
    try:
        df = pd.read_sql_query("SELECT * FROM projects ORDER BY collected_at DESC", conn)
    except Exception as e:
        print(f"[DB Error] Failed to read query: {e}")
        df = pd.DataFrame()
    finally:
        conn.close()
    return df

def export_to_csv():
    """Exports all stored records from SQLite to CSV locally."""
    df = get_all_projects_local()
    if not df.empty:
        df.to_csv(config.CSV_PATH, index=False, encoding="utf-8-sig")
        print(f"[Storage] Successfully exported {len(df)} records to {config.CSV_PATH}")

# --- Unified Public Interface ---

def insert_projects(df: pd.DataFrame) -> int:
    """Deduplicates and stores projects using the active storage mode."""
    if is_github_mode():
        return insert_projects_github(df)
    else:
        return insert_projects_local(df)

def get_all_projects() -> pd.DataFrame:
    """Retrieves all projects using the active storage mode."""
    if is_github_mode():
        df, _ = get_all_projects_github()
        return df
    else:
        return get_all_projects_local()
