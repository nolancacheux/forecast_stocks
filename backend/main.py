from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import PredictionRequest, PredictionResponse, BacktestRequest, HistoryRequest
from data_processor import DataProcessor
from model_engine import ModelEngine
import pandas as pd

app = FastAPI(title="MarketFocus AI API")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update with frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "MarketFocus AI API is running"}

@app.post("/api/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    try:
        # 1. Fetch Data
        processor = DataProcessor(request.ticker)
        processor.fetch_data() 
        df_with_indicators = processor.add_indicators()
        
        # 2. Train Model
        engine = ModelEngine()
        
        if request.model == "prophet":
            # Prophet needs the full time series history, not truncated labeled data
            # We train on the entire available history to predict the FUTURE
            engine.train(df_with_indicators, model_type=request.model)
        else:
            # Supervised models need labeled data (target known)
            # prepare_target drops the last 'horizon' rows where target is NaN
            train_df = processor.prepare_target(request.horizon)
            engine.train(train_df, model_type=request.model)
        
        # Predict on latest data
        # We need the row corresponding to "Today" (or most recent close).
        # df_with_indicators has the latest rows.
        prediction = engine.predict(df_with_indicators, horizon_days=request.horizon)
        
        return PredictionResponse(
            ticker=request.ticker,
            model=request.model,
            direction=prediction["direction"],
            probability=prediction.get("probability", 0.0),
            feature_importance=prediction.get("feature_importance"),
            predicted_price=prediction.get("predicted_price"),
            forecast_dates=prediction.get("forecast_dates"),
            forecast_values=prediction.get("forecast_values"),
            confidence_interval=prediction.get("confidence_interval")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
def get_history(ticker: str = "SPY", period: str = "1y"):
    try:
        processor = DataProcessor(ticker)
        df = processor.fetch_data(period=period)
        # Return JSON suitable for Recharts (array of objects)
        df = df.reset_index()
        # Ensure Date is string
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
