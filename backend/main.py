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
        processor.fetch_data() # Default 2y
        processor.add_indicators()
        df = processor.prepare_target(request.horizon)
        
        # 2. Train Model
        engine = ModelEngine()
        # Train on all data except last horizon (where target is unknown?)
        # Actually, prepare_target drops rows where target is NaN (the last horizon_days).
        # So df contains only data with known targets.
        # We train on this.
        
        # But we need to predict for the LATEST data point (today).
        # 'df' from prepare_target has removed the last 'horizon' rows.
        # So we need the original full dataframe for prediction input.
        
        # Let's get the full dataframe with indicators
        processor.fetch_data() # Re-fetch or we should have stored it?
        # DataProcessor stores self.df. 
        # But prepare_target modifies self.df to drop NaNs.
        # We should have a method to get training data and prediction data.
        
        # Re-instantiate or better usage of DataProcessor needed.
        # Let's optimize:
        
        processor = DataProcessor(request.ticker)
        raw_df = processor.fetch_data()
        df_with_indicators = processor.add_indicators()
        
        # Create training set (drop NaNs from indicators)
        train_df = processor.prepare_target(request.horizon) # This drops last 14 rows
        
        # Train
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
