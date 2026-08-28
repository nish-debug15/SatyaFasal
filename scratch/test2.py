import sys
import os
from unittest.mock import patch
import requests

sys.path.append(r"n:\gitt\SatyaFasal\scripts")
import fetch_pmfby_claims

orig_get = requests.get
def mock_get(*args, **kwargs):
    print(f"\n--- HTTP GET to {args[0]} ---")
    resp = orig_get(*args, **kwargs)
    print(f"Status Code: {resp.status_code}")
    print(f"Body: {resp.text[:1000]}...")
    return resp

def main():
    print("Checking .env for PMFBY API KEY:")
    from dotenv import dotenv_values
    env_vars = dotenv_values(r"n:\gitt\SatyaFasal\.env")
    api_key = env_vars.get("DATA_GOV_API_KEY") or os.environ.get("DATA_GOV_API_KEY")
    
    print(f"DATA_GOV_API_KEY loaded? {bool(api_key)}")
    if api_key:
        print(f"DATA_GOV_API_KEY: {api_key[:4]}...{api_key[-4:] if len(api_key)>8 else ''}")

    api_key = api_key or ""
    resource_id = fetch_pmfby_claims.DEFAULT_PMFBY_RESOURCE_IDS[0]

    with patch('requests.get', side_effect=mock_get):
        fetch_pmfby_claims.phase_a_schema_discovery(resource_id, api_key)

if __name__ == '__main__':
    main()
