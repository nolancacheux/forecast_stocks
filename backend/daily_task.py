import json
import os
from data_processor import DataProcessor
from model_engine import ModelEngine

TICKERS = ["SPY", "QQQ", "IWM", "DIA"]
MODELS = ["xgboost", "random_forest", "logistic_regression", "prophet"]
HORIZON = 14
OUTPUT_DIR = "../frontend/public/data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "predictions.json")

def run_daily_update():
    results = {}
    
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    for ticker in TICKERS:
        print(f"Processing {ticker}...")
        results[ticker] = {}
        
        try:
            # Process Data
            processor = DataProcessor(ticker)
            processor.fetch_data()
            df_with_indicators = processor.add_indicators()
            
            # Supervised training data
            train_df = processor.prepare_target(HORIZON)
            
            for model_name in MODELS:
                print(f"  Training {model_name}...")
                engine = ModelEngine()
                
                if model_name == 'prophet':
                    engine.train(df_with_indicators, model_type=model_name)
                else:
                    engine.train(train_df, model_type=model_name)
                
                prediction = engine.predict(df_with_indicators, horizon_days=HORIZON)
                
                # Convert numpy types to python native for JSON serialization
                serializable_pred = {
                    "direction": prediction["direction"],
                    "probability": prediction.get("probability"),
                    "feature_importance": prediction.get("feature_importance"),
                    "forecast_values": prediction.get("forecast_values"),
                    "forecast_dates": prediction.get("forecast_dates")
                }
                
                results[ticker][model_name] = serializable_pred
                
        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            results[ticker]["error"] = str(e)
            
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"Saved predictions to {OUTPUT_FILE}")

if __name__ == "__main__":
    run_daily_update()
