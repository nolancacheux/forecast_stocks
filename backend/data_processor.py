import yfinance as yf
import pandas as pd
import pandas_ta as ta
import numpy as np
from typing import List, Optional

class DataProcessor:
    def __init__(self, ticker: str = "SPY"):
        self.ticker = ticker
        self.df = None

    def fetch_data(self, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
        """
        Fetch historical data from Yahoo Finance.
        """
        print(f"Fetching data for {self.ticker}...")
        self.df = yf.download(self.ticker, period=period, interval=interval, progress=False)
        
        # yfinance sometimes returns MultiIndex columns if multiple tickers (though here we fetch one)
        # or keeps Ticker as level 0. We flatten if necessary.
        if isinstance(self.df.columns, pd.MultiIndex):
            self.df.columns = self.df.columns.get_level_values(0) # This might need adjustment based on yfinance version
            
            # If flattening resulted in lost Open/High/Low/Close names or they are embedded differently,
            # we need to be careful. 
            # Recent yfinance versions (0.2.x) return MultiIndex (Price, Ticker) even for single ticker.
            # Let's handle that robustly.
            pass
            
        # Reset index to make Date a column if needed, but time series usually keeps Date as index.
        # We will keep Date as Index for pandas-ta.
        
        if self.df.empty:
            raise ValueError(f"No data found for {self.ticker}")

        # Ensure standard columns exist
        expected_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        # Check if columns are MultiIndex with ticker
        if isinstance(self.df.columns, pd.MultiIndex):
             self.df = self.df.xs(self.ticker, level=1, axis=1)
        
        # Verify columns
        missing = [c for c in expected_cols if c not in self.df.columns]
        if missing:
             # Fallback: maybe columns are just lower case?
             self.df.columns = [c.capitalize() for c in self.df.columns]
        
        return self.df

    def add_indicators(self) -> pd.DataFrame:
        """
        Add technical indicators to the dataframe.
        """
        if self.df is None or self.df.empty:
            raise ValueError("Dataframe is empty. Fetch data first.")

        # Copy to avoid setting on slice warnings if external
        df = self.df.copy()

        # Trend
        df.ta.ema(length=20, append=True)
        df.ta.ema(length=50, append=True)
        df.ta.ema(length=200, append=True)
        df.ta.macd(append=True)
        # Ichimoku returns two DataFrames (dfs) usually, let's see how pandas-ta handles it.
        # It appends columns like ISA_9, ISB_26, ITS_9, IKS_26, ICS_26.
        # We'll just call it and let it append standard columns.
        try:
            df.ta.ichimoku(append=True)
        except Exception as e:
            print(f"Ichimoku calculation failed: {e}")

        # Momentum
        df.ta.rsi(append=True)
        df.ta.stoch(append=True)
        df.ta.roc(append=True)

        # Volatility
        df.ta.bbands(append=True)
        df.ta.atr(append=True)

        # Candle Patterns
        # Manual implementation to avoid TA-Lib dependency issues on Windows
        
        # Doji
        body = (df['Close'] - df['Open']).abs()
        range_len = df['High'] - df['Low']
        df['CDL_DOJI'] = (body <= range_len * 0.1).astype(int)
        
        # Engulfing (Simple approximation)
        # Bullish Engulfing: Prev Red, Curr Green, Curr Open < Prev Close, Curr Close > Prev Open
        prev_open = df['Open'].shift(1)
        prev_close = df['Close'].shift(1)
        
        is_prev_red = prev_close < prev_open
        is_curr_green = df['Close'] > df['Open']
        
        bullish_engulf = (is_prev_red & is_curr_green & 
                          (df['Open'] < prev_close) & 
                          (df['Close'] > prev_open))
        
        df['CDL_ENGULFING'] = bullish_engulf.astype(int)

        self.df = df
        return self.df

    def prepare_target(self, horizon_days: int = 14) -> pd.DataFrame:
        """
        Create target variable: 1 if Price(t + horizon) > Price(t), else 0.
        Also useful for backtesting.
        """
        if self.df is None:
            raise ValueError("No data.")
        
        df = self.df.copy()
        
        # Target: Return 14 days ahead
        # Shift close backwards by horizon_days to compare current row with future row?
        # No, we want to predict future from current.
        # So Target column at row T should be (Close[T+14] > Close[T]).
        # But to train, we need known targets.
        # So we shift the Close column negatively (upwards) to get Future_Close.
        
        df['Future_Close'] = df['Close'].shift(-horizon_days)
        df['Target_Direction'] = (df['Future_Close'] > df['Close']).astype(int)
        
        # Remove the last 'horizon_days' rows as they have no target
        df = df.dropna(subset=['Future_Close'])
        
        self.df = df
        return self.df

    def get_processed_data(self):
        """
        Return the processed dataframe with NaNs dropped (from indicators).
        """
        return self.df.dropna()

if __name__ == "__main__":
    # Simple test run
    processor = DataProcessor("SPY")
    df = processor.fetch_data()
    print(f"Fetched {len(df)} rows.")
    df = processor.add_indicators()
    print(f"Added indicators. Columns: {df.columns}")
    df = processor.prepare_target(14)
    print(f"Prepared target. Rows with target: {len(df)}")

