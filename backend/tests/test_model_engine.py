import pytest
import pandas as pd
import numpy as np
from model_engine import ModelEngine

@pytest.fixture
def sample_data():
    dates = pd.date_range(start="2023-01-01", periods=150)
    df = pd.DataFrame({
        "Date": dates,
        "Open": np.random.rand(150) * 100,
        "High": np.random.rand(150) * 100,
        "Low": np.random.rand(150) * 100,
        "Close": np.linspace(100, 130, 150) + np.random.normal(0, 1, 150),
        "Volume": np.random.randint(1000, 10000, 150),
        "RSI": np.random.rand(150) * 100,
        "EMA_20": np.random.rand(150) * 100,
        "EMA_50": np.random.rand(150) * 100
    })
    df.set_index("Date", inplace=True)
    return df

@pytest.fixture
def supervised_sample(sample_data):
    df = sample_data
    supervised = df.copy()
    supervised["target_h1"] = supervised["Close"].shift(-1)
    supervised["target_h2"] = supervised["Close"].shift(-2)
    supervised = supervised.dropna()
    feature_cols = ["Open", "High", "Low", "Close", "Volume", "RSI", "EMA_20", "EMA_50"]
    X = supervised[feature_cols]
    y = supervised[["target_h1", "target_h2"]]
    return df, X, y

def test_train_xgboost(supervised_sample):
    df, X, y = supervised_sample
    engine = ModelEngine()
    metrics = engine.train((X, y), model_type="xgboost")
    assert metrics["model_type"] == "xgboost"
    prediction = engine.predict(df)
    assert "forecast_values" in prediction
    assert len(prediction["forecast_values"]) == y.shape[1]

def test_train_prophet(sample_data):
    engine = ModelEngine()
    metrics = engine.train(sample_data, model_type="prophet")
    assert metrics["model_type"] == "prophet"
    prediction = engine.predict(sample_data, horizon_days=5)
    assert "forecast_values" in prediction
    assert len(prediction["forecast_values"]) == 5

