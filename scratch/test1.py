import sys
import os
import pandas as pd
from unittest.mock import patch
import requests

sys.path.append(r"n:\gitt\SatyaFasal\scripts")
import fetch_satellite_rainfall

df = pd.read_csv(r"n:\gitt\SatyaFasal\data\karnataka_villages.csv")
row = df.iloc[0]

orig_post = requests.post
def mock_post(*args, **kwargs):
    print(f"\n--- HTTP POST to {args[0]} ---")
    resp = orig_post(*args, **kwargs)
    print(f"Status Code: {resp.status_code}")
    print(f"Body: {resp.text[:1000]}...")
    return resp

orig_get = requests.get
def mock_get(*args, **kwargs):
    print(f"\n--- HTTP GET to {args[0]} ---")
    resp = orig_get(*args, **kwargs)
    print(f"Status Code: {resp.status_code}")
    print(f"Body: {resp.text[:1000]}...")
    return resp

def main():
    print("Checking .env for credentials:")
    from dotenv import dotenv_values
    env_vars = dotenv_values(r"n:\gitt\SatyaFasal\.env")
    client_id = env_vars.get("COPERNICUS_CLIENT_ID") or os.environ.get("COPERNICUS_CLIENT_ID")
    client_secret = env_vars.get("COPERNICUS_CLIENT_SECRET") or os.environ.get("COPERNICUS_CLIENT_SECRET")
    
    print(f"COPERNICUS_CLIENT_ID loaded? {bool(client_id)}")
    if client_id:
        print(f"COPERNICUS_CLIENT_ID: {client_id[:4]}...{client_id[-4:] if len(client_id)>8 else ''}")
        
    print(f"COPERNICUS_CLIENT_SECRET loaded? {bool(client_secret)}")
    if client_secret:
        print(f"COPERNICUS_CLIENT_SECRET: {client_secret[:4]}...{client_secret[-4:] if len(client_secret)>8 else ''}")

    # Initialize auth anyway with empty strings if None so it proceeds to hit the API
    auth = fetch_satellite_rainfall.CopernicusAuth(client_id or "", client_secret or "")

    # Disable cache to hit network
    if os.path.exists(fetch_satellite_rainfall.CACHE_PATH):
        os.remove(fetch_satellite_rainfall.CACHE_PATH)
    fetch_satellite_rainfall._cache = {}

    with patch('requests.post', side_effect=mock_post), \
         patch('requests.get', side_effect=mock_get):
        fetch_satellite_rainfall.process_village_row(row, auth)

if __name__ == '__main__':
    main()
