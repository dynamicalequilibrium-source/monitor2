import os

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Data storage path (CSV and SQLite)
DB_PATH = os.path.join(BASE_DIR, "data", "support_projects.db")
CSV_PATH = os.path.join(BASE_DIR, "data", "support_projects.csv")

# Ensure data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Scheduler configuration (daily run time)
SCHEDULE_TIME = "09:00"

# =============================================================================
# [Way A] Target Sites for direct scraping
# =============================================================================
# Each entry defines a target website to scrape.
#
# Fields:
#   name   : Display name of the source (shown in the dashboard)
#   url    : The URL to scrape
#   type   : 'rss' for RSS feeds, 'soup' for HTML scraping
#   parser : Identifier for the custom parser in scraper.py
#
# Example:
# {
#     "name": "예시기관",
#     "url": "https://example.or.kr/notice/",
#     "type": "soup",
#     "parser": "example"
# },
#
# After adding an entry here, implement the corresponding parser
# in scraper.py under the scrape_soup_custom() function.
# =============================================================================

TARGET_SITES = [
    {
        "name": "행정안전부",
        "url": "https://www.mois.go.kr/frt/bbs/type002/commonSelectBoardList.do?bbsId=BBSMSTR_000000000010",
        "type": "soup",
        "parser": "mois"
    }
]

# =============================================================================
# [Way B] Google Alerts RSS Feeds (or Custom Search API config)
# =============================================================================
# Generate Google Alerts RSS feeds at https://www.google.com/alerts
# Query examples: "지원사업", "공모사업", "공고"

GOOGLE_ALERTS_FEEDS = [
    # Add your Google Alerts RSS feed URLs here
    # "https://www.google.com/alerts/feeds/YOUR_FEED_ID/YOUR_ALERT_ID"
]

# Standard request headers to mimic a browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
