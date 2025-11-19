import pytest
import pandas as pd
import numpy as np
from model_engine import ModelEngine

@pytest.fixture
def sample_data():
    # Create a dummy dataframe
    dates = pd.date_range(start="2023-01-01", periods=100)
    df = pd.DataFrame({
        "Date": dates,
        "Open": np.random.rand(100) * 100,
        "High": np.random.rand(100) * 100,
        "Low": np.random.rand(100) * 100,
        "Close": np.linspace(100, 110, 100) + np.random.normal(0, 1, 100),
        "Volume": np.random.randint(1000, 10000, 100),
        "RSI": np.random.rand(100) * 100,
        "EMA_20": np.random.rand(100) * 100,
        "Target_Direction": np.random.randint(0, 2, 100)
    })
    df.set_index("Date", inplace=True)
    return df

def test_train_xgboost(sample_data):
    engine = ModelEngine()
    metrics = engine.train(sample_data, model_type="xgboost")
    assert "accuracy" in metrics
    assert metrics["model_type"] == "xgboost"
    
    # Test Predict
    prediction = engine.predict(sample_data)
    assert "direction" in prediction
    assert "probability" in prediction
    assert "feature_importance" in prediction

def test_train_prophet(sample_data):
    engine = ModelEngine()
    # Prophet needs 'Date' column if not index, but our _train_prophet handles index
    metrics = engine.train(sample_data, model_type="prophet")
    assert metrics["model_type"] == "prophet"
    
    # Test Predict
    prediction = engine.predict(sample_data, horizon_days=5)
    assert "direction" in prediction
    assert "predicted_price" in prediction
    assert "forecast_values" in prediction
    assert len(prediction["forecast_values"]) == 5

