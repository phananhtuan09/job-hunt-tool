#!/usr/bin/env python3
"""JobSpy CLI wrapper that prints a JSON list of jobs to stdout."""
import argparse
import json
import sys
from datetime import date, datetime
import pandas as pd


def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if pd.isna(obj):
        return None
    raise TypeError(f"Type {type(obj)} not serializable")


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
            # Replace NaN with None
            jobs_df = jobs_df.where(pd.notnull(jobs_df), None)
            records = jobs_df.to_dict(orient="records")

        # Serialize cleanly
        sys.stdout.write(json.dumps(records, default=json_serial))
        sys.stdout.flush()
    except Exception as exc:
        sys.stderr.write(f"JobSpy scrape error: {exc}\n")
        # Exit with code 2 for scraping error so Node adapter can isolate it
        sys.exit(2)


if __name__ == "__main__":
    main()
