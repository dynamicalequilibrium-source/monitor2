import requests
from bs4 import BeautifulSoup
import feedparser
import pandas as pd
from datetime import datetime
import re
from urllib.parse import urljoin
import config

def get_current_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def clean_text(text: str) -> str:
    """Removes double spaces and trims text."""
    if not text:
        return ""
    return " ".join(text.split()).strip()

def scrape_rss(site_config: dict) -> list:
    """Parses an RSS feed and returns a list of items."""
    name = site_config["name"]
    url = site_config["url"]
    items = []
    
    print(f"[Scraper] Parsing RSS feed for {name} ({url})...")
    try:
        feed = feedparser.parse(url)
        if feed.bozo:
            print(f"[Warning] Feedparser flagged non-fatal parsing issue for {name}")

        for entry in feed.entries:
            title = clean_text(entry.get("title", ""))
            link = entry.get("link", "").strip()
            post_date = entry.get("published", entry.get("updated", ""))
            
            if title and link:
                items.append({
                    "source": name,
                    "title": title,
                    "link": link,
                    "post_date": post_date,
                    "collected_at": get_current_timestamp()
                })
        print(f"[Scraper] Successfully collected {len(items)} items from RSS feed '{name}'")
    except Exception as e:
        print(f"[Error] Failed to parse RSS feed for {name}: {e}")
        
    return items

def scrape_soup_custom(site_config: dict) -> list:
    """Scrapes a target website using BeautifulSoup with custom routing-based rules.
    
    To add a new parser:
    1. Add a new entry to TARGET_SITES in config.py with a unique 'parser' key.
    2. Add a new `elif parser_type == "your_parser_key":` block below.
    3. Implement the parsing logic specific to the target site's HTML structure.
    
    Common patterns:
    - Find all <a> tags with specific href patterns
    - Extract title from link text, date from sibling/parent elements
    - Use urljoin(url, href) for relative URLs
    """
    name = site_config["name"]
    url = site_config["url"]
    parser_type = site_config.get("parser")
    items = []
    
    print(f"[Scraper] Scraping website: {name} ({url}) using parser '{parser_type}'...")
    try:
        response = requests.get(url, headers=config.HEADERS, timeout=12, verify=False)
        response.encoding = response.apparent_encoding or 'utf-8'
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # =====================================================================
        # Add your custom parsers below.
        # =====================================================================
        #
        # Example parser template:
        #
        # if parser_type == "example":
        #     for a in soup.find_all('a', href=True):
        #         href = a['href']
        #         title = clean_text(a.get_text())
        #         if "view" in href and title:
        #             post_date = ""
        #             # Extract date from nearby elements
        #             date_match = re.search(r'\d{4}[.-]\d{2}[.-]\d{2}', a.parent.get_text())
        #             if date_match:
        #                 post_date = date_match.group(0).replace(".", "-")
        #             items.append({
        #                 "source": name,
        #                 "title": title,
        #                 "link": urljoin(url, href),
        #                 "post_date": post_date,
        #                 "collected_at": get_current_timestamp()
        #             })
        #
        # elif parser_type == "another_site":
        #     ...
        #
        # =====================================================================

        if parser_type is None:
            print(f"[Scraper Warning] No parser type specified for '{name}'. Skipping.")
        else:
            print(f"[Scraper Warning] Unknown parser type '{parser_type}' for '{name}'. "
                  f"Please implement a parser in scraper.py.")
            
        print(f"[Scraper] Successfully collected {len(items)} items from '{name}'")
    except Exception as e:
        print(f"[Error] Failed to scrape {name}: {e}")
        
    return items


# =============================================================================
# Region Filter (Optional)
# =============================================================================
# Uncomment and customize the FILTER_KEYWORDS list if you want to filter out
# announcements from specific regions or containing certain keywords.
# =============================================================================

FILTER_KEYWORDS = [
    # Add keywords to filter out from titles
    # Example: "마감", "종료", "서울", "경기"
]

def should_filter_project(title: str) -> bool:
    """Returns True if the project title should be filtered out.
    
    Customize FILTER_KEYWORDS above to enable filtering.
    """
    if not title or not FILTER_KEYWORDS:
        return False
    title_lower = title.lower()
    for keyword in FILTER_KEYWORDS:
        if keyword in title_lower:
            return True
    return False


# =============================================================================
# Main entry point
# =============================================================================

def run_target_scraper() -> pd.DataFrame:
    """Iterates over all target sites in config and collects data."""
    all_items = []
    
    for site in config.TARGET_SITES:
        scrape_type = site.get("type", "soup")
        try:
            if scrape_type == "rss":
                items = scrape_rss(site)
            elif scrape_type == "soup":
                items = scrape_soup_custom(site)
            else:
                print(f"[Scraper Warning] Unknown type '{scrape_type}' for '{site.get('name')}'. Skipping.")
                items = []
            all_items.extend(items)
        except Exception as e:
            print(f"[Scraper Error] Unhandled error for '{site.get('name', 'unknown')}': {e}")

    return pd.DataFrame(all_items)
