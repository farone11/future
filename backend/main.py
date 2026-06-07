from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta, time
from typing import Dict, Optional
import asyncio
from contextlib import asynccontextmanager
import os
import json
from pathlib import Path

def log_info(msg): print(f"[INFO] {datetime.utcnow()} {msg}")
def log_error(msg): print(f"[ERROR] {datetime.utcnow()} {msg}")
def log_warn(msg): print(f"[WARN] {datetime.utcnow()} {msg}")

def get_jakarta_time():
    return datetime.utcnow() + timedelta(hours=7)

DISPLAY_SYMBOL = "XAUUSD"
SETTINGS_FILE = Path("settings.json")
SIGNALS_FILE = Path("signals.json")
CACHE_FILE = Path("price_cache.json")

DEFAULT_SETTINGS = {
    "risk_per_trade": 1.0, "max_daily_dd": 3.0, "max_lot": 0.10, "kill_switch": True,
    "trading_hours": {"start": "07:00", "end": "23:00"},
    "ai_modules": {"smc": True, "prz": True, "liquidity": True, "risk_ai": True}
}

# FIX 1: HAPUS CACHE, HAPUS DUPLIKAT
MT5_LIVE_DATA = {
    "price": 0, "ask": 0, "bid": 0, "spread": 0, "time": "",
    "balance": 10000, "equity": 10000, "margin": 0, "free_margin": 10000,
    "daily_change": 0, "daily_change_pct": 0, "source": "NONE", "time_msc": 0
}
LAST_MT5_UPDATE = 0
SIGNALS_CACHE: Dict[str, any] = {"signals": []}

class SettingsModel(BaseModel):
    risk_per_trade: float = Field(1.0, gt=0, le=10)
    max_daily_dd: float = Field(3.0, gt=0, le=20)
    max_lot: float = Field(0.10, gt=0, le=10)
    kill_switch: bool = True
    trading_hours: Dict[str, str] = {"start": "07:00", "end": "23:00"}
    ai_modules: Dict[str, bool] = {"smc": True, "prz": True, "liquidity": True, "risk_ai": True}

    @validator('trading_hours')
    def validate_hours(cls, v):
        try:
            time.fromisoformat(v['start']); time.fromisoformat(v['end']); return v
        except: raise ValueError('Invalid time format. Use HH:MM')

class NewSignalModel(BaseModel):
    type: str; entry: float; sl: float; tp: float
    tp2: Optional[float] = None; tp3: Optional[float] = None
    source: str = "MANUAL"; confidence: int = 85

# FIX 2: Sesuaiin sama mt5_push.py
class MT5TickModel(BaseModel):
    symbol: str
    bid: float
    ask: float
    spread: Optional[float] = 0
    time: Optional[int] = 0
    time_msc: Optional[int] = 0
    balance: Optional[float] = 0
    equity: Optional[float] = 0
    margin: Optional[float] = 0
    free_margin: Optional[float] = 0

def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f: return {**DEFAULT_SETTINGS, **json.load(f)}
        except Exception as e: log_error(f"Settings corrupt: {e}")
    return DEFAULT_SETTINGS

def save_settings(data: dict):
    validated = SettingsModel(**data)
    with open(SETTINGS_FILE, "w") as f: json.dump(validated.model_dump(), f, indent=2)

def load_signals_to_cache():
    if SIGNALS_FILE.exists():
        try:
            with open(SIGNALS_FILE, "r") as f: SIGNALS_CACHE["signals"] = json.load(f)
        except Exception as e: log_error(f"Failed load signals: {e}"); SIGNALS_CACHE["signals"] = []
    else: SIGNALS_CACHE["signals"] = []

def save_signals():
    try:
        SIGNALS_CACHE["signals"].sort(key=lambda x: (not x.get('source', '').startswith('AI-'), -x['id']))
        with open(SIGNALS_FILE, "w") as f: json.dump(SIGNALS_CACHE["signals"], f, indent=2)
    except Exception as e: log_error(f"Failed save signals: {e}")

def load_price_cache():
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r") as f: return json.load(f)
        except: pass
    return {"price": 0, "ask": 0, "bid": 0, "time": get_jakarta_time().isoformat(), "change": 0, "source": "NONE"}

def save_price_cache(data: dict):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)

def get_mt5_data_cached():
    if MT5_LIVE_DATA["source"] == "MT5":
        jakarta_time = get_jakarta_time()
        return {
            "price": MT5_LIVE_DATA["bid"], "ask": MT5_LIVE_DATA["ask"],
            "spread": MT5_LIVE_DATA["spread"],
            "daily_change": MT5_LIVE_DATA["daily_change"],
            "daily_change_pct": MT5_LIVE_DATA["daily_change_pct"],
            "time": jakarta_time.strftime("%H:%M:%S"),
            "date": jakarta_time.strftime("%Y-%m-%d"),
            "balance": MT5_LIVE_DATA["balance"], "equity": MT5_LIVE_DATA["equity"],
            "margin": MT5_LIVE_DATA["margin"], "free_margin": MT5_LIVE_DATA["free_margin"],
            "source": "MT5_LIVE"
        }
    
    cached = load_price_cache()
    return {
        "price": cached.get("price", 0), "ask": cached.get("ask", 0),
        "spread": round(cached.get("ask", 0) - cached.get("price", 0), 2),
        "daily_change": cached.get("change", 0), "daily_change_pct": 0,
        "time": get_jakarta_time().strftime("%H:%M:%S"),
        "date": get_jakarta_time().strftime("%Y-%m-%d"),
        "balance": 0, "equity": 0, "margin": 0, "free_margin": 0,
        "source": cached.get("source", "NONE")
    }

def get_active_signal() -> dict:
    ai_signals = [s for s in SIGNALS_CACHE["signals"] if s.get('source','').startswith('AI-') and s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]]
    if ai_signals: return ai_signals[0]
    for s in reversed(SIGNALS_CACHE["signals"]):
        if s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]: return s
    return {"status": "NONE", "entry": 0, "sl": 0, "tp1": 0, "confidence": 0, "source": "NONE"}

async def signal_monitor():
    while True:
        try:
            mt5_data = get_mt5_data_cached()
            if mt5_data["price"] == 0: await asyncio.sleep(1); continue
            bid, ask = mt5_data["price"], mt5_data["ask"]; updated = False
            for signal in SIGNALS_CACHE["signals"]:
                old_status = signal["status"]; new_status = old_status
                if signal["status"] == "WAITING":
                    if signal["type"] == "BUY" and ask <= signal["entry"]: new_status = "ACTIVE"; signal["triggered_at"] = get_jakarta_time().isoformat()
                    elif signal["type"] == "SELL" and bid >= signal["entry"]: new_status = "ACTIVE"; signal["triggered_at"] = get_jakarta_time().isoformat()
                elif signal["status"] == "ACTIVE":
                    if signal["type"] == "BUY":
                        if signal.get("tp3") and bid >= signal["tp3"]: new_status = "CLOSED"
                        elif signal.get("tp2") and bid >= signal["tp2"]: new_status = "CLOSED"
                        elif bid >= signal["tp1"]: new_status = "CLOSED"
                        elif bid <= signal["sl"]: new_status = "CLOSED"
                    else:
                        if signal.get("tp3") and ask <= signal["tp3"]: new_status = "CLOSED"
                        elif signal.get("tp2") and ask <= signal["tp2"]: new_status = "CLOSED"
                        elif ask <= signal["tp1"]: new_status = "CLOSED"
                        elif ask >= signal["sl"]: new_status = "CLOSED"
                signal["current_price"] = bid if signal["type"] == "BUY" else ask
                if new_status!= old_status:
                    signal["status"] = new_status
                    if new_status == "CLOSED": signal["closed_at"] = get_jakarta_time().isoformat()
                    updated = True
            if updated: save_signals()
        except Exception as e: log_error(f"Monitor error: {e}")
        await asyncio.sleep(1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("logs").mkdir(exist_ok=True)
    log_info("Starting Farone API - MT5 Only Mode")
    load_settings(); load_signals_to_cache()
    asyncio.create_task(signal_monitor())
    yield; log_info("Shutdown")

app = FastAPI(title="FARONE.AI API", version="14.0 MT5-Only", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health(): 
    return {
        "status": "ok", 
        "data_source": MT5_LIVE_DATA["source"], 
        "last_update": LAST_MT5_UPDATE,
        "timestamp": get_jakarta_time().isoformat()
    }

@app.post("/api/mt5-tick")
async def receive_mt5_tick(data: MT5TickModel):
    global MT5_LIVE_DATA, LAST_MT5_UPDATE
    try:
        MT5_LIVE_DATA.update(data.model_dump())
        MT5_LIVE_DATA["price"] = data.bid
        MT5_LIVE_DATA["source"] = "MT5"
        LAST_MT5_UPDATE = datetime.now().timestamp()
        
        save_price_cache({
            "price": data.bid, "ask": data.ask, "bid": data.bid,
            "spread": data.spread, "time": get_jakarta_time().isoformat(),
            "change": 0, "source": "MT5"
        })
        
        log_info(f"MT5 Tick: {data.symbol} Bid:{data.bid} Ask:{data.ask}")
        return {"status": "ok", "received": data.symbol}
    except Exception as e:
        log_error(f"Tick error: {e}")
        return {"status": "error", "msg": str(e)}

@app.get("/api/dashboard")
def dashboard():
    mt5_data = get_mt5_data_cached()
    settings = load_settings()
    return {
        "ai_status": "ACTIVE" if mt5_data["source"] == "MT5_LIVE" else "STANDBY",
        "gold_price": mt5_data["price"], "ask_price": mt5_data["ask"],
        "spread": mt5_data["spread"], "daily_change": mt5_data["daily_change"],
        "daily_change_pct": mt5_data["daily_change_pct"], "win_rate": 0,
        "total_trades": 0, "open_positions": 0, "active_signal": get_active_signal(),
        "data_source": mt5_data["source"], "risk_engine": {
            "lot_size": settings["max_lot"], "drawdown": 0, "max_daily_dd": settings["max_daily_dd"],
            "status": "LOW RISK", "balance": mt5_data["balance"], "equity": mt5_data["equity"],
            "margin": mt5_data["margin"], "free_margin": mt5_data["free_margin"], "kill_switch": False
        }, "updated_at": mt5_data["time"], "updated_date": mt5_data["date"], "symbol": DISPLAY_SYMBOL
    }

@app.get("/api/signals")
def get_signals(): return {"signals": SIGNALS_CACHE["signals"]}

@app.post("/api/signals")
async def create_signal(signal: NewSignalModel):
    rr = round(abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl), 1) if signal.entry!= signal.sl else 0
    mt5_data = get_mt5_data_cached(); current_price = mt5_data.get("price", signal.entry)
    new_signal = {
        "id": int(datetime.now().timestamp() * 1000), "pair": "XAUUSD", "type": signal.type.upper(),
        "entry": signal.entry, "sl": signal.sl, "tp": signal.tp, "tp1": signal.tp, "tp2": signal.tp2,
        "tp3": signal.tp3, "status": "WAITING" if abs(current_price - signal.entry) > 0.5 else "ACTIVE",
        "time": get_jakarta_time().strftime("%H:%M:%S"), "date": get_jakarta_time().strftime("%Y-%m-%d"),
        "confidence": signal.confidence, "source": signal.source, "rr": rr, "pnl": None,
        "current_price": current_price, "close_reason": None, "closed_at": None, "triggered_at": None
    }
    SIGNALS_CACHE["signals"].insert(0, new_signal); save_signals()
    return {"status": "success", "signal": new_signal}

@app.get("/api/settings")
def get_settings(): return load_settings()

@app.post("/api/settings")
def update_settings(data: SettingsModel):
    save_settings(data.model_dump()); return {"status": "success", "settings": data.model_dump()}

@app.get("/")
async def root(): return {"message": "Farone API Online", "data_source": MT5_LIVE_DATA["source"]}
