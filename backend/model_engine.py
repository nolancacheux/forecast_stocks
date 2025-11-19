import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional, List
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.multioutput import MultiOutputRegressor
from xgboost import XGBRegressor
from prophet import Prophet
import joblib
import os

class ModelEngine:
    def __init__(self):
        self.model = None
        self.model_type = None
        self.features = None
        self.feature_importance_cache = None
        self.horizon = None
        self.residual_std = None
        
    def _build_regressor(self, model_type: str):
        if model_type == 'xgboost':
            return XGBRegressor(
                objective='reg:squarederror',
                tree_method='hist',
                n_estimators=400,
                learning_rate=0.05,
                max_depth=6
            )
        if model_type == 'random_forest':
            return RandomForestRegressor(
                n_estimators=600,
                max_depth=8,
                random_state=42
            )
        if model_type == 'linear_regression':
            return LinearRegression()
        raise ValueError(f"Unknown model type: {model_type}")

    def train(self, data, target_col: str = 'Target_Direction', model_type: str = 'xgboost', feature_cols: List[str] = None) -> Dict[str, Any]:
        """
        Train the selected model.
        """
        self.model_type = model_type
        
        if model_type == 'prophet':
            return self._train_prophet(data)
        
        X, y = data
        self.features = X.columns.tolist()
        self.horizon = y.shape[1]
        
        base_model = self._build_regressor(model_type)
        self.model = MultiOutputRegressor(base_model)
        self.model.fit(X, y)
        
        preds = self.model.predict(X)
        residuals = y.values - preds
        self.residual_std = residuals.std(axis=0)
        self.residual_std = np.where(self.residual_std == 0, 1e-3, self.residual_std)
        
        mae = float(np.mean(np.abs(residuals)))
        return {
            "model_type": model_type,
            "mae": mae
        }

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
            current_price = df_latest['Close'].iloc[-1] if not df_latest.empty else 0
            tail_forecast = forecast.tail(horizon_days)
            predicted_values = tail_forecast['yhat'].tolist()
            predicted_price = predicted_values[-1]
            direction = "UP" if predicted_price > current_price else "DOWN"
            prob = 0.6 if direction == "UP" else 0.4
            return {
                "direction": direction,
                "probability": prob,
                "predicted_price": predicted_price,
                "confidence_interval": {
                    "lower": tail_forecast['yhat_lower'].tolist(),
                    "upper": tail_forecast['yhat_upper'].tolist()
                },
                "forecast_dates": tail_forecast['ds'].dt.strftime('%Y-%m-%d').tolist(),
                "forecast_values": predicted_values
            }
            
        # Regression models
        if self.features is None:
            raise ValueError("Feature set not defined.")
        
        X = df_latest[self.features].tail(1)
        preds = self.model.predict(X)[0]
        horizon = len(preds)
        last_date = df_latest.index[-1]
        forecast_dates = [(last_date + pd.Timedelta(days=i)).strftime('%Y-%m-%d') for i in range(1, horizon + 1)]
        current_price = float(df_latest['Close'].iloc[-1])
        predicted_price = float(preds[-1])
        direction = "UP" if predicted_price > current_price else "DOWN"
        prob = 0.5 + min(abs(predicted_price - current_price) / max(current_price, 1e-6), 0.4)
        if direction == "DOWN":
            prob = 1 - prob
        
        if self.residual_std is not None and len(self.residual_std) >= horizon:
            lower = (preds - 1.96 * self.residual_std[:horizon]).tolist()
            upper = (preds + 1.96 * self.residual_std[:horizon]).tolist()
        else:
            band = abs(predicted_price - current_price) * 0.05
            lower = (preds - band).tolist()
            upper = (preds + band).tolist()
        
        importance = {}
        if hasattr(self.model, "estimators_") and hasattr(self.model.estimators_[0], "feature_importances_"):
            imps = np.mean([est.feature_importances_ for est in self.model.estimators_], axis=0)
            importance = dict(sorted(zip(self.features, imps), key=lambda item: item[1], reverse=True)[:5])
        elif hasattr(self.model, "estimators_") and hasattr(self.model.estimators_[0], "coef_"):
            imps = np.mean([est.coef_ for est in self.model.estimators_], axis=0)
            importance = dict(sorted(zip(self.features, imps), key=lambda item: abs(item[1]), reverse=True)[:5])
        
        return {
            "direction": direction,
            "probability": float(prob),
            "feature_importance": importance,
            "predicted_price": predicted_price,
            "forecast_dates": forecast_dates,
            "forecast_values": preds.tolist(),
            "confidence_interval": {
                "lower": lower,
                "upper": upper
            }
        }

