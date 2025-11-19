import pytest
import pandas as pd
from data_processor import DataProcessor

def test_data_processor_pipeline():
    processor = DataProcessor("SPY")
    
    # Test Fetch
    # We'll use a short period to be fast
    df = processor.fetch_data(period="1mo")
    assert not df.empty
    assert "Close" in df.columns
    
    initial_rows = len(df)
    
    # Test Indicators
    df = processor.add_indicators()
    # Check for some indicators
    assert "RSI_14" in df.columns or "RSI" in df.columns # pandas-ta default naming
    # pandas-ta naming often includes length, e.g. EMA_20
    assert "EMA_20" in df.columns
    
    # Test Target
    horizon = 5
    df = processor.prepare_target(horizon_days=horizon)
    assert "Target_Direction" in df.columns
    # We expect rows to decrease by horizon
    # Note: add_indicators might have introduced NaNs at the beginning (lookback period)
    # prepare_target introduces NaNs at the end.
    # The method itself drops NaNs for target but let's check logic.
    
    # If we didn't drop NaNs in add_indicators yet (we do it in get_processed_data usually or manually),
    # prepare_target drops rows where Future_Close is NaN.
    
    assert len(df) <= initial_rows - horizon

def test_empty_ticker():
    processor = DataProcessor("INVALID_TICKER_XYZ_123")
    # yfinance usually returns empty df for invalid ticker
    with pytest.raises(ValueError):
        processor.fetch_data()

