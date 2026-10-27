# REint UK Day-Ahead Wind Power & Thermal Procurement Decision Portal

A full-stack wind forecast accuracy and shortfall-risk analytics application for a UK utility trading team operating in the Great Britain Day-Ahead Wholesale Electricity Market (EPEX Spot / N2EX).

Built using **React (TypeScript, custom responsive CSS, and Recharts)** on the frontend and **Python (FastAPI + Pydantic + HTTPX)** on the backend. The app can run as two Docker Compose services or as one container from the root `Dockerfile`.

---

## 1. Domain Context & Problem Formulation

In Great Britain, electricity utilities purchase power in the **Day-Ahead Market** on **Day $D-1$** to cover their consumers' demand across all **48 half-hourly Settlement Periods (SP 1 to SP 48)** of **Delivery Day $D$**:
- **EPEX Spot Day-Ahead 60-Minute Auction**: Gate closure at **09:20 UTC** on Day $D-1$
- **N2EX (Nord Pool) Day-Ahead Hourly Auction**: Gate closure at **09:50 UTC** on Day $D-1$
- **Standard UK Utility Day-Ahead Trading Desk Cutoff**: **11:00 UTC** on Day $D-1$ (desk cutoff; the selected `WINDFOR` vintage is determined from each record’s `publishTime`)
- **EPEX Spot Day-Ahead 30-Minute Half-Hourly Auction**: Gate closure at **15:30 UTC** on Day $D-1$
- **EPEX Intraday 1 Auction**: Gate closure at **17:30 UTC** on Day $D-1$

Because wind generation is weather-dependent, any **over-forecast** ($\hat{W}_t > W_t$) creates an unexpected **wind shortfall** during delivery, forcing the utility to buy expensive top-up power in the intraday market or pay Elexon Balancing Mechanism (BM) imbalance charges.

The January snapshots in this repository were fetched from Elexon's live [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) and [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream). They contain 1,488 half-hourly FUELHH actuals and 18,080 WINDFOR records across 744 hourly target times. WINDFOR target times in the returned dataset are hourly; this differs from the half-hourly cadence described in the challenge brief.

### Point-in-Time Forecast Alignment

For each 30-minute FUELHH target on delivery day D, the engine selects the latest WINDFOR publication available by the selected cutoff on D−1. The live Elexon WINDFOR records in this January snapshot have hourly target times, so the same hourly forecast is applied to both half-hour FUELHH intervals in that hour. Each interval still uses its own exact D−1 cutoff and lead time.

The selected publication time is read from the API data rather than assumed from a nominal run schedule. In this snapshot the modal selected publication is 07:30 for the 09:20 cutoff, 09:30 for 09:50 and 11:00, and 15:30 for both 15:30 and 17:30.

### Wind Shortfall Buffer

The signed error is `forecast - actual`; a positive value means wind was over-forecast. The portal reports the non-negative empirical P50–P99 error quantile as a wind shortfall buffer. These Elexon streams contain generation data only, so the buffer is not a total thermal procurement recommendation. Calculating total procurement would require a demand forecast outside this assignment's source scope.

### Forecast Vintage Replay

On the Decision Desk, select a delivery interval on the wind chart or use the keyboard-accessible interval scrubber to inspect its forecast publication history. The replay plots each WINDFOR vintage against the realized FUELHH outturn and highlights the exact vintage selected by the point-in-time analysis for the current gate closure. Later revisions are visible for context but are not used in the historical decision-time score. This makes forecast revisions and the no-look-ahead rule inspectable at interval level.

---

## 2. Key January 2026 Quantitative Findings (Elexon `FUELHH` & `WINDFOR`)

| Day-Ahead Decision Cutoff (Day D-1) | Most-used Elexon `publishTime` | Lead Horizon Range | MAE (MW) | RMSE (MW) | Mean Bias (MW) | MAPE (%) | P90 Shortfall Buffer (MW) | P95 Shortfall Buffer (MW) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **09:20 UTC** (EPEX 60-Min DA) | `07:30 UTC` (D-1) | 16.5h – 40.0h | 2,145.2 MW | 2,615.8 MW | +1,851.9 MW | 22.44% | **+4,291 MW** | **+5,342 MW** |
| **09:50 UTC** (N2EX Hourly DA) | `09:30 UTC` (D-1) | 14.5h – 38.0h | 2,126.1 MW | 2,620.8 MW | +1,840.3 MW | 22.13% | **+4,363 MW** | **+5,382 MW** |
| **11:00 UTC** (DA Trading Desk Standard) | `09:30 UTC` (D-1) | 14.5h – 38.0h | 2,126.1 MW | 2,620.8 MW | +1,840.3 MW | 22.13% | **+4,363 MW** | **+5,382 MW** |
| **15:30 UTC** (EPEX 30-Min Half-Hourly DA) | `15:30 UTC` (D-1) | 8.5h – 32.0h | 1,984.5 MW | 2,447.6 MW | +1,816.9 MW | 18.57% | **+4,030 MW** | **+4,744 MW** |
| **17:30 UTC** (EPEX Intraday 1 D-1) | `15:30 UTC` (D-1) | 8.5h – 32.0h | 1,984.5 MW | 2,447.6 MW | +1,816.9 MW | 18.57% | **+4,030 MW** | **+4,744 MW** |

The horizon curve compares each hourly WINDFOR value with the mean of its two corresponding FUELHH half-hours. MAE rises from **1,772.3 MW** at `0–6h` to **2,059.8 MW** at `18–24h` and **2,422.3 MW** at `42–48h`. Some adjacent gate cutoffs share a result when the source has no newer eligible forecast between them.

---

## 3. Repository Structure (Files & Directories)

```text
reint_uk_wind_day_ahead_portal/
├── README.md                              # Project documentation, setup, deployment & AI disclosure
├── Dockerfile                             # Combined image: FastAPI API plus compiled React app
├── docker-compose.yml                     # Multi-container orchestration (FastAPI backend + React/Nginx frontend)
├── vercel.json                            # Vercel API and static frontend routing
├── .gitignore                             # Local environments, caches, and build output
├── .dockerignore                          # Keeps local environments and build output out of Docker contexts
├── reint_wind_day_ahead_portal.html       # Legacy standalone prototype; the maintained app is in frontend/ and backend/
├── backend/                               # Python FastAPI Backend Service
│   ├── Dockerfile                         # Backend container specification
│   ├── requirements.txt                   # Python dependencies (FastAPI, Uvicorn, HTTPX, Pydantic, Pytest)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                        # FastAPI routes (/api/health, /api/v1/day-ahead/analysis, /api/v1/forecasts/evolution)
│   │   ├── analytics.py                   # Temporal join engine, horizon bucketing & quantile risk buffer calculator
│   │   ├── elexon_client.py               # Elexon BMRS API client (/datasets/FUELHH/stream & /datasets/WINDFOR/stream) + cache
│   │   ├── schemas.py                     # Strict Pydantic v2 data models
│   │   └── data/
│   │       ├── fuelhh_jan2026.json        # 1,488 half-hourly WIND actuals (Jan 1 – Jan 31, 2026)
│   │       └── windfor_jan2026.json       # 18,080 hourly WINDFOR forecasts for January 2026 target periods
│   └── tests/
│       └── test_analytics.py              # Dataset integrity and point-in-time alignment tests
└── frontend/                              # React 18 + TypeScript + Vite + responsive CSS Frontend
    ├── Dockerfile                         # Frontend multi-stage Node build + Nginx production server
    ├── public/favicon.svg                 # REint wind-mark browser favicon
    ├── nginx.conf                         # Static hosting, SPA fallback, and /api proxy to FastAPI
    ├── index.html                         # HTML entry point
    ├── package.json                       # Frontend dependencies (React 18, Recharts, Lucide, Tailwind)
    ├── package-lock.json                   # Locked frontend dependency tree
    ├── tsconfig.json                      # TypeScript compiler configuration
    ├── vite.config.ts                     # Vite build & /api proxy configuration
    ├── tailwind.config.js                 # Tailwind CSS configuration
    └── src/
        ├── main.tsx                       # React DOM mount
        ├── App.tsx                        # Interactive 3-tab portal with interval-level forecast vintage replay
        ├── services/
        │   └── apiClient.ts               # Typed REST client for the FastAPI backend
        └── types/
            └── api.ts                     # TypeScript interfaces matching backend Pydantic schemas
```

---

## 4. How to Start the Application

### Option A: Using Docker Compose (Recommended)
```bash
docker compose up --build
```
- **React Frontend Portal**: `http://localhost:5173`
- **FastAPI Backend & Swagger Docs**: `http://localhost:8000/docs`

### Option B: Local Development (Python + Node.js)
1. **Start the Python FastAPI Backend**. In Windows PowerShell, from the project root run:
   If Docker Compose is already running, stop it first with `docker compose stop` from the project root so it releases ports 8000 and 5173.
   ```powershell
   cd backend
   py -3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```
   Run the commands one at a time. Using the virtual environment's Python directly avoids needing to activate it. To use the bundled snapshot, no environment variables are needed. To query the live Elexon API in PowerShell, set `$env:USE_LIVE_ELEXON_API="true"` before starting Uvicorn.

   On macOS or Linux, use `python3 -m venv .venv`, `source .venv/bin/activate`, `python -m pip install -r requirements.txt`, then `python -m uvicorn app.main:app --reload --port 8000` from `backend/`.

   To keep Docker running, start the local backend on a free port such as 8001 from `backend/`:
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
   ```
   Before starting the local Vite frontend, set `$env:VITE_API_BASE_URL="http://localhost:8001"` in PowerShell. Docker already reserves 8000 and 5173 in this project, so Vite may choose 5174; open the URL it prints.

2. **Start the React Vite Frontend**:
   ```bash
   cd frontend
   npm ci
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Run Backend Unit Tests**:
   ```bash
   cd backend
   PYTHONPATH=. pytest tests/test_analytics.py
   ```

---

## 5. Deployment

The root `Dockerfile` builds a single image that serves the compiled React app from FastAPI and exposes the API on the same origin. Build and run it with:

```bash
docker build -t reint-wind-portal .
docker run --rm -p 8000:8000 reint-wind-portal
```

For a split deployment, `docker-compose.yml` serves the frontend through Nginx and proxies `/api/` to the backend service. The Vercel manifest is included for deployment, but a public deployment URL has not yet been configured.

To deploy the root container to Heroku, create an app, then use Heroku Container Registry (`heroku container:login`, `heroku container:push web --app <app-name>`, and `heroku container:release web --app <app-name>`). A hosted URL, public repository, and demo video have not yet been published.

---

## 6. Explicit AI Tool Usage Disclosure

In accordance with the challenge instructions :
- **AI Assistance Disclosure**: Gemini was used in the initial implementation. OpenAI Codex was used to review the challenge brief and Elexon API documentation, validate and replace the January snapshot data, refine the point-in-time analytics, improve the interface, and repair container configuration. The backend test suite covers point-in-time alignment and forecast data integrity.

## Developer
<table>
    <tr align="center">
        <td>
        Sandhit Karmakar
        <p align="center">
            <img src = "https://avatars.githubusercontent.com/u/90787826?v=4" width="150" height="150" alt="Dhruv Shah">
        </p>
            <p align="center">
                <a href="https://github.com/Sandhit06">
                    <img src="https://res.cloudinary.com/dyz1paeem/image/upload/v1793130084/round-collaboration-social-github-code-circle-network-icon_rk5x5t.svg" width="36" height="36" alt="GitHub"/>
                </a>
                <a href="https://www.linkedin.com/in/sandhit-karmakar/" target="_blank">
                    <img src="https://res.cloudinary.com/dyz1paeem/image/upload/v1793130084/network-linkedin-social-connection-circular-circle-media-icon_vdou3m.svg" width="36" height="36" alt="LinkedIn"/>
                </a>
                <a href="mailto:sandhitkarmakar@gmail.com" target="_blank">
                    <img src="https://res.cloudinary.com/dyz1paeem/image/upload/v1793129062/share-send-email-chat-circle-message-mail-icon_u4rx53.svg" width="36" height="36" alt="Email"/>
                </a>
            </p>
        </td>
    </tr>
</table>

<p align="center">
    Made with ❤️ by <a href="https://github.com/Sandhit06">Sandhit Karmakar</a>
</p>
