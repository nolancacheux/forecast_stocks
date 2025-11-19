# MarketFocus AI

High-performance financial prediction dashboard using Next.js, Python FastAPI, and XGBoost.

## Features

- **Prediction Engine**: XGBoost, Random Forest, Logistic Regression, Prophet.
- **Technical Analysis**: EMA, MACD, RSI, Bollinger Bands, etc.
- **Dashboard**: Interactive UI with Recharts and Shadcn/UI.
- **Automation**: Daily updates via GitHub Actions.

## Structure

- `frontend/`: Next.js 14 App Router.
- `backend/`: FastAPI, Machine Learning pipeline.
- `.github/workflows/`: Automation scripts.

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Access at `http://localhost:3000`.

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Access API at `http://localhost:8000`.

## Deployment

### Frontend (Vercel)
1. Push code to GitHub.
2. Import `frontend` directory in Vercel.
3. Deploy.

### Backend (Render/Railway)
1. Create a Web Service.
2. Point to `backend` directory (or root and set Root Directory to `backend`).
3. Build Command: `pip install -r requirements.txt`.
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port 10000` (or `$PORT`).

### Automation
The GitHub Action `.github/workflows/daily_update.yml` runs daily at 21:00 UTC to retrain models and save predictions to `frontend/public/data/predictions.json`.
