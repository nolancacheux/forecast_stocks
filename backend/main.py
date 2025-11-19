from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import PredictionRequest, PredictionResponse, BacktestRequest, HistoryRequest
from data_processor import DataProcessor
from model_engine import ModelEngine
import pandas as pd
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
        
        # Handle Backtesting/Reference Date
        train_cutoff = None
        if request.reference_date:
            # Ensure reference_date is in df
            # Convert to datetime
            ref_dt = pd.to_datetime(request.reference_date)
            if ref_dt > df_with_indicators.index[-1]:
                 # If future, just use all data
                 pass
            else:
                 # We train on data UP TO reference_date
                 train_cutoff = ref_dt

        # 2. Train Model
        engine = ModelEngine()
        
        if request.model == "prophet":
            if train_cutoff:
                # Train only up to cutoff
                train_data = df_with_indicators[df_with_indicators.index <= train_cutoff]
            else:
                train_data = df_with_indicators
            
            engine.train(train_data, model_type=request.model)
        else:
            # Supervised models
            # prepare_target usually drops last N rows.
            # If backtesting, we want to train on data where target is KNOWN relative to cutoff?
            # No, if we emulate "being at reference_date", we can only see data <= reference_date.
            # But to train a target for T+14, we need data up to T (features) and T+14 (label).
            # If we are AT reference_date, we only have labels for data up to reference_date - 14.
            
            # Let's simplify: We assume we are time-traveling to 'reference_date'.
            # We can only use data available at that time.
            
            if train_cutoff:
                # Filter raw data first? No, we need indicators which need lookback.
                # We filter the df_with_indicators.
                df_at_cutoff = df_with_indicators[df_with_indicators.index <= train_cutoff]
                
                # Now we prepare target on this truncated data
                # prepare_target will drop the last 14 rows of THIS truncated data
                # because we don't know their future (relative to cutoff).
                # This correctly simulates training at that point in time.
                
                # processor.df is currently full data.
                # We need to temporarily set it to truncated data?
                # DataProcessor methods operate on self.df.
                
                # Let's manually do it.
                processor.df = df_at_cutoff
                train_df = processor.prepare_target(request.horizon)
            else:
                train_df = processor.prepare_target(request.horizon)

            engine.train(train_df, model_type=request.model)
        
        # Predict
        # If backtesting, we predict starting from reference_date
        if train_cutoff:
             # For classification, we predict the row AT reference_date
             predict_df = df_with_indicators[df_with_indicators.index <= train_cutoff]
        else:
             predict_df = df_with_indicators
             
        prediction = engine.predict(predict_df, horizon_days=request.horizon)
        
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
def get_history(ticker: str = "SPY", period: str = "2y"):
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
