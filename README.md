# StockPulse

**AI Financial Forecasting Engine**

StockPulse is a full-stack predictive analytics dashboard for financial markets. It leverages advanced machine learning models (XGBoost, Random Forest, Linear Regression, Prophet) to forecast asset prices with multi-horizon regression and rigorous backtesting capabilities.

![Dashboard](images/dashboard.png)

![Information](images/information.png)

## Features

-   **Multi-Model AI Engine**: Switch dynamically between **XGBoost**, **Random Forest**, **Linear Regression**, and **Prophet**.
-   **True Multi-Horizon Forecasting**: Uses `MultiOutputRegressor` for non-time-series models to generate smooth, accurate price paths (not just linear interpolation).
-   **Time-Travel Backtesting**: precise evaluation with **MAE**, **RMSE**, and **MAPE** metrics by training only on data available up to a specific past date.
-   **Interactive Visualization**: Charts with **Recharts**, featuring confidence intervals, "Today" markers, and historical/forecast overlays.
-   **Technical Analysis**: Automated calculation of RSI, MACD, Bollinger Bands, Ichimoku Cloud, and Candle Patterns.
-   **Modern UI/UX**: Built with **Next.js 14**, **Shadcn/UI**, and **Tailwind CSS** in a sleek Dark/Light mode interface.

## Tech Stack

-   **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI, Recharts, Lucide Icons.
-   **Backend**: Python 3.10+, FastAPI, Pandas, Scikit-learn, XGBoost, Prophet, YFinance.
-   **DevOps**: Docker, GitHub Actions (Daily Automation).

## Quick Start

### Prerequisites
-   Node.js 18+
-   Python 3.10+

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/nolancacheux/forecast_stocks.git
    cd forecast_stocks
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # Mac/Linux
    # source .venv/bin/activate
    
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

4.  **Access**
    -   Frontend: `http://localhost:3000`
    -   API Docs: `http://localhost:8000/docs`

## Testing

Run the backend test suite:
```bash
cd backend
pytest
```

## License

MIT

By Nolan Cacheux