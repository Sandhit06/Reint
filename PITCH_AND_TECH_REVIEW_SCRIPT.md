# Video Demo Guide & Speaker Script (Max 10 Minutes Total)

Per Section 3.1 of the challenge specification, the unlisted YouTube video must contain **two distinct parts** (max 5 minutes each, max 10 minutes total):
- **Part 1 (0:00 – 4:45)**: Customer Pitch & Pilot Output Presentation (to the UK Utility Day-Ahead Trading Desk)
- **Part 2 (4:45 – 9:30)**: Internal Technical Lead Review (Architecture, Design, Quantitative Methodology, Codebase & Engineering Practices)

---

## Part 1: Customer Pitch — Presenting the Pilot Portal to the UK Utility Trading Team (Max 5 Mins)

### [0:00 – 1:00] Executive Hook & The Day-Ahead Procurement Problem
- "Good morning team. Over this pilot engagement, we focused on the single biggest driver of imbalance exposure on your UK Day-Ahead trading desk: **national wind generation uncertainty between Day-Ahead gate closure on Day D-1 and physical delivery across the 48 half-hourly settlement periods of Day D**."
- "When your desk submits bids into the morning auctions (EPEX at 09:20, N2EX at 09:50, or your internal 11:00 GMT desk cutoff), you rely on National Grid ESO's `WINDFOR` forecasts published on Elexon BMRS. Whenever `WINDFOR` over-forecasts actual wind outturn (`FUELHH`), your utility faces a physical power deficit that must be covered in volatile intraday trading or Elexon imbalance settlement."

### [1:00 – 2:45] Live Demo — Tab 1: Day-Ahead Procurement Decision Desk
- **Show the Gate Closure Selector**: Switch between `09:20 UTC (EPEX 60m)`, `09:50 UTC (N2EX)`, `11:00 UTC (DA Desk Standard)`, and `15:30 UTC (EPEX 30m)`.
- **Inspect a delivery window**:
  - Filter January to compare half-hourly FUELHH outturn with the hourly WINDFOR target applied to its two half-hour intervals.
  - Explain that the portal reports an empirical wind shortfall buffer at the selected risk tolerance. The assignment provides no demand series, so this is not presented as total thermal procurement.

### [2:45 – 4:45] Live Demo — Tab 2: Quantitative Forecast Accuracy & Horizon Lab
- **Compare gate cutoffs against Elexon publication times**:
  - Show the Gate Closure Scorecard, which recomputes each cutoff from the selected date range and derives the most-used `publishTime` from the returned records.
  - In this snapshot, 09:50 and 11:00 select the same modal 09:30 publication, while 15:30 and 17:30 select 15:30. A later cutoff helps only when a newer forecast is published before closure.
- **Horizon Degradation Curve (0h to 48h)**:
  - Point to the Horizon Error chart: MAE rises from **1,772.3 MW** at `0–6h` to **2,059.8 MW** at `18–24h` and **2,422.3 MW** at `42–48h` in the Elexon snapshot.

---

## Part 2: Technical Lead Review — Architecture, Design, Analysis & Codebase (Max 5 Mins)

### [4:45 – 6:15] System Architecture & Data Pipeline
- **Show Tab 3 (Architecture & Tech Review Blueprint) and the Codebase**:
  - **Frontend (`frontend/`)**: React 18, TypeScript, Tailwind CSS, and Recharts, communicating via a typed REST client (`src/services/apiClient.ts`).
  - **Backend (`backend/`)**: Python 3.11 + FastAPI (`app/main.py`, `app/analytics.py`, `app/elexon_client.py`, `app/schemas.py`).
  - **Data Ingestion & Caching (`elexon_client.py`)**: Uses Elexon Insights Solution REST endpoints for FUELHH and WINDFOR, with a deterministic January snapshot fallback. The checked-in snapshot contains 1,488 half-hour actuals and 18,080 hourly forecast records across 744 hourly targets.

### [6:15 – 8:00] Core Algorithmic Design — Point-in-Time Alignment

- `FUELHH` supplies 1,488 half-hour actuals. `WINDFOR` supplies 18,080 forecast records across 744 hourly January targets.
- Each half-hour actual maps to its hour's WINDFOR target; the hourly forecast is held for both half-hours. The horizon curve compares hourly forecasts with the mean of each paired FUELHH reading.
- For each delivery interval, the engine filters to `publishTime <= D−1 cutoff` and chooses the newest eligible vintage. It uses the exact half-hour's lead time and prevents lookahead leakage.
- The portal reports wind shortfall buffers only. The two in-scope streams contain no demand series for calculating total thermal procurement.

### [8:00 – 9:30] Engineering Practices, Testing & Deployment
- **Automated Verification (`backend/tests/test_analytics.py`)**:
  - Covers dataset completeness (1,488 half-hour FUELHH actuals and 744 hourly WINDFOR targets), strict point-in-time cutoffs, and zero data leakage.
- **Containerization & Cloud Readiness**:
  - `docker-compose.yml` orchestrates both containers (`reint-wind-backend` on port 8000 and `reint-wind-frontend` on Nginx port 5173).
  - Root `Dockerfile`, `vercel.json`, and `Procfile` enable immediate deployment to Vercel or Heroku.
