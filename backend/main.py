from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import PredictionRequest, PredictionResponse, BacktestRequest, HistoryRequest, Metrics
from data_processor import DataProcessor
from model_engine import ModelEngine
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
from datetime import datetime

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
        
        # Filter by Start Date if provided
        if request.start_date:
            start_dt = pd.to_datetime(request.start_date)
            df_with_indicators = df_with_indicators[df_with_indicators.index >= start_dt]

        # Handle Backtesting/Reference Date
        train_cutoff = None
        actual_future_values = None
        
        if request.reference_date:
            ref_dt = pd.to_datetime(request.reference_date)
            if ref_dt > df_with_indicators.index[-1]:
                 pass
            else:
                 train_cutoff = ref_dt
                 # Extract actual future values for metrics
                 # We need data AFTER ref_dt up to horizon
                 # Note: Index is DatetimeIndex
                 future_mask = (df_with_indicators.index > ref_dt)
                 future_data = df_with_indicators[future_mask].head(request.horizon)
                 if len(future_data) > 0:
                     actual_future_values = future_data['Close'].values

        # 2. Train Model
        engine = ModelEngine()
        
        if request.model == "prophet":
            if train_cutoff:
                train_data = df_with_indicators[df_with_indicators.index <= train_cutoff]
            else:
                train_data = df_with_indicators
            
            engine.train(train_data, model_type=request.model)
        else:
            if train_cutoff:
                df_at_cutoff = df_with_indicators[df_with_indicators.index <= train_cutoff]
                processor.df = df_at_cutoff
                train_df = processor.prepare_target(request.horizon)
            else:
                processor.df = df_with_indicators
                train_df = processor.prepare_target(request.horizon)

            engine.train(train_df, model_type=request.model)
        
        # Predict
        if train_cutoff:
             predict_df = df_with_indicators[df_with_indicators.index <= train_cutoff]
        else:
             predict_df = df_with_indicators
             
        prediction = engine.predict(predict_df, horizon_days=request.horizon)
        
        # Calculate Metrics if we have actuals (Backtest mode)
        metrics = None
        if actual_future_values is not None and prediction.get("forecast_values"):
            forecast_vals = prediction["forecast_values"]
            # Truncate to min length
            min_len = min(len(actual_future_values), len(forecast_vals))
            if min_len > 0:
                y_true = actual_future_values[:min_len]
                y_pred = forecast_vals[:min_len]
                
                metrics = Metrics(
                    mae=mean_absolute_error(y_true, y_pred),
                    rmse=np.sqrt(mean_squared_error(y_true, y_pred)),
                    mape=mean_absolute_percentage_error(y_true, y_pred)
                )

        return PredictionResponse(
            ticker=request.ticker,
            model=request.model,
            direction=prediction["direction"],
            probability=prediction.get("probability", 0.0),
            feature_importance=prediction.get("feature_importance"),
            predicted_price=prediction.get("predicted_price"),
            forecast_dates=prediction.get("forecast_dates"),
            forecast_values=prediction.get("forecast_values"),
            confidence_interval=prediction.get("confidence_interval"),
            metrics=metrics
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
def get_history(ticker: str = "SPY", period: str = "2y"):
    try:
        processor = DataProcessor(ticker)
        df = processor.fetch_data(period=period)
        df = df.reset_index()
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
