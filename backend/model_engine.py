import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional, List
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, log_loss
import xgboost as xgb
from prophet import Prophet
import joblib
import os

class ModelEngine:
    def __init__(self):
        self.model = None
        self.model_type = None
        self.features = None
        
    def train(self, df: pd.DataFrame, target_col: str = 'Target_Direction', model_type: str = 'xgboost', feature_cols: List[str] = None) -> Dict[str, Any]:
        """
        Train the selected model.
        For Prophet, we use 'ds' (Date) and 'y' (Close).
        For others, we use feature_cols to predict target_col.
        """
        self.model_type = model_type
        
        # Split data
        # We respect time order. Last N rows might be test set in a real scenario,
        # but here we might train on all available labeled data for the 'latest' prediction.
        # 'df' should contain labeled data (target is not NaN).
        
        if model_type == 'prophet':
            return self._train_prophet(df)
        
        if feature_cols is None:
            # Exclude non-feature cols
            exclude = ['Target_Direction', 'Future_Close', 'Open', 'High', 'Low', 'Close', 'Volume', 'Date']
            feature_cols = [c for c in df.columns if c not in exclude]
        
        self.features = feature_cols
        X = df[feature_cols]
        y = df[target_col]
        
        if model_type == 'xgboost':
            self.model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss')
        elif model_type == 'random_forest':
            self.model = RandomForestClassifier(n_estimators=100)
        elif model_type == 'logistic_regression':
            self.model = LogisticRegression()
        else:
            raise ValueError(f"Unknown model type: {model_type}")
            
        # TimeSeries CV for metrics
        tscv = TimeSeriesSplit(n_splits=3)
        scores = cross_val_score(self.model, X, y, cv=tscv, scoring='accuracy')
        
        self.model.fit(X, y)
        
        metrics = {
            "accuracy": float(np.mean(scores)),
            "accuracy_std": float(np.std(scores)),
            "model_type": model_type
        }
        
        return metrics

    def _train_prophet(self, df: pd.DataFrame) -> Dict[str, Any]:
        # Prophet requires 'ds' and 'y'
        # We assume df has DateTime index or 'Date' column.
        pdf = df.reset_index()
        if 'Date' not in pdf.columns and not np.issubdtype(pdf.index.dtype, np.datetime64):
             # Try to find date column
             pass
        
        # Ensure we have 'Date'
        if 'Date' in pdf.columns:
            pdf = pdf.rename(columns={'Date': 'ds', 'Close': 'y'})
        else:
            # If index is datetime
            pdf['ds'] = pdf.index
            pdf = pdf.rename(columns={'Close': 'y'})
            
        self.model = Prophet()
        self.model.fit(pdf[['ds', 'y']])
        
        return {"model_type": "prophet", "accuracy": 0.0} # Prophet accuracy hard to quantify in same way without backtest

    def predict(self, df_latest: pd.DataFrame, horizon_days: int = 14) -> Dict[str, Any]:
        """
        Predict for the latest data point(s).
        """
        if self.model is None:
            raise ValueError("Model not trained.")
            
        if self.model_type == 'prophet':
            future = self.model.make_future_dataframe(periods=horizon_days)
            forecast = self.model.predict(future)
            # Get the forecast for the horizon
            last_forecast = forecast.iloc[-1]
            current_price = df_latest['Close'].iloc[-1] if not df_latest.empty else 0
            predicted_price = last_forecast['yhat']
            
            direction = "UP" if predicted_price > current_price else "DOWN"
            prob = 1.0 # Prophet doesn't give classification prob directly, use intervals?
            # We can use yhat_lower/upper for confidence
            
            return {
                "direction": direction,
                "probability": prob,
                "predicted_price": predicted_price,
                "confidence_interval": [last_forecast['yhat_lower'], last_forecast['yhat_upper']],
                "forecast_dates": forecast['ds'].tail(horizon_days).dt.strftime('%Y-%m-%d').tolist(),
                "forecast_values": forecast['yhat'].tail(horizon_days).tolist()
            }
            
        else:
            # Classification models - convert probability into a smooth synthetic price path
            if self.features is None:
                raise ValueError("Features not defined.")
                
            X = df_latest[self.features]
            X_last = X.iloc[[-1]]
            
            prob = self.model.predict_proba(X_last)[0][1]  # Prob of class 1 (UP)
            direction = "UP" if prob > 0.5 else "DOWN"
            
            current_price = float(df_latest['Close'].iloc[-1])
            horizon = max(horizon_days, 1)
            # Expected move scaled by probability confidence (max +/-8% across 30 days)
            base_move = (prob - 0.5) * 0.16  # +/-8%
            horizon_scale = min(horizon / 30.0, 2)
            target_price = current_price * (1 + base_move * horizon_scale)
            
            forecast_dates = []
            forecast_values = []
            for i in range(1, horizon + 1):
                date = df_latest.index[-1] + pd.Timedelta(days=i)
                forecast_dates.append(date.strftime('%Y-%m-%d'))
                ratio = i / horizon
                interpolated = current_price + (target_price - current_price) * ratio
                forecast_values.append(float(interpolated))
            
            predicted_price = forecast_values[-1]
            band = 0.02 + (0.5 - abs(prob - 0.5)) * 0.04
            confidence_interval = [
                predicted_price * (1 - band),
                predicted_price * (1 + band)
            ]
            
            # Feature Importance
            importance = {}
            if hasattr(self.model, 'feature_importances_'):
                imps = self.model.feature_importances_
                importance = dict(zip(self.features, [float(x) for x in imps]))
                importance = dict(sorted(importance.items(), key=lambda item: item[1], reverse=True)[:5])
            elif hasattr(self.model, 'coef_'):
                imps = self.model.coef_[0]
                importance = dict(zip(self.features, [float(x) for x in imps]))
            
            return {
                "direction": direction,
                "probability": float(prob),
                "feature_importance": importance,
                "predicted_price": predicted_price,
                "forecast_dates": forecast_dates,
                "forecast_values": forecast_values,
                "confidence_interval": confidence_interval
            }

