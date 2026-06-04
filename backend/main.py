from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Biar React 5173 bisa akses
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"]
)

@app.get("/api/dashboard")
def dashboard():
    return {
        "ai_status": "ACTIVE",
        "gold_price": 4436.54,
        "daily_change": +12.30,
        "win_rate": 87.5,
        "total_trades": 142,
        "active_signal": {
            "status": "BUY",
            "entry": 4435.50,
            "sl": 4420.00,
            "tp1": 4450.00,
            "tp2": 4465.00
        },
        "risk_engine": {
            "lot_size": 0.05,
            "drawdown": 2.1,
            "status": "LOW RISK"
        }
    }

@app.get("/api/liquidity")
def liquidity():
    return {
        "buy_zones": [4420.50, 4415.00, 4408.20],
        "sell_zones": [4445.00, 4452.30, 4460.00]
    }