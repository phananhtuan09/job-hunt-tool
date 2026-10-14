#!/usr/bin/env python3
"""JobSpy CLI wrapper that prints a JSON list of jobs to stdout."""
import argparse
import json
import math
import sys
from datetime import date, datetime
import pandas as pd


def clean_value(val):
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    try:
        if pd.isna(val):
            return None
    except Exception:
        pass
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: clean_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [clean_value(v) for v in val]
    return val


def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return None


def main():
    parser = argparse.ArgumentParser(description="Scrape jobs using JobSpy")
    parser.add_argument("--site", default="indeed", help="Sites separated by comma: linkedin, indeed")
    parser.add_argument("--search_term", required=True, help="Job title / keyword")
    parser.add_argument("--location", default="Vietnam", help="Location")
    parser.add_argument("--results_wanted", type=int, default=10, help="Number of results wanted")
    parser.add_argument("--hours_old", type=int, default=72, help="Max hours since posted")
    parser.add_argument("--country_indeed", default="vietnam", help="Country for Indeed")
    args = parser.parse_args()

    sites = [s.strip().lower() for s in args.site.split(",") if s.strip()]

    try:
        from jobspy import scrape_jobs

        jobs_df = scrape_jobs(
            site_name=sites,
            search_term=args.search_term,
            location=args.location,
            results_wanted=args.results_wanted,
            hours_old=args.hours_old,
            country_indeed=args.country_indeed,
            linkedin_fetch_description=True,
            verbose=0,
        )

        if jobs_df is None or jobs_df.empty:
            records = []
        else:
            raw_records = jobs_df.to_dict(orient="records")
            records = [{k: clean_value(v) for k, v in r.items()} for r in raw_records]

        # Serialize cleanly without NaN
        sys.stdout.write(json.dumps(records, default=json_serial, allow_nan=False))
        sys.stdout.flush()
    except Exception as exc:
        sys.stderr.write(f"JobSpy scrape error: {exc}\n")
        # Exit with code 2 for scraping error so Node adapter can isolate it
        sys.exit(2)


if __name__ == "__main__":
    main()
