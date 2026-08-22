# SatyaFasal

Satellite and weather based verification layer for PMFBY crop insurance claims.
Smart India Hackathon 2026

## Problem

PMFBY, India's main crop insurance scheme, has a well documented gaming problem. Claims get filed for crop loss that didn't happen, or the same plot gets claimed twice under different names. Verification today relies on manual field surveys that don't scale to claim volume. This is a real financial leakage problem for insurers and the government subsidy behind the scheme, and it indirectly hurts genuine farmers by making insurers more conservative on payouts and pricing.

## What This Is

FasalTruth cross checks what a claim says against two independent, objective, public signals: satellite observed crop health over the claimed period, and IMD rainfall data for that period. If a claim cites drought but satellite imagery shows a healthy canopy and rainfall was normal, that's a flagged mismatch with a plain language explanation attached.

## What This Is Not

This is not a fraud determination system. It does not auto reject or auto approve claims. It produces a risk score and an explanation, and routes flagged claims to a human insurance reviewer. A false positive here means a genuine farmer gets extra scrutiny, which is a real cost, so the confidence bar for any flag is set high on purpose and every flag ends with a human in the loop.

## How It Works

**Satellite and weather signal extraction**
Pulls Sentinel-2 NDVI and NDWI for the claimed plot across a before, during, and after window. Falls back to Sentinel-1 VV/VH backscatter when Sentinel-2 tiles are more than 50 percent cloudy, since optical imagery alone is unreliable under cloud cover. Pulls IMD rainfall data for the same district and window to check the claimed cause against actual weather.

**Anomaly and duplicate detection**
Claim narrative, structured metadata, and the extracted satellite and weather signals get combined into a feature representation per claim, then clustered with HDBSCAN to separate claims where the signals match the narrative from claims where they don't. A separate check compares plot geometry and metadata across claims to catch the same plot claimed twice under different names.

**Explanation layer**
Flagged claims get a plain language explanation built from the deterministic numbers already computed, the NDVI delta, the rainfall delta, the cluster assignment. The language model only phrases these numbers into readable text. It doesn't reason over raw satellite data or make its own call on whether a claim is suspicious, that judgment comes from the clustering and threshold step upstream.

**Human review**
Every flag, its risk score, the triggering signals, and the explanation go to a reviewer queue. Nothing auto rejects or auto approves.

## Tech Stack

- Satellite data: Sentinel-1/2 via Copernicus / Sentinel Hub, or ISRO-NRSC Bhoonidhi / Bhuvan
- Weather data: IMD gridded rainfall data
- Embeddings: sentence-transformers on claim narrative text, combined with structured numerical features
- Clustering: HDBSCAN
- Explanation generation: Groq (free tier), phrasing only, not risk determination
- Backend: FastAPI
- Frontend: Next.js reviewer dashboard, deployed on Vercel free tier

## MVP Scope

Demo built on Karnataka, using the Bhoomi cadastral layer, with plot boundaries verified to under 5 metre accuracy for the sample set. Runs on a curated set of real plot locations with a mix of synthetic claim narratives, some matching the satellite record and some deliberately mismatched, plus a small set of overlapping plot entries to demo duplicate detection live.

## Known Limitations

- Cloud cover limits optical NDVI reliability for a given window, mitigated but not eliminated by the Sentinel-1 fallback
- Duplicate detection accuracy depends on cadastral data quality, which varies by state. This build is scoped to Karnataka only
- NDVI and rainfall can't capture every legitimate loss cause, pest attacks and localized hail damage in particular may not show up in either signal
- This is a screening layer that narrows down what a reviewer should look at, not a replacement for field verification

## Future Scope

Expand to more states as cadastral data quality allows, integrate with insurer claim management systems so flags and explanations flow into existing reviewer workflows instead of a standalone dashboard.

## Team

RV University, Bangalore

- Nishit Patel
- Jaineesh Patel
- Rahul Kiran
- Niteesh Balajee
- Ragashree R
- Pranav Adhikari
