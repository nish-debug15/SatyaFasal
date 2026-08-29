import os
from dotenv import dotenv_values

def main():
    env_vars = dotenv_values(r"n:\gitt\SatyaFasal\.env")
    c_id = env_vars.get("COPERNICUS_CLIENT_ID")
    c_secret = env_vars.get("COPERNICUS_CLIENT_SECRET")
    d_key = env_vars.get("DATA_GOV_API_KEY")

    def mask(val):
        if not val:
            return "MISSING or EMPTY"
        return f"{val[:4]}...{val[-4:] if len(val)>8 else ''}"
        
    print(f"COPERNICUS_CLIENT_ID: {mask(c_id)}")
    print(f"COPERNICUS_CLIENT_SECRET: {mask(c_secret)}")
    print(f"DATA_GOV_API_KEY: {mask(d_key)}")
    
if __name__ == '__main__':
    main()
