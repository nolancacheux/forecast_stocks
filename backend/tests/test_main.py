from fastapi.testclient import TestClient
from main import app
from unittest.mock import MagicMock, patch
import pandas as pd
import numpy as np

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "MarketFocus AI API is running"}

@patch('main.DataProcessor')
@patch('main.ModelEngine')
def test_predict_endpoint(MockModelEngine, MockDataProcessor):
    # Mock DataProcessor
    mock_processor = MockDataProcessor.return_value
    
    # Create dummy df
    dates = pd.date_range(start="2023-01-01", periods=50)
    df = pd.DataFrame({
        "Open": np.random.rand(50),
        "High": np.random.rand(50),
        "Low": np.random.rand(50),
        "Close": np.random.rand(50),
        "Volume": np.random.rand(50),
        "Date": dates
    })
    df.set_index("Date", inplace=True)
    
    mock_processor.fetch_data.return_value = df
    mock_processor.add_indicators.return_value = df
    supervised = df.copy()
    supervised["target_h1"] = supervised["Close"].shift(-1)
    supervised = supervised.dropna()
    X = supervised[["Open", "High", "Low", "Close"]]
    y = supervised[["target_h1"]]
    mock_processor.build_supervised_dataset.return_value = (X, y, X.columns.tolist())
    
    # Mock ModelEngine
    mock_engine = MockModelEngine.return_value
    mock_engine.predict.return_value = {
        "direction": "UP",
        "probability": 0.8,
        "feature_importance": {"RSI": 0.5},
        "predicted_price": 1.0,
        "forecast_dates": ["2024-01-01"],
        "forecast_values": [1.0],
        "confidence_interval": {
            "lower": [0.9],
            "upper": [1.1]
        }
    }
    
    payload = {
        "ticker": "SPY",
        "model": "xgboost",
        "horizon": 14
    }
    
    response = client.post("/api/predict", json=payload)
    if response.status_code != 200:
        print(response.json())
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "SPY"
    assert data["direction"] == "UP"
    assert data["probability"] == 0.8
    assert "feature_importance" in data

@patch('main.DataProcessor')
def test_history_endpoint(MockDataProcessor):
    mock_processor = MockDataProcessor.return_value
    dates = pd.date_range(start="2023-01-01", periods=10)
    df = pd.DataFrame({
        "Close": np.random.rand(10),
        "Date": dates
    })
    df.set_index("Date", inplace=True)
    mock_processor.fetch_data.return_value = df
    
    response = client.get("/api/history?ticker=SPY&period=1mo")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 10
    assert "Close" in data[0]
    assert "Date" in data[0]
