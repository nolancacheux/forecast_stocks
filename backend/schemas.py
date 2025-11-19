from pydantic import BaseModel
from typing import List, Optional, Dict, Union

class PredictionRequest(BaseModel):
    ticker: str = "SPY"
    model: str = "xgboost"
    horizon: int = 14
    reference_date: Optional[str] = None # YYYY-MM-DD format

class PredictionResponse(BaseModel):
    ticker: str
    model: str
    direction: str
    probability: float
    feature_importance: Optional[Dict[str, float]] = None
    predicted_price: Optional[float] = None
    forecast_dates: Optional[List[str]] = None
    forecast_values: Optional[List[float]] = None
    confidence_interval: Optional[List[float]] = None

class BacktestRequest(BaseModel):
    ticker: str = "SPY"
    model: str = "xgboost"
    start_date: str
    end_date: str

class HistoryRequest(BaseModel):
    ticker: str = "SPY"
    period: str = "2y"
