# file: scripts/serve_output.py
from flask import Flask, Response, jsonify, send_file
import pandas as pd
import os

# Resolve absolute path to the project root (parent of scripts/)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CSV_PATH = os.path.join(PROJECT_ROOT, "data", "processed", "satyafasal_satellite_rainfall_output.csv")

app = Flask(__name__)


@app.route("/satellite-rainfall")
def get_data():
    if not os.path.exists(CSV_PATH):
        # Explicit 404 with a message instead of a blank crash - tells you
        # immediately if this is a path problem rather than a data problem.
        return jsonify({
            "error": "CSV not found",
            "expected_path": CSV_PATH,
            "hint": "Run fetch_satellite_rainfall.py with --output "
                    "data/processed/satyafasal_satellite_rainfall_output.csv first"
        }), 404

    df = pd.read_csv(CSV_PATH)

    # pandas' own to_json() correctly handles numpy int64/float64/bool_ and
    # converts NaN -> null. jsonify(df.to_dict(...)) does NOT handle numpy
    # scalar types and throws "Object of type int64 is not JSON serializable"
    # - that TypeError is the most likely cause of the 500 you just saw.
    json_str = df.to_json(orient="records")
    return Response(json_str, mimetype="application/json")


@app.route("/satellite-rainfall/csv")
def get_csv():
    if not os.path.exists(CSV_PATH):
        return jsonify({"error": "CSV not found", "expected_path": CSV_PATH}), 404

    return send_file(
        CSV_PATH,
        mimetype="text/csv",
        as_attachment=True,
        download_name="satyafasal_satellite_rainfall_output.csv"
    )


if __name__ == "__main__":
    if not os.path.exists(CSV_PATH):
        print(f"WARNING: {CSV_PATH} does not exist yet - /satellite-rainfall will 404 until it does.")
    app.run(host="0.0.0.0", port=5000, debug=False)