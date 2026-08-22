#!/usr/bin/env python3
"""Collect publicly visible Oita machine-level slot data from slodata-lab.com.

The collector only reads pages that are publicly reachable without login and writes
normalized rows to the Supabase oita_machine_daily table. Duplicate rows are
upserted by the table's unique key.
"""

from __future__ import annotations

import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

PREFECTURE_URL = "https://slodata-lab.com/pages/prefectures/oita.html"
SOURCE_NAME = "slodata-lab"
JST = timezone(timedelta(hours=9))
USER_AGENT = "NumaDataCollector/1.0 (+public-data-research)"


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def parse_int(value: str | None) -> int | None:
    if not value:
        return None
    text = clean_text(value).replace(",", "").replace("+", "")
    if text in {"", "-", "—", "–"}:
        return None
    match = re.search(r"-?\d+", text)
    return int(match.group()) if match else None


def parse_float(value: str | None) -> float | None:
    if not value:
        return None
    text = clean_text(value).replace(",", "").replace("%", "")
    if text in {"", "-", "—", "–"}:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group()) if match else None


def get(url: str) -> requests.Response:
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "ja,en;q=0.8"},
        timeout=30,
    )
    response.raise_for_status()
    return response


def discover_report_urls(max_age_days: int = 7, max_reports: int = 80) -> list[str]:
    soup = BeautifulSoup(get(PREFECTURE_URL).text, "html.parser")
    cutoff = datetime.now(JST).date() - timedelta(days=max_age_days)
    found: list[tuple[date, str]] = []
    seen: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = str(link.get("href"))
        if "/pages/reports/" not in href:
            continue
        url = urljoin(PREFECTURE_URL, href)
        if url in seen:
            continue
        text = clean_text(link.get_text(" ", strip=True))
        match = re.search(r"(20\d{2}-\d{2}-\d{2})", text + " " + href)
        if not match:
            continue
        try:
            report_date = datetime.strptime(match.group(1), "%Y-%m-%d").date()
        except ValueError:
            continue
        if report_date < cutoff:
            continue
        seen.add(url)
        found.append((report_date, url))

    found.sort(reverse=True)
    return [url for _, url in found[:max_reports]]


def nearest_machine_heading(table: Tag) -> str | None:
    node = table.previous_sibling
    while node is not None:
        if isinstance(node, Tag):
            if node.name in {"h2", "h3", "h4"}:
                heading = clean_text(node.get_text(" ", strip=True))
                if heading and "機種" not in heading and "データ" not in heading:
                    return heading
            nested = node.find_all(["h2", "h3", "h4"])
            if nested:
                heading = clean_text(nested[-1].get_text(" ", strip=True))
                if heading and "機種" not in heading and "データ" not in heading:
                    return heading
        node = node.previous_sibling
    return None


def parse_report(url: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(get(url).text, "html.parser")
    title = clean_text((soup.find("h1") or soup.title).get_text(" ", strip=True) if (soup.find("h1") or soup.title) else "")
    match = re.search(r"(.+?)\s+(20\d{2}-\d{2}-\d{2})", title)
    if not match:
        print(f"skip: cannot parse shop/date: {url}", file=sys.stderr)
        return []

    shop_name = clean_text(match.group(1))
    play_date = match.group(2)
    rows: list[dict[str, Any]] = []

    for table in soup.find_all("table"):
        header_cells = table.find_all("th")
        headers = [clean_text(cell.get_text(" ", strip=True)) for cell in header_cells]
        if "台番" not in headers or not any(h in headers for h in ("差枚", "差枚/差玉")):
            continue
        if "G数" not in headers and "回転数" not in headers:
            continue

        machine_name = nearest_machine_heading(table) or "機種不明"
        for tr in table.find_all("tr"):
            cells = [clean_text(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
            if len(cells) != len(headers) or not cells:
                continue
            record = dict(zip(headers, cells))
            machine_number = clean_text(record.get("台番"))
            if not re.fullmatch(r"\d+", machine_number):
                continue

            net_text = record.get("差枚") or record.get("差枚/差玉")
            g_text = record.get("G数") or record.get("回転数")
            rows.append(
                {
                    "play_date": play_date,
                    "prefecture": "大分県",
                    "city": None,
                    "shop_name": shop_name,
                    "machine_name": machine_name,
                    "machine_number": machine_number,
                    "category": "slot",
                    "total_spins": parse_int(g_text),
                    "start_count": None,
                    "jackpot_count": None,
                    "first_hit_count": None,
                    "bb": parse_int(record.get("BB")),
                    "rb": parse_int(record.get("RB")),
                    "art_at": parse_int(record.get("ART") or record.get("AT")),
                    "combined_probability": parse_float(record.get("合成")),
                    "net_coins": parse_int(net_text),
                    "net_balls": None,
                    "payout_rate": parse_float(record.get("出率")),
                    "final_spins": None,
                    "slump_summary": None,
                    "source_name": SOURCE_NAME,
                    "source_url": url,
                    "raw_data": record,
                }
            )
    return rows


def upsert_supabase(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    base_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    endpoint = (
        f"{base_url}/rest/v1/oita_machine_daily"
        "?on_conflict=play_date,shop_name,machine_name,machine_number,source_name"
    )
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for start in range(0, len(rows), 500):
        batch = rows[start : start + 500]
        response = requests.post(endpoint, headers=headers, json=batch, timeout=60)
        if not response.ok:
            raise RuntimeError(f"Supabase write failed {response.status_code}: {response.text[:1000]}")


def main() -> int:
    urls = discover_report_urls(
        max_age_days=int(os.getenv("MAX_AGE_DAYS", "7")),
        max_reports=int(os.getenv("MAX_REPORTS", "80")),
    )
    print(f"discovered {len(urls)} recent Oita reports")
    all_rows: list[dict[str, Any]] = []

    for index, url in enumerate(urls, 1):
        try:
            parsed = parse_report(url)
            print(f"[{index}/{len(urls)}] {url}: {len(parsed)} rows")
            all_rows.extend(parsed)
        except Exception as exc:  # continue other halls if one source page changes
            print(f"warning: {url}: {exc}", file=sys.stderr)
        time.sleep(0.7)

    unique: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
    for row in all_rows:
        key = (
            row["play_date"],
            row["shop_name"],
            row["machine_name"],
            row["machine_number"],
            row["source_name"],
        )
        unique[key] = row

    rows = list(unique.values())
    upsert_supabase(rows)
    print(f"upserted {len(rows)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
