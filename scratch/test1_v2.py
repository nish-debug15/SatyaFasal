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
    if args[0] == fetch_satellite_rainfall.CDSE_TOKEN_URL:
        return orig_post(*args, **kwargs)
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

def mock_get_token(*args, **kwargs):
    return "fake_token"

def main():
    auth = fetch_satellite_rainfall.CopernicusAuth("fake_id", "fake_secret")
    # Bypass auth token generation for test
    auth.get_token = mock_get_token
    
    # Disable cache to hit network
    if os.path.exists(fetch_satellite_rainfall.CACHE_PATH):
        os.remove(fetch_satellite_rainfall.CACHE_PATH)
    fetch_satellite_rainfall._cache = {}

    with patch('requests.post', side_effect=mock_post), \
         patch('requests.get', side_effect=mock_get):
        fetch_satellite_rainfall.process_village_row(row, auth)

if __name__ == '__main__':
    main()
