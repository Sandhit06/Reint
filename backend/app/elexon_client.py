import json
import os
import logging
from pathlib import Path
from typing import List, Dict, Any
import httpx

logger = logging.getLogger(__name__)

ELEXON_BASE_URL = os.getenv("ELEXON_API_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")
DATA_DIR = Path(__file__).parent / "data"


class ElexonDataClient:
    """
    Client for Elexon Insights Solution (BMRS) API endpoints:
      - /datasets/FUELHH/stream (Half-hourly generation outturn by fuel type, filtered to WIND)
      - /datasets/WINDFOR/stream (National Grid ESO wind generation forecast stream)

    Provides deterministic local cache fallback for January 2026 (`fuelhh_jan2026.json`
    and `windfor_jan2026.json`) so the portal runs instantaneously and offline/inside Docker.
    """

    def __init__(self, use_live_api: bool = False):
        self.use_live_api = use_live_api
        self._fuelhh_cache: List[Dict[str, Any]] = []
        self._windfor_cache: List[Dict[str, Any]] = []
        self._load_local_snapshot()

    def _load_local_snapshot(self) -> None:
        fuelhh_path = DATA_DIR / "fuelhh_jan2026.json"
        windfor_path = DATA_DIR / "windfor_jan2026.json"
        if fuelhh_path.exists():
            with open(fuelhh_path, "r", encoding="utf-8") as f:
                self._fuelhh_cache = json.load(f)
        if windfor_path.exists():
            with open(windfor_path, "r", encoding="utf-8") as f:
                self._windfor_cache = json.load(f)

    def get_fuelhh_wind_jan2026(self) -> List[Dict[str, Any]]:
        if not self.use_live_api and self._fuelhh_cache:
            return self._fuelhh_cache

        url = f"{ELEXON_BASE_URL}/datasets/FUELHH/stream"
        params = {
            "settlementDateFrom": "2026-01-01",
            "settlementDateTo": "2026-01-31",
            "fuelType": "WIND",
        }
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                return [r for r in data if r.get("fuelType") == "WIND"]
        except Exception as exc:
            logger.warning("Falling back to cached FUELHH snapshot: %s", exc)
            return self._fuelhh_cache

    def get_windfor_jan2026(self) -> List[Dict[str, Any]]:
        if not self.use_live_api and self._windfor_cache:
            return self._windfor_cache

        url = f"{ELEXON_BASE_URL}/datasets/WINDFOR/stream"
        params = {
            "publishDateTimeFrom": "2025-12-30T00:00:00Z",
            "publishDateTimeTo": "2026-01-31T23:59:59Z",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.warning("Falling back to cached WINDFOR snapshot: %s", exc)
            return self._windfor_cache
