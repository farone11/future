from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta, time
import json
from pathlib import Path
from typing import Dict, Optional, Set, List
import asyncio
from contextlib import asynccontextmanager
import aiohttp
import os

def log_info(msg): print(f"[INFO] {datetime.utcnow()} {msg}")
def log_error(msg): print(f"[ERROR] {datetime.utcnow()} {msg}")
def log_warn(msg): print(f"[WARN] {datetime.utcnow()} {msg}")

def get_jakarta_time():
    return datetime.utcnow() + timedelta(hours=7)

SYMBOL = "XAU/USD"
DISPLAY_SYMBOL = "XAUUSD"
SETTINGS_FILE = Path("settings.json")
SIGNALS_FILE = Path("signals.json")
TWELVEDATA_API_KEY = os.getenv("TWELVEDATA_API_KEY", "demo")

DEFAULT_SETTINGS = {
    "risk_per_trade": 1.0, "max_daily_dd": 3.0, "max_lot": 0.10, "kill_switch": True,
    "trading_hours": {"start": "07:00", "end": "23:00"},
    "ai_modules": {"smc": True, "prz": True, "liquidity": True, "risk_ai": True}
}

CACHE = {"data": None, "timestamp": 0, "last_good": None, "history": []}
SIGNALS_CACHE: Dict[str, any] = {"signals": [], "clients": set()}
PRICE_CLIENTS: Set[WebSocket] = set() # FIX: Buat broadcast harga ke sidebar
MT5_LIVE_DATA = {"price": 0, "ask": 0, "bid": 0, "spread": 0, "time": "", "balance": 10000, "equity": 10000, "margin": 0, "free_margin": 10000, "source": "NONE"}

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
            time.fromisoformat(v['start'])
            time.fromisoformat(v['end'])
            return v
        except: raise ValueError('Invalid time format. Use HH:MM')

class NewSignalModel(BaseModel):
    type: str; entry: float; sl: float; tp: float; tp2: Optional[float] = None
    tp3: Optional[float] = None; source: str = "MANUAL"; confidence: int = 85

def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                user_settings = json.load(f)
                return {**DEFAULT_SETTINGS, **user_settings}
        except Exception as e: log_error(f"Settings corrupt, using default: {e}")
    return DEFAULT_SETTINGS

def save_settings(data: dict):
    validated = SettingsModel(**data)
    with open(SETTINGS_FILE, "w") as f: json.dump(validated.model_dump(), f, indent=2)
    log_info(f"Settings updated")

def load_signals_to_cache():
    if SIGNALS_FILE.exists():
        try:
            with open(SIGNALS_FILE, "r") as f: SIGNALS_CACHE["signals"] = json.load(f)
        except Exception as e:
            log_error(f"Failed load signals: {e}"); SIGNALS_CACHE["signals"] = []
    else: SIGNALS_CACHE["signals"] = []

def save_signals():
    try:
        SIGNALS_CACHE["signals"].sort(key=lambda x: (not x.get('source', '').startswith('AI-'), -x['id']))
        with open(SIGNALS_FILE, "w") as f: json.dump(SIGNALS_CACHE["signals"], f, indent=2)
    except Exception as e: log_error(f"Failed save signals: {e}")

def get_mt5_data_cached():
    now = datetime.now().timestamp()
    if CACHE["data"] and now - CACHE["timestamp"] < 1: return CACHE["data"]
    if MT5_LIVE_DATA["price"] == 0: return {"error": f"Waiting for data... Source: {MT5_LIVE_DATA['source']}"}
    
    jakarta_time = get_jakarta_time()
    data = {
        "price": MT5_LIVE_DATA["bid"], "ask": MT5_LIVE_DATA["ask"], 
        "spread": round(MT5_LIVE_DATA["ask"] - MT5_LIVE_DATA["bid"], 2),
        "daily_change": 0, "daily_change_pct": 0, "time": jakarta_time.strftime("%H:%M:%S"), 
        "date": jakarta_time.strftime("%Y-%m-%d"), "balance": MT5_LIVE_DATA["balance"], 
        "equity": MT5_LIVE_DATA["equity"], "margin": MT5_LIVE_DATA["margin"], 
        "free_margin": MT5_LIVE_DATA["free_margin"], "source": MT5_LIVE_DATA["source"]
    }
    CACHE["data"] = data; CACHE["last_good"] = data; CACHE["timestamp"] = now
    return data

def get_active_signal() -> dict:
    ai_signals = [s for s in SIGNALS_CACHE["signals"] if s.get('source','').startswith('AI-') and s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]]
    if ai_signals: return ai_signals[0]
    for s in reversed(SIGNALS_CACHE["signals"]):
        if s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]: return s
    return {"status": "NONE", "entry": 0, "sl": 0, "tp1": 0, "confidence": 0, "source": "NONE"}

async def broadcast_signal(signal: dict):
    dead_clients: Set[WebSocket] = set()
    payload = {"type": "signal_update", "data": signal}
    for client in SIGNALS_CACHE["clients"].copy():
        try: await client.send_json(payload)
        except Exception: dead_clients.add(client)
    SIGNALS_CACHE["clients"] -= dead_clients; save_signals()

async def broadcast_price():
    # FIX: Kirim harga ke semua client Dashboard biar sidebar nyala
    if not PRICE_CLIENTS: return
    mt5_data = get_mt5_data_cached()
    if "error" in mt5_data: return
    
    payload = {
        "type": "price_update",
        "price": mt5_data["price"],
        "ask": mt5_data["ask"],
        "time": mt5_data["time"]
    }
    dead_clients: Set[WebSocket] = set()
    for client in PRICE_CLIENTS.copy():
        try: await client.send_json(payload)
        except Exception: dead_clients.add(client)
    PRICE_CLIENTS -= dead_clients

async def signal_monitor():
    log_info("Signal monitor started")
    while True:
        try:
            mt5_data = get_mt5_data_cached()
            if "error" in mt5_data: await asyncio.sleep(1); continue
            bid, ask = mt5_data["price"], mt5_data["ask"]; updated_signals = []
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
                if new_status != old_status:
                    signal["status"] = new_status
                    if new_status == "CLOSED": signal["closed_at"] = get_jakarta_time().isoformat()
                    updated_signals.append(signal)
            if updated_signals: save_signals(); 
            for s in updated_signals: await broadcast_signal(s)
        except Exception as e: log_error(f"Monitor error: {e}")
        await asyncio.sleep(1)

async def twelvedata_fetcher():
    global MT5_LIVE_DATA
    if TWELVEDATA_API_KEY == "demo":
        log_warn("TWELVEDATA_API_KEY not set. Using demo = slow/limited")
    
    log_info(f"TwelveData fetcher started. Key: {TWELVEDATA_API_KEY[:6]}...")
    url = f"https://api.twelvedata.com/price?symbol={SYMBOL}&apikey={TWELVEDATA_API_KEY}"
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(url, timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        price = float(data.get('price', 0))
                        if price > 0:
                            MT5_LIVE_DATA["bid"] = round(price, 2)
                            MT5_LIVE_DATA["ask"] = round(price + 0.15, 2)
                            MT5_LIVE_DATA["price"] = round(price, 2)
                            MT5_LIVE_DATA["time"] = get_jakarta_time().strftime("%H:%M:%S")
                            MT5_LIVE_DATA["source"] = "TWELVEDATA"
                            log_info(f"TwelveData: {price}")
                            await broadcast_price() # FIX: Kirim ke sidebar
                        else:
                            log_warn(f"TwelveData returned 0. Market closed?")
                    elif resp.status == 429:
                        log_warn("TwelveData rate limit. Free plan = 8/min")
                        await asyncio.sleep(8)
                        continue
                    elif resp.status == 401:
                        log_error("TwelveData API Key invalid")
                        await asyncio.sleep(60)
                        continue
                    else:
                        text = await resp.text()
                        log_error(f"TwelveData status {resp.status}: {text[:100]}")
            except Exception as e:
                log_error(f"TwelveData error: {e}")
            await asyncio.sleep(8) # 8 req/min buat free plan

@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("logs").mkdir(exist_ok=True)
    log_info("Starting Farone API with TwelveData")
    load_settings(); load_signals_to_cache()
    asyncio.create_task(signal_monitor()); asyncio.create_task(twelvedata_fetcher())
    yield; log_info("Shutdown")

app = FastAPI(title="FARONE.AI API", version="11.1 WS+History", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://faronecapital.online", "*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok", "data_source": MT5_LIVE_DATA["source"], "timestamp": get_jakarta_time().isoformat()}

@app.get("/api/dashboard")
def dashboard():
    mt5_data = get_mt5_data_cached()
    if "error" in mt5_data:
        return {"error": mt5_data["error"], "ai_status": "WAITING DATA", "fallback": True}
    settings = load_settings()
    return {
        "ai_status": "ACTIVE", "gold_price": mt5_data["price"], "ask_price": mt5_data["ask"], 
        "spread": mt5_data["spread"], "daily_change": mt5_data["daily_change"], 
        "daily_change_pct": mt5_data["daily_change_pct"], "win_rate": 0, "total_trades": 0, 
        "open_positions": 0, "active_signal": get_active_signal(), "data_source": mt5_data["source"],
        "risk_engine": {
            "lot_size": settings["max_lot"], "drawdown": 0, "max_daily_dd": settings["max_daily_dd"],
            "status": "LOW RISK", "balance": mt5_data["balance"], "equity": mt5_data["equity"],
            "margin": mt5_data["margin"], "free_margin": mt5_data["free_margin"], "kill_switch": False
        },
        "updated_at": mt5_data["time"], "updated_date": mt5_data["date"], "symbol": DISPLAY_SYMBOL
    }

@app.websocket("/ws/live")
async def websocket_dashboard(websocket: WebSocket):
    await websocket.accept()
    PRICE_CLIENTS.add(websocket) # FIX: Register buat dapet update harga
    try:
        while True:
            data = dashboard(); await websocket.send_json(data); await asyncio.sleep(1)
    except WebSocketDisconnect: pass
    finally: PRICE_CLIENTS.discard(websocket)

@app.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket):
    await websocket.accept(); SIGNALS_CACHE["clients"].add(websocket)
    try:
        await websocket.send_json({"type": "init", "signals": SIGNALS_CACHE["signals"]})
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping": await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError: await websocket.send_json({"type": "heartbeat", "time": get_jakarta_time().strftime("%H:%M:%S")})
    except WebSocketDisconnect: pass
    finally: SIGNALS_CACHE["clients"].discard(websocket)

@app.get("/api/signals")
def get_signals(): return {"signals": SIGNALS_CACHE["signals"]}

@app.post("/api/signals")
async def create_signal(signal: NewSignalModel):
    rr = round(abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl), 1) if signal.entry != signal.sl else 0
    mt5_data = get_mt5_data_cached(); current_price = mt5_data.get("price", signal.entry)
    new_signal = {
        "id": int(datetime.now().timestamp() * 1000), "pair": "XAUUSD", "type": signal.type.upper(), 
        "entry": signal.entry, "sl": signal.sl, "tp": signal.tp, "tp1": signal.tp, "tp2": signal.tp2, 
        "tp3": signal.tp3, "status": "WAITING" if abs(current_price - signal.entry) > 0.5 else "ACTIVE",
        "time": get_jakarta_time().strftime("%H:%M:%S"), "date": get_jakarta_time().strftime("%Y-%m-%d"),
        "confidence": signal.confidence, "source": signal.source, "rr": rr, "pnl": None, 
        "current_price": current_price, "close_reason": None, "closed_at": None, "triggered_at": None
    }
    SIGNALS_CACHE["signals"].insert(0, new_signal); await broadcast_signal(new_signal)
    return {"status": "success", "signal": new_signal}

@app.get("/api/analytics")
def get_analytics(days: int = 30):
    return {"equity_curve": [], "win_rate": 0, "profit_factor": 0, "max_dd": 0, "sharpe": 0, "total_trades": 0}

# FIX: Tambah endpoint /api/history biar gak 404
@app.get("/api/history")
async def get_history(days: int = 30):
    # Sementara return kosong, nanti isi TwelveData time_series
    closed_trades = [s for s in SIGNALS_CACHE["signals"] if s["status"] == "CLOSED"]
    return {
        "status": "ok",
        "symbol": DISPLAY_SYMBOL,
        "days": days,
        "trades": closed_trades,
        "equity_curve": CACHE["history"][-days:],
        "message": "Historical data coming soon"
    }

@app.get("/api/settings")
def get_settings(): return load_settings()

@app.post("/api/settings")
def update_settings(data: SettingsModel):
    save_settings(data.model_dump())
    return {"status": "success", "settings": data.model_dump()}

@app.get("/")
async def root(): return {"message": "Farone API Online", "data_source": MT5_LIVE_DATA["source"]}
