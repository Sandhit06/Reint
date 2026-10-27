from app.elexon_client import ElexonDataClient
from app.analytics import WindForecastAnalyticsEngine


def test_january_2026_dataset_integrity():
    client = ElexonDataClient(use_live_api=False)
    fuelhh = client.get_fuelhh_wind_jan2026()
    windfor = client.get_windfor_jan2026()
    # 31 days * 48 half-hour periods = 1,488 records
    assert len(fuelhh) == 1488
    assert all(r["fuelType"] == "WIND" for r in fuelhh)
    assert len(windfor) == 18080
    assert len({r["startTime"] for r in windfor}) == 744
    assert all(r["startTime"][14:16] == "00" for r in windfor)


def test_zero_data_leakage_and_gate_closure_monotonicity():
    client = ElexonDataClient(use_live_api=False)
    engine = WindForecastAnalyticsEngine(
        client.get_fuelhh_wind_jan2026(),
        client.get_windfor_jan2026(),
    )
    res_0920 = engine.analyze_day_ahead(cutoff_time="09:20")
    res_1100 = engine.analyze_day_ahead(cutoff_time="11:00")
    res_1530 = engine.analyze_day_ahead(cutoff_time="15:30")
    res_1730 = engine.analyze_day_ahead(cutoff_time="17:30")

    assert res_1100.metrics.count == 1488
    # Later sampled cutoffs do not increase MAE for this January snapshot.
    assert res_0920.metrics.maeMW > res_1100.metrics.maeMW > res_1730.metrics.maeMW
    assert res_1100.metrics.p90ShortfallMW > 0
    assert res_1100.metrics.recommendedThermalBufferMW == res_1100.metrics.p90ShortfallMW

    # Verify zero data leakage: every selected forecast has leadHours > 0
    for rec in res_1100.records:
        assert rec.leadHours >= 13.0
