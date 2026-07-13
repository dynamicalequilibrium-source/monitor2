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

        if parser_type == "mois_notice":
            # We want to scrape multiple pages and search results
            urls_to_scrape = []
            
            # 1. Base board pages (pages 1 to 3)
            for page in range(1, 4):
                urls_to_scrape.append((f"{url}&pageIndex={page}", "general"))
                
            # 2. Search queries (page 1 for "ai" and "인공지능")
            for keyword in ["ai", "인공지능"]:
                urls_to_scrape.append((f"{url}&searchCnd=0&searchWrd={keyword}&pageIndex=1", "search"))
                
            for fetch_url, url_type in urls_to_scrape:
                try:
                    if fetch_url == f"{url}&pageIndex=1":
                        page_soup = soup
                    else:
                        print(f"[Scraper] Fetching notice page: {fetch_url}")
                        page_res = requests.get(fetch_url, headers=config.HEADERS, timeout=12, verify=False)
                        page_res.encoding = page_res.apparent_encoding or 'utf-8'
                        page_soup = BeautifulSoup(page_res.text, "html.parser")
                        
                    for a in page_soup.find_all('a', href=True):
                        href = a['href']
                        raw_text = a.get_text()
                        
                        if "BBSMSTR_000000000010" in href and "nttId" in href:
                            title = clean_text(raw_text)
                            
                            post_date = ""
                            date_match = re.search(r'\d{4}[.-]\d{2}[.-]\d{2}', title)
                            if date_match:
                                post_date = date_match.group(0).replace(".", "-")
                                title = title.replace(date_match.group(0), "").strip()
                                title = re.sub(r'[\s.,\-\(\)]+$', '', title).strip()
                                
                            if title:
                                link = urljoin(url, href)
                                link = re.sub(r';jsessionid=[^?]+', '', link) # strip jsessionid
                                items.append({
                                    "source": name,
                                    "title": title,
                                    "link": link,
                                    "post_date": post_date,
                                    "collected_at": get_current_timestamp()
                                })
                except Exception as page_err:
                    print(f"[Scraper Warning] Failed to fetch notice subpage {fetch_url}: {page_err}")

        elif parser_type == "mois_press":
            # We want to scrape multiple pages and search results
            urls_to_scrape = []
            
            # 1. Base board pages (pages 1 to 3)
            for page in range(1, 4):
                urls_to_scrape.append((f"{url}&pageIndex={page}", "general"))
                
            # 2. Search queries (pages 1 to 4 for "ai" and "인공지능" to collect ~30+ items)
            for keyword in ["ai", "인공지능"]:
                for page in range(1, 5):
                    urls_to_scrape.append((f"{url}&searchCnd=0&searchWrd={keyword}&pageIndex={page}", "search"))
                
            for fetch_url, url_type in urls_to_scrape:
                try:
                    if fetch_url == f"{url}&pageIndex=1":
                        page_soup = soup
                    else:
                        print(f"[Scraper] Fetching press page: {fetch_url}")
                        page_res = requests.get(fetch_url, headers=config.HEADERS, timeout=12, verify=False)
                        page_res.encoding = page_res.apparent_encoding or 'utf-8'
                        page_soup = BeautifulSoup(page_res.text, "html.parser")
                        
                    tbody = page_soup.find('tbody')
                    if tbody:
                        rows = tbody.find_all('tr')
                        for row in rows:
                            cols = row.find_all(['td', 'th'])
                            a = row.find('a', href=True)
                            if a and "BBSMSTR_000000000008" in a['href'] and "nttId" in a['href']:
                                title = clean_text(a.get_text())
                                href = a['href']
                                
                                post_date = ""
                                for td in cols:
                                    text_content = td.get_text().strip()
                                    date_match = re.search(r'\d{4}[.-]\d{2}[.-]\d{2}', text_content)
                                    if date_match:
                                        post_date = date_match.group(0).replace(".", "-")
                                        break
                                        
                                if title:
                                    link = urljoin(url, href)
                                    link = re.sub(r';jsessionid=[^?]+', '', link)
                                    items.append({
                                        "source": name,
                                        "title": title,
                                        "link": link,
                                        "post_date": post_date,
                                        "collected_at": get_current_timestamp()
                                    })
                except Exception as page_err:
                    print(f"[Scraper Warning] Failed to fetch press subpage {fetch_url}: {page_err}")

        elif parser_type == "msit_press":
            # We want to scrape multiple pages and search results
            urls_to_scrape = []
            
            # 1. Base board pages (pages 1 to 2)
            for page in range(1, 3):
                urls_to_scrape.append((f"{url}&bbsSeqNo=84&pageIndex={page}", "general"))
                
            # 2. Search queries (pages 1 to 2 for "ai" and "인공지능")
            for keyword in ["ai", "인공지능"]:
                for page in range(1, 3):
                    urls_to_scrape.append((f"{url}&bbsSeqNo=84&searchOpt=NTT_SJ&searchTxt={keyword}&pageIndex={page}", "search"))
                    
            # Parse month names for MSIT dates (e.g. Jul 9, 2026 -> 2026-07-09)
            month_map = {
                "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
                "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
            }
            
            def parse_msit_date(date_str):
                if not date_str:
                    return ""
                match_eng = re.search(r'([A-Za-z]+)\s+(\d+),\s+(\d{4})', date_str)
                if match_eng:
                    mon_name, day, year = match_eng.groups()
                    mon = month_map.get(mon_name, "01")
                    return f"{year}-{mon}-{int(day):02d}"
                match_iso = re.search(r'(\d{4})[.-](\d{2})[.-](\d{2})', date_str)
                if match_iso:
                    year, mon, day = match_iso.groups()
                    return f"{year}-{mon}-{day}"
                return date_str

            for fetch_url, url_type in urls_to_scrape:
                try:
                    if fetch_url == f"{url}&bbsSeqNo=84&pageIndex=1":
                        page_soup = soup
                    else:
                        print(f"[Scraper] Fetching MSIT page: {fetch_url}")
                        page_res = requests.get(fetch_url, headers=config.HEADERS, timeout=15, verify=False)
                        page_res.encoding = 'utf-8'
                        page_soup = BeautifulSoup(page_res.text, "html.parser")
                        
                    # Find the script block containing row assignments
                    script_text = ""
                    for script in page_soup.find_all('script'):
                        text = script.string or script.get_text()
                        if "td_" in text and "sHtml" in text:
                            script_text = text
                            break
                            
                    if not script_text:
                        continue
                        
                    # 1. Parse all dates from this script
                    date_pattern = r"\$\('#td_'\+'REG_DT'\+'_(\d+)'\)\.html\('([^']+)'\);"
                    date_matches = re.findall(date_pattern, script_text)
                    dates_by_index = {int(idx_str): parse_msit_date(raw_date) for idx_str, raw_date in date_matches}
                    
                    # 2. Extract keys from onclick attributes in the page HTML
                    keys_by_index = {}
                    for a in page_soup.find_all('a', onclick=True):
                        onclick = a['onclick']
                        onclick_match = re.search(r'fn_detail\((\d+)\)', onclick)
                        if onclick_match:
                            key = onclick_match.group(1)
                            child_div = a.find('div', id=True)
                            if child_div:
                                id_str = child_div['id']
                                idx_match = re.search(r'_(\d+)$', id_str)
                                if idx_match:
                                    idx = int(idx_match.group(1))
                                    keys_by_index[idx] = key
                                    
                    # 3. Split the script into blocks for each row
                    blocks = script_text.split("var sHtml = replyHrml;")
                    for idx, block in enumerate(blocks[1:]):
                        # Extract NTTSeqNo (key)
                        key_match = re.search(r'fn_detail\((\d+)\)', block)
                        key = key_match.group(1) if key_match else keys_by_index.get(idx, "")
                        
                        # Extract title text from unescape calls
                        title_parts = re.findall(r"unescape\('([^']+)'\)", block)
                        title = ""
                        for part in title_parts:
                            import urllib.parse
                            decoded = urllib.parse.unquote(part)
                            if decoded and decoded not in ["ctgryHtml", "newHtml", "replyHrml"]:
                                title += decoded
                                
                        post_date = dates_by_index.get(idx, "")
                        
                        if title and key:
                            link = f"https://www.msit.go.kr/bbs/view.do?sCode=user&mPid=103&mId=109&nttSeqNo={key}"
                            items.append({
                                "source": name,
                                "title": title.strip(),
                                "link": link,
                                "post_date": post_date,
                                "collected_at": get_current_timestamp()
                            })
                except Exception as page_err:
                    print(f"[Scraper Warning] Failed to fetch MSIT subpage {fetch_url}: {page_err}")

        elif parser_type is None:
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
    # Add keywords to filter out from titles (Exclusion keywords)
    # Example: "마감", "종료", "서울", "경기"
]

INCLUDE_KEYWORDS = [
    # Add keywords to strictly require in titles (Inclusion keywords)
    "ai",
    "인공지능",
    "인공 지능"
]

def should_filter_project(title: str) -> bool:
    """Returns True if the project title should be filtered out.
    
    If INCLUDE_KEYWORDS is defined, only titles containing at least one inclusion keyword
    (case-insensitive) are kept. Titles containing any FILTER_KEYWORDS are excluded.
    """
    if not title:
        return True
        
    title_lower = title.lower()
    
    # 1. Exclusion Check (Filter out if matches any exclusion keyword)
    if FILTER_KEYWORDS:
        for keyword in FILTER_KEYWORDS:
            if keyword in title_lower:
                return True
                
    # 2. Inclusion Check (Filter out if does not match any inclusion keyword)
    if INCLUDE_KEYWORDS:
        has_inclusion = any(keyword in title_lower for keyword in INCLUDE_KEYWORDS)
        if not has_inclusion:
            return True # Filter out since it doesn't contain the target keywords
            
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
