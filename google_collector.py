import feedparser
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta
import config

def get_current_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def is_within_24_hours(date_str: str) -> bool:
    """Checks if a given date string is within the last 24 hours."""
    if not date_str:
        return True
    try:
        post_dt = pd.to_datetime(date_str)
        if post_dt.tzinfo is None:
            post_dt = post_dt.tz_localize(timezone.utc)
        else:
            post_dt = post_dt.tz_convert(timezone.utc)
            
        now_utc = datetime.now(timezone.utc)
        diff = now_utc - post_dt
        return diff <= timedelta(hours=24)
    except Exception as e:
        print(f"[Google Collector Warning] Could not parse date '{date_str}': {e}")
        return True

def collect_from_google_alerts() -> list:
    """Collects recent entries from Google Alerts RSS feeds."""
    items = []
    print("[Google Collector] Collecting from Google Alerts RSS feeds...")
    
    for url in config.GOOGLE_ALERTS_FEEDS:
        if not url or "123456789" in url:
            continue
            
        print(f"[Google Collector] Reading Alert feed: {url}")
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                title = entry.get("title", "").strip()
                if title:
                    from bs4 import BeautifulSoup
                    title = BeautifulSoup(title, "html.parser").get_text()

                link = entry.get("link", "").strip()
                
                if link.startswith("https://www.google.com/url?"):
                    from urllib.parse import urlparse, parse_qs
                    parsed = urlparse(link)
                    qs = parse_qs(parsed.query)
                    if "url" in qs:
                        link = qs["url"][0]

                published_date = entry.get("published", entry.get("updated", ""))
                
                if title and link:
                    if is_within_24_hours(published_date):
                        items.append({
                            "source": "Google Alerts",
                            "title": title,
                            "link": link,
                            "post_date": published_date,
                            "collected_at": get_current_timestamp()
                        })
        except Exception as e:
            print(f"[Google Collector Error] Failed parsing alert RSS feed {url}: {e}")
            
    return items

def run_google_collector() -> pd.DataFrame:
    """Runs Google Collector using Google Alerts RSS feeds."""
    all_items = []
    alerts_items = collect_from_google_alerts()
    all_items.extend(alerts_items)
    return pd.DataFrame(all_items)
