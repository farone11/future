from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta
from datetime import time as dt_time # <-- FIX 1: rename biar gak ketiban
from typing import Dict, Optional, List, Any
import asyncio
from contextlib import asynccontextmanager
import os
import json
import time # buat time.time()
import pytz
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
HISTORY_FILE = Path("trade_history.json")
POSITIONS_FILE = Path("open_positions.json")
SESSIONS_FILE = Path("sessions.json")
LIQUIDITY_FILE = Path("liquidity.json")

DEFAULT_SETTINGS = {
    "risk_per_trade": 1.0, "max_daily_dd": 3.0, "max_lot": 0.10, "kill_switch": True,
    "trading_hours": {"start": "07:00", "end": "23:00"},
    "ai_modules": {"smc": True, "prz": True, "liquidity": True, "risk_ai": True}
}

MT5_LIVE_DATA = {
    "price": 0, "ask": 0, "bid": 0, "spread": 0, "time": "",
    "balance": 0, "equity": 0, "margin": 0, "free_margin": 0,
    "daily_change": 0, "daily_change_pct": 0, "source": "NONE", "time_msc": 0
}
LAST_MT5_UPDATE = 0
SIGNALS_CACHE: Dict[str, Any] = {"signals": []}
MT5_HISTORY: List[dict] = []
MT5_POSITIONS: List[dict] = []
MT5_SESSIONS = {
    "asia": {"high": 0, "low": 0, "mid": 0, "range": 0},
    "london": {"high": 0, "low": 0, "mid": 0, "range": 0},
    "newyork": {"high": 0, "low": 0, "mid": 0, "range": 0}
}
MT5_LIQUIDITY_ZONES: List[dict] = []

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
            dt_time.fromisoformat(v['start']); dt_time.fromisoformat(v['end']); return v # <-- FIX 2: pake dt_time
        except: raise ValueError('Invalid time format. Use HH:MM')

class NewSignalModel(BaseModel):
    type: str; entry: float; sl: float; tp: float
    tp2: Optional[float] = None; tp3: Optional[float] = None
    source: str = "MANUAL"; confidence: int = 85

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

class SessionsPayload(BaseModel):
    sessions: Dict[str, Dict[str, float]]

class LiquidityPayload(BaseModel):
    zones: List[Dict[str, Any]]

# === FILE HELPERS ===
def load_json_file(file: Path, default: Any) -> Any:
    if file.exists():
        try:
            with open(file, "r") as f: return json.load(f)
        except Exception as e: log_error(f"Failed load {file}: {e}")
    return default

def save_json_file(file: Path, data: Any):
    try:
        with open(file, "w") as f: json.dump(data, f, indent=2)
    except Exception as e: log_error(f"Failed save {file}: {e}")

def load_settings() -> dict:
    return {**DEFAULT_SETTINGS, **load_json_file(SETTINGS_FILE, {})}

def save_settings(data: dict):
    validated = SettingsModel(**data)
    save_json_file(SETTINGS_FILE, validated.model_dump())

def load_signals_to_cache():
    SIGNALS_CACHE["signals"] = load_json_file(SIGNALS_FILE, [])

def save_signals():
    SIGNALS_CACHE["signals"].sort(key=lambda x: (not x.get('source', '').startswith('AI-'), -x['id']))
    save_json_file(SIGNALS_FILE, SIGNALS_CACHE["signals"])

def load_price_cache():
    return load_json_file(CACHE_FILE, {
        "price": 0, "ask": 0, "bid": 0, "time": get_jakarta_time().isoformat(),
        "change": 0, "source": "NONE", "day_open": 0
    })

def save_price_cache(data: dict):
    save_json_file(CACHE_FILE, data)

def load_trade_history() -> List[dict]:
    return load_json_file(HISTORY_FILE, [])

def save_trade_history(data: List[dict]):
    save_json_file(HISTORY_FILE, data)

def load_positions() -> List[dict]:
    return load_json_file(POSITIONS_FILE, [])

def save_positions(data: List[dict]):
    save_json_file(POSITIONS_FILE, data)

def load_sessions() -> dict:
    return load_json_file(SESSIONS_FILE, MT5_SESSIONS)

def save_sessions(data: dict):
    save_json_file(SESSIONS_FILE, data)

def load_liquidity() -> List[dict]:
    return load_json_file(LIQUIDITY_FILE, [])

def save_liquidity(data: List[dict]):
    save_json_file(LIQUIDITY_FILE, data)

# === CORE LOGIC ===
def get_mt5_data_cached():
    global LAST_MT5_UPDATE, MT5_LIVE_DATA
    now = datetime.now().timestamp()
    is_live = (now - LAST_MT5_UPDATE) < 15 and MT5_LIVE_DATA["source"] == "MT5"
    cached = load_price_cache()
    jakarta_time = get_jakarta_time()
    day_open = cached.get("day_open", MT5_LIVE_DATA["bid"]) or MT5_LIVE_DATA["bid"] or 1
    current_price = MT5_LIVE_DATA["bid"] if is_live else cached.get("price", 0)
    daily_change = current_price - day_open if day_open > 0 else 0
    daily_change_pct = (daily_change / day_open * 100) if day_open > 0 else 0

    if jakarta_time.hour == 0 and jakarta_time.minute < 2 and "day_open_reset" not in cached:
        cached["day_open"] = current_price
        cached["day_open_reset"] = True
        save_price_cache(cached)
    elif jakarta_time.hour!= 0:
        cached.pop("day_open_reset", None)
        save_price_cache(cached)

    if is_live:
        return {
            "price": MT5_LIVE_DATA["bid"], "ask": MT5_LIVE_DATA["ask"],
            "spread": MT5_LIVE_DATA["spread"],
            "daily_change": round(daily_change, 2),
            "daily_change_pct": round(daily_change_pct, 2),
            "time": jakarta_time.strftime("%H:%M:%S"),
            "date": jakarta_time.strftime("%Y-%m-%d"),
            "balance": MT5_LIVE_DATA["balance"], "equity": MT5_LIVE_DATA["equity"],
            "margin": MT5_LIVE_DATA["margin"], "free_margin": MT5_LIVE_DATA["free_margin"],
            "source": "MT5_LIVE",
            "last_update": LAST_MT5_UPDATE
        }
    return {
        "price": cached.get("price", 0), "ask": cached.get("ask", 0),
        "spread": round(cached.get("ask", 0) - cached.get("price", 0), 2),
        "daily_change": round(daily_change, 2), "daily_change_pct": round(daily_change_pct, 2),
        "time": jakarta_time.strftime("%H:%M:%S"),
        "date": jakarta_time.strftime("%Y-%m-%d"),
        "balance": MT5_LIVE_DATA["balance"],
        "equity": MT5_LIVE_DATA["equity"],
        "margin": MT5_LIVE_DATA["margin"],
        "free_margin": MT5_LIVE_DATA["free_margin"],
        "source": "STALE",
        "last_update": LAST_MT5_UPDATE
    }

def get_active_signal() -> dict:
    ai_signals = [s for s in SIGNALS_CACHE["signals"] if s.get('source','').startswith('AI-') and s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]]
    if ai_signals: return ai_signals[0]
    for s in reversed(SIGNALS_CACHE["signals"]):
        if s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]: return s
    return {"status": "NONE", "entry": 0, "sl": 0, "tp1": 0, "confidence": 0, "source": "NONE"}

def calculate_analytics(days: int = 30) -> dict:
    history = load_trade_history()
    cutoff = get_jakarta_time() - timedelta(days=days)
    filtered_trades = []
    for t in history:
        try:
            trade_date = datetime.fromisoformat(t["date"].replace(" ", "T"))
            if trade_date >= cutoff:
                filtered_trades.append(t)
        except: continue

    if not filtered_trades:
        return {
            "profit_factor": 0, "max_dd_pct": 0, "max_drawdown": 0,
            "sharpe_ratio": 0, "sortino_ratio": 0, "expectancy": 0,
            "recovery_factor": 0, "total_pl": 0, "equity_curve": []
        }

    wins = [t.get("profit", 0) for t in filtered_trades if t.get("profit", 0) > 0]
    losses = [t.get("profit", 0) for t in filtered_trades if t.get("profit", 0) < 0]
    total_pl = sum(t.get("profit", 0) for t in filtered_trades)
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

    equity = 10000
    equity_curve = [{"date": "Start", "equity": equity, "drawdown": 0}]
    max_equity = equity
    max_dd = 0
    for t in sorted(filtered_trades, key=lambda x: x["date"]):
        equity += t.get("profit", 0)
        max_equity = max(max_equity, equity)
        dd = max_equity - equity
        max_dd = max(max_dd, dd)
        equity_curve.append({
            "date": t["date"][:10],
            "equity": round(equity, 2),
            "drawdown": round(dd, 2)
        })
    max_dd_pct = (max_dd / max_equity * 100) if max_equity > 0 else 0

    return {
        "profit_factor": round(profit_factor, 2),
        "max_dd_pct": round(max_dd_pct, 1),
        "max_drawdown": round(max_dd, 2),
        "sharpe_ratio": 0, "sortino_ratio": 0,
        "expectancy": round(total_pl / len(filtered_trades), 2) if filtered_trades else 0,
        "recovery_factor": round(total_pl / max_dd, 2) if max_dd > 0 else 0,
        "total_pl": round(total_pl, 2),
        "equity_curve": equity_curve[-30:]
    }

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
                        if signal.get("tp3") and bid >= signal["tp3"]: new_status = "CLOSED"; signal["pnl"] = (signal["tp3"] - signal["entry"]) * 100; signal["close_reason"] = "TP3"
                        elif signal.get("tp2") and bid >= signal["tp2"]: new_status = "CLOSED"; signal["pnl"] = (signal["tp2"] - signal["entry"]) * 100; signal["close_reason"] = "TP2"
                        elif bid >= signal["tp1"]: new_status = "CLOSED"; signal["pnl"] = (signal["tp1"] - signal["entry"]) * 100; signal["close_reason"] = "TP1"
                        elif bid <= signal["sl"]: new_status = "CLOSED"; signal["pnl"] = (signal["sl"] - signal["entry"]) * 100; signal["close_reason"] = "SL"
                    else:
                        if signal.get("tp3") and ask <= signal["tp3"]: new_status = "CLOSED"; signal["pnl"] = (signal["entry"] - signal["tp3"]) * 100; signal["close_reason"] = "TP3"
                        elif signal.get("tp2") and ask <= signal["tp2"]: new_status = "CLOSED"; signal["pnl"] = (signal["entry"] - signal["tp2"]) * 100; signal["close_reason"] = "TP2"
                        elif ask <= signal["tp1"]: new_status = "CLOSED"; signal["pnl"] = (signal["entry"] - signal["tp1"]) * 100; signal["close_reason"] = "TP1"
                        elif ask >= signal["sl"]: new_status = "CLOSED"; signal["pnl"] = (signal["entry"] - signal["sl"]) * 100; signal["close_reason"] = "SL"
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
    global MT5_HISTORY, MT5_POSITIONS, MT5_SESSIONS, MT5_LIQUIDITY_ZONES
    MT5_HISTORY = load_trade_history()
    MT5_POSITIONS = load_positions()
    MT5_SESSIONS = load_sessions()
    MT5_LIQUIDITY_ZONES = load_liquidity()
    asyncio.create_task(signal_monitor())
    yield; log_info("Shutdown")

app = FastAPI(title="FARONE.AI API", version="14.8 Signal-POST-Fix", lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://future-da3.pages.dev",
    "https://faronecapital.online",
    "https://www.faronecapital.online",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "data_source": MT5_LIVE_DATA["source"],
        "last_update": LAST_MT5_UPDATE,
        "timestamp": get_jakarta_time().isoformat()
    }

@app.get("/api/market-data")
def market_data():
    mt5_data = get_mt5_data_cached()
    positions = load_positions()
    active_sig = get_active_signal()

    ai_signal = "STANDBY"
    signal_strength = 0
    signal_tp = 0
    signal_sl = 0

    if active_sig["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]:
        ai_signal = active_sig["type"]
        signal_strength = active_sig.get("confidence", 85)
        signal_tp = active_sig.get("tp1", 0)
        signal_sl = active_sig.get("sl", 0)

    return {
        "bid": mt5_data["price"],
        "ask": mt5_data["ask"],
        "spread": mt5_data["spread"],
        "daily_change": mt5_data["daily_change"],
        "daily_change_pct": mt5_data["daily_change_pct"],
        "time": mt5_data["time"],
        "date": mt5_data["date"],
        "balance": mt5_data["balance"],
        "equity": mt5_data["equity"],
        "margin": mt5_data["margin"],
        "free_margin": mt5_data["free_margin"],
        "source": mt5_data["source"],
        "last_update": mt5_data["last_update"],
        "ai_signal": ai_signal,
        "signal_strength": signal_strength,
        "signal_tp": signal_tp,
        "signal_sl": signal_sl,
        "symbol": DISPLAY_SYMBOL,
        "open_positions": len(positions)
    }

@app.post("/api/mt5-tick")
async def receive_mt5_tick(data: MT5TickModel):
    global MT5_LIVE_DATA, LAST_MT5_UPDATE
    try:
        MT5_LIVE_DATA.update(data.model_dump())
        MT5_LIVE_DATA["price"] = data.bid
        MT5_LIVE_DATA["source"] = "MT5"
        LAST_MT5_UPDATE = datetime.now().timestamp()
        cached = load_price_cache()
        if "day_open" not in cached or cached["day_open"] == 0:
            cached["day_open"] = data.bid
        save_price_cache({
            "price": data.bid, "ask": data.ask, "bid": data.bid,
            "spread": data.spread, "time": get_jakarta_time().isoformat(),
            "change": 0, "source": "MT5", "day_open": cached["day_open"]
        })
        return {"status": "ok", "received": data.symbol}
    except Exception as e:
        log_error(f"Tick error: {e}")
        return {"status": "error", "msg": str(e)}

@app.get("/api/mt5-history")
async def get_mt5_history(days: int = Query(30)):
    try:
        history = load_trade_history()
        cutoff = get_jakarta_time() - timedelta(days=days)
        filtered = []
        for t in history:
            try:
                if datetime.fromisoformat(t["date"].replace(" ", "T")) >= cutoff:
                    filtered.append(t)
            except: continue
        return {"deals": filtered}
    except Exception as e:
        log_error(f"Get history error: {e}")
        raise HTTPException(500, str(e))

@app.post("/api/mt5-history")
async def save_mt5_history(request: Request):
    global MT5_HISTORY
    try:
        data = await request.json()
        deals = data.get("deals", [])
        clean_deals = []
        for d in deals:
            clean_deals.append({
                "ticket": d.get("ticket", 0),
                "order": d.get("order", 0),
                "position_id": d.get("position_id", 0),
                "date": d.get("date", ""),
                "time": d.get("time", 0),
                "type": d.get("type", ""),
                "volume": float(d.get("volume", 0.0)),
                "price": float(d.get("price", 0.0)),
                "price_open": float(d.get("price_open", 0.0)),
                "profit": float(d.get("profit", 0.0)),
                "commission": float(d.get("commission", 0.0)),
                "swap": float(d.get("swap", 0.0)),
                "symbol": d.get("symbol", DISPLAY_SYMBOL),
                "result": d.get("result", ""),
                "reason": d.get("reason", "Manual")
            })
        MT5_HISTORY = clean_deals
        save_trade_history(MT5_HISTORY)
        log_info(f"MT5 History: {len(MT5_HISTORY)} deals received")
        return {"status": "ok", "count": len(MT5_HISTORY)}
    except Exception as e:
        log_error(f"Save history error: {e}")
        return {"status": "error", "msg": str(e)}

@app.get("/api/mt5-positions")
async def get_mt5_positions():
    return {"positions": load_positions()}

@app.post("/api/mt5-positions")
async def receive_mt5_positions(request: Request):
    global MT5_POSITIONS
    try:
        data = await request.json()
        MT5_POSITIONS = data.get("positions", [])
        save_positions(MT5_POSITIONS)
        log_info(f"MT5 Positions: {len(MT5_POSITIONS)} open")
        return {"status": "ok", "count": len(MT5_POSITIONS)}
    except Exception as e:
        log_error(f"Positions error: {e}")
        return {"status": "error", "msg": str(e)}

@app.get("/api/mt5-sessions")
async def get_mt5_sessions():
    return {"sessions": load_sessions()}

@app.post("/api/mt5-sessions")
async def receive_mt5_sessions(payload: SessionsPayload):
    global MT5_SESSIONS
    MT5_SESSIONS = payload.sessions
    save_sessions(MT5_SESSIONS)
    log_info(f"Sessions updated: Asia {MT5_SESSIONS['asia']['range']} | London {MT5_SESSIONS['london']['range']} | NY {MT5_SESSIONS['newyork']['range']} pips")
    return {"status": "ok"}

@app.get("/api/mt5-liquidity")
async def get_mt5_liquidity():
    return {"zones": load_liquidity()}

@app.post("/api/mt5-liquidity")
async def receive_mt5_liquidity(payload: LiquidityPayload):
    global MT5_LIQUIDITY_ZONES
    MT5_LIQUIDITY_ZONES = payload.zones
    save_liquidity(MT5_LIQUIDITY_ZONES)
    log_info(f"Liquidity updated: {len(MT5_LIQUIDITY_ZONES)} zones")
    return {"status": "ok"}

@app.get("/api/dashboard")
def dashboard():
    mt5_data = get_mt5_data_cached()
    settings = load_settings()
    history = load_trade_history()
    positions = load_positions()
    wins = len([t for t in history if t.get("profit", 0) > 0])
    win_rate = round(wins / len(history) * 100, 1) if history else 0

    return {
        "ai_status": "ACTIVE" if mt5_data["source"] == "MT5_LIVE" else "STANDBY",
        "gold_price": mt5_data["price"], "ask_price": mt5_data["ask"],
        "spread": mt5_data["spread"], "daily_change": mt5_data["daily_change"],
        "daily_change_pct": mt5_data["daily_change_pct"],
        "win_rate": win_rate,
        "total_trades": len(history),
        "open_positions": len(positions),
        "active_signal": get_active_signal(),
        "data_source": mt5_data["source"],
        "risk_engine": {
            "lot_size": settings["max_lot"], "drawdown": 0, "max_daily_dd": settings["max_daily_dd"],
            "status": "LOW RISK", "balance": mt5_data["balance"], "equity": mt5_data["equity"],
            "margin": mt5_data["margin"], "free_margin": mt5_data["free_margin"], "kill_switch": False
        },
        "updated_at": mt5_data["time"],
        "updated_date": mt5_data["date"],
        "symbol": DISPLAY_SYMBOL,
        "sessions": load_sessions(),
        "liquidity_zones": load_liquidity()
    }

@app.get("/api/signals")
def get_signals():
    return {"signals": SIGNALS_CACHE["signals"]}

# === FIX 405: PASTIKAN INI ADA & DEPLOY ===
@app.post("/api/signals")
async def create_signal(signal: NewSignalModel):
    try:
        rr = round(abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl), 1) if signal.entry!= signal.sl else 0
        mt5_data = get_mt5_data_cached()
        current_price = mt5_data.get("price", signal.entry)

        new_signal = {
            "id": int(time.time() * 1000), # <-- FIX 3: pake time.time()
            "pair": "XAUUSD",
            "type": signal.type.upper(),
            "entry": signal.entry,
            "sl": signal.sl,
            "tp": signal.tp,
            "tp1": signal.tp,
            "tp2": signal.tp2,
            "tp3": signal.tp3,
            "status": "WAITING" if abs(current_price - signal.entry) > 0.5 else "ACTIVE",
            "time": get_jakarta_time().strftime("%H:%M:%S"),
            "date": get_jakarta_time().strftime("%Y-%m-%d"),
            "confidence": signal.confidence,
            "source": signal.source,
            "rr": rr,
            "pnl": 0,
            "current_price": current_price,
            "close_reason": None,
            "closed_at": None,
            "triggered_at": get_jakarta_time().isoformat() if abs(current_price - signal.entry) <= 0.5 else None
        }
        SIGNALS_CACHE["signals"].insert(0, new_signal)
        save_signals()
        log_info(f"New signal created: {signal.type} @ {signal.entry} from {signal.source}")
        return {"status": "success", "signal": new_signal}
    except Exception as e:
        log_error(f"Create signal error: {e}")
        raise HTTPException(500, str(e))

@app.get("/api/analytics")
def get_analytics(days: int = 30):
    return calculate_analytics(days)

@app.get("/api/history")
def get_history(days: int = 30):
    trades = load_trade_history()
    cutoff = get_jakarta_time() - timedelta(days=days)
    filtered = []
    for t in trades:
        try:
            if datetime.fromisoformat(t["date"].replace(" ", "T")) >= cutoff:
                filtered.append(t)
        except: continue
    return {"trades": filtered}

@app.get("/api/settings")
def get_settings(): return load_settings()

@app.post("/api/settings")
def update_settings(data: SettingsModel):
    save_settings(data.model_dump()); return {"status": "success", "settings": data.model_dump()}

@app.get("/")
async def root():
    return {"message": "FARONE.AI API v14.8 - Signal POST Ready"}
