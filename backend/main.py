from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta, time
import pytz
import json
from pathlib import Path
from typing import List, Dict, Optional, Set
import numpy as np
from loguru import logger
import io
import asyncio
import traceback
from contextlib import asynccontextmanager
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import os

# === MT5 DIHAPUS KARENA GAK JALAN DI LINUX ===
# Kalau mau MT5, jalanin di VPS Windows terpisah terus kirim data ke API ini
MT5_AVAILABLE = False
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    logger.warning("MetaTrader5 not available. Running in API-only mode.")

logger.add("logs/farone_{time:YYYY-MM-DD}.log", rotation="1 day", retention="30 days", level="INFO")

SYMBOL = "XAUUSDc"
DISPLAY_SYMBOL = "XAUUSD"
UTC = pytz.UTC
JAKARTA = pytz.timezone("Asia/Jakarta")
SETTINGS_FILE = Path("settings.json")
SIGNALS_FILE = Path("signals.json")

DEFAULT_SETTINGS = {
    "risk_per_trade": 1.0,
    "max_daily_dd": 3.0,
    "max_lot": 0.10,
    "kill_switch": True,
    "trading_hours": {"start": "07:00", "end": "23:00"},
    "ai_modules": {"smc": True, "prz": True, "liquidity": True, "risk_ai": True}
}

CACHE = {"data": None, "timestamp": 0, "last_good": None}
SIGNALS_CACHE: Dict[str, any] = {"signals": [], "clients": set()}
MT5_LIVE_DATA = {"price": 0, "ask": 0, "bid": 0, "spread": 0, "time": "", "balance": 0, "equity": 0}

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
        except:
            raise ValueError('Invalid time format. Use HH:MM')

class SignalModel(BaseModel):
    id: int
    pair: str = "XAUUSD"
    type: str
    entry: float
    sl: float
    tp: float
    tp1: float
    tp2: Optional[float] = None
    tp3: Optional[float] = None
    status: str = "WAITING"
    time: str
    confidence: int = 85
    source: str = "MANUAL"
    rr: float = 0.0
    pnl: Optional[float] = None
    exit_price: Optional[float] = None
    current_price: Optional[float] = None
    close_reason: Optional[str] = None
    closed_at: Optional[str] = None
    triggered_at: Optional[str] = None

class NewSignalModel(BaseModel):
    type: str
    entry: float
    sl: float
    tp: float
    tp2: Optional[float] = None
    tp3: Optional[float] = None
    source: str = "MANUAL"
    confidence: int = 85

class MT5TickModel(BaseModel):
    symbol: str
    bid: float
    ask: float
    balance: Optional[float] = 0
    equity: Optional[float] = 0
    margin: Optional[float] = 0
    free_margin: Optional[float] = 0

def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                user_settings = json.load(f)
                return {**DEFAULT_SETTINGS, **user_settings}
        except Exception as e:
            logger.error(f"Settings corrupt, using default: {e}")
    return DEFAULT_SETTINGS

def save_settings(data: dict):
    validated = SettingsModel(**data)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(validated.dict(), f, indent=2)
    logger.info(f"Settings updated: {validated.dict()}")

def load_signals_to_cache():
    if SIGNALS_FILE.exists():
        try:
            with open(SIGNALS_FILE, "r") as f:
                SIGNALS_CACHE["signals"] = json.load(f)
                logger.info(f"Loaded {len(SIGNALS_CACHE['signals'])} signals from file")
        except Exception as e:
            logger.error(f"Failed load signals: {e}")
            SIGNALS_CACHE["signals"] = []
    else:
        SIGNALS_CACHE["signals"] = []

def save_signals():
    try:
        SIGNALS_CACHE["signals"].sort(key=lambda x: (
            not x.get('source', '').startswith('AI-'),
            -x['id']
        ))
        with open(SIGNALS_FILE, "w") as f:
            json.dump(SIGNALS_CACHE["signals"], f, indent=2)
    except Exception as e:
        logger.error(f"Failed save signals: {e}")

def get_mt5_data_cached():
    now = datetime.now().timestamp()
    if CACHE["data"] and now - CACHE["timestamp"] < 1:
        return CACHE["data"]

    # Kalau MT5 gak ada, pake data dari MT5TickModel yang dikirim EA
    if not MT5_AVAILABLE:
        if MT5_LIVE_DATA["price"] == 0:
            return {"error": "Waiting for MT5 data..."}
        
        jakarta_time = datetime.now(JAKARTA)
        data = {
            "price": MT5_LIVE_DATA["bid"], 
            "ask": MT5_LIVE_DATA["ask"], 
            "spread": round(MT5_LIVE_DATA["ask"] - MT5_LIVE_DATA["bid"], 2),
            "daily_change": 0, "daily_change_pct": 0,
            "time": jakarta_time.strftime("%H:%M:%S"), 
            "date": jakarta_time.strftime("%Y-%m-%d"),
            "balance": MT5_LIVE_DATA["balance"], 
            "equity": MT5_LIVE_DATA["equity"],
            "margin": MT5_LIVE_DATA["margin"], 
            "free_margin": MT5_LIVE_DATA["free_margin"],
        }
        CACHE["data"] = data
        CACHE["last_good"] = data
        CACHE["timestamp"] = now
        return data

    # Kode MT5 asli cuma jalan kalau di Windows
    try:
        tick = mt5.symbol_info_tick(SYMBOL)
        if tick is None:
            raise Exception(f"Symbol {SYMBOL} tidak ditemukan")
        account = mt5.account_info()
        if account is None:
            raise Exception("Gagal ambil info akun MT5")
        #... sisa kode MT5 asli...
        return CACHE["data"]
    except Exception as e:
        logger.error(f"MT5 Error: {e}")
        return CACHE["last_good"] or {"error": str(e)}

def get_daily_dd_percent() -> float:
    if not MT5_AVAILABLE: return 0.0
    try:
        account = mt5.account_info()
        if not account: return 0.0
        today_start = datetime.now(JAKARTA).replace(hour=0, minute=0, second=0, microsecond=0)
        deals_today = mt5.history_deals_get(today_start, datetime.now(JAKARTA))
        start_equity = account.balance
        if deals_today:
            pl_today = sum([d.profit + d.swap + d.commission for d in deals_today if d.entry == 1])
            start_equity = account.equity - pl_today
        if start_equity <= 0: return 0.0
        dd = (start_equity - account.equity) / start_equity * 100
        return round(max(dd, 0), 2)
    except:
        return 0.0

def get_active_signal() -> dict:
    ai_signals = [s for s in SIGNALS_CACHE["signals"] if s.get('source','').startswith('AI-') and s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]]
    if ai_signals:
        return ai_signals[0]
    for s in reversed(SIGNALS_CACHE["signals"]):
        if s["status"] in ["WAITING", "ACTIVE", "TRIGGERED"]:
            return s
    return {"status": "NONE", "entry": 0, "sl": 0, "tp1": 0, "tp2": 0, "tp3": 0, "rr": 0, "confidence": 0, "source": "NONE"}

async def broadcast_signal(signal: dict):
    dead_clients: Set[WebSocket] = set()
    payload = {"type": "signal_update", "data": signal}
    for client in SIGNALS_CACHE["clients"].copy():
        try:
            await client.send_json(payload)
        except Exception:
            dead_clients.add(client)
    SIGNALS_CACHE["clients"] -= dead_clients
    save_signals()
    if dead_clients:
        logger.info(f"Removed {len(dead_clients)} dead clients. Active: {len(SIGNALS_CACHE['clients'])}")

async def signal_monitor():
    logger.info("Signal monitor started")
    while True:
        try:
            # Pake data dari cache, bukan mt5 langsung
            mt5_data = get_mt5_data_cached()
            if "error" in mt5_data:
                await asyncio.sleep(1)
                continue

            bid, ask = mt5_data["price"], mt5_data["ask"]
            updated_signals = []

            for signal in SIGNALS_CACHE["signals"]:
                old_status = signal["status"]
                new_status = old_status
                exit_price = signal.get("exit_price")
                pnl = signal.get("pnl")
                close_reason = signal.get("close_reason")

                if signal["status"] == "WAITING":
                    if signal["type"] == "BUY" and ask <= signal["entry"]:
                        new_status = "ACTIVE"
                        signal["triggered_at"] = datetime.now(JAKARTA).isoformat()
                    elif signal["type"] == "SELL" and bid >= signal["entry"]:
                        new_status = "ACTIVE"
                        signal["triggered_at"] = datetime.now(JAKARTA).isoformat()

                elif signal["status"] == "ACTIVE":
                    if signal["type"] == "BUY":
                        if signal.get("tp3") and bid >= signal["tp3"]:
                            new_status = "CLOSED"; close_reason = "TP3_HIT"; exit_price = signal["tp3"]
                            pnl = round((exit_price - signal["entry"]) * 100, 2)
                        elif signal.get("tp2") and bid >= signal["tp2"]:
                            new_status = "CLOSED"; close_reason = "TP2_HIT"; exit_price = signal["tp2"]
                            pnl = round((exit_price - signal["entry"]) * 100, 2)
                        elif bid >= signal["tp1"]:
                            new_status = "CLOSED"; close_reason = "TP1_HIT"; exit_price = signal["tp1"]
                            pnl = round((exit_price - signal["entry"]) * 100, 2)
                        elif bid <= signal["sl"]:
                            new_status = "CLOSED"; close_reason = "SL_HIT"; exit_price = signal["sl"]
                            pnl = round((signal["sl"] - signal["entry"]) * 100, 2)
                    else: # SELL
                        if signal.get("tp3") and ask <= signal["tp3"]:
                            new_status = "CLOSED"; close_reason = "TP3_HIT"; exit_price = signal["tp3"]
                            pnl = round((signal["entry"] - exit_price) * 100, 2)
                        elif signal.get("tp2") and ask <= signal["tp2"]:
                            new_status = "CLOSED"; close_reason = "TP2_HIT"; exit_price = signal["tp2"]
                            pnl = round((signal["entry"] - exit_price) * 100, 2)
                        elif ask <= signal["tp1"]:
                            new_status = "CLOSED"; close_reason = "TP1_HIT"; exit_price = signal["tp1"]
                            pnl = round((signal["entry"] - exit_price) * 100, 2)
                        elif ask >= signal["sl"]:
                            new_status = "CLOSED"; close_reason = "SL_HIT"; exit_price = signal["sl"]
                            pnl = round((signal["entry"] - signal["sl"]) * 100, 2)

                signal["current_price"] = bid if signal["type"] == "BUY" else ask

                if new_status!= old_status:
                    signal["status"] = new_status
                    signal["exit_price"] = exit_price
                    signal["pnl"] = pnl
                    signal["close_reason"] = close_reason
                    if new_status == "CLOSED":
                        signal["closed_at"] = datetime.now(JAKARTA).isoformat()
                    updated_signals.append(signal)

            if updated_signals:
                save_signals()
                for s in updated_signals:
                    await broadcast_signal(s)

        except Exception as e:
            logger.error(f"Monitor error: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("logs").mkdir(exist_ok=True)
    if MT5_AVAILABLE:
        if not mt5.initialize():
            logger.error(f"MT5 Gagal Initialize: {mt5.last_error()}")
        else:
            logger.success(f"MT5 Connected | Symbol: {SYMBOL} | Timezone: GMT+7")
    else:
        logger.warning("Running without MT5. Waiting for external data via /api/mt5-tick")
    
    load_settings()
    load_signals_to_cache()
    asyncio.create_task(signal_monitor())
    yield
    if MT5_AVAILABLE: mt5.shutdown()
    logger.info("Shutdown")

app = FastAPI(title="FARONE.AI MT5 API", version="8.0 Railway", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://faronecapital.online", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok", "mt5_mode": "native" if MT5_AVAILABLE else "api", "timestamp": datetime.now(JAKARTA).isoformat()}

@app.post("/api/mt5-tick")
async def receive_mt5_tick(data: MT5TickModel):
    """Endpoint ini dipanggil dari EA MT5 di Windows buat kirim harga live"""
    global MT5_LIVE_DATA
    MT5_LIVE_DATA = data.dict()
    MT5_LIVE_DATA["price"] = data.bid
    MT5_LIVE_DATA["time"] = datetime.now(JAKARTA).strftime("%H:%M:%S")
    return {"status": "ok"}

@app.get("/api/dashboard")
def dashboard():
    mt5_data = get_mt5_data_cached()
    if "error" in mt5_data:
        return {"error": mt5_data["error"], "ai_status": "WAITING MT5", "fallback": True}

    settings = load_settings()
    daily_dd = get_daily_dd_percent()
    kill_switch_triggered = settings["kill_switch"] and daily_dd >= settings["max_daily_dd"]

    return {
        "ai_status": "ACTIVE" if not kill_switch_triggered else "KILL SWITCH",
        "gold_price": mt5_data["price"], "ask_price": mt5_data["ask"], "spread": mt5_data["spread"],
        "daily_change": mt5_data["daily_change"], "daily_change_pct": mt5_data["daily_change_pct"],
        "win_rate": 0, "total_trades": 0, "open_positions": 0,
        "active_signal": get_active_signal(),
        "risk_engine": {
            "lot_size": settings["max_lot"], "drawdown": daily_dd, "max_daily_dd": settings["max_daily_dd"],
            "status": "LOW RISK" if daily_dd < 1 else "MEDIUM RISK" if daily_dd < settings["max_daily_dd"] else "HIGH RISK",
            "balance": mt5_data["balance"], "equity": mt5_data["equity"],
            "margin": mt5_data["margin"], "free_margin": mt5_data["free_margin"],
            "kill_switch": kill_switch_triggered
        },
        "updated_at": mt5_data["time"], "updated_date": mt5_data["date"], "symbol": DISPLAY_SYMBOL
    }

@app.websocket("/ws/live")
async def websocket_dashboard(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = dashboard()
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Dashboard WS error: {e}")

@app.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket):
    await websocket.accept()
    SIGNALS_CACHE["clients"].add(websocket)
    try:
        await websocket.send_json({"type": "init", "signals": SIGNALS_CACHE["signals"]})
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping": await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat", "time": datetime.now(JAKARTA).strftime("%H:%M:%S")})
    except WebSocketDisconnect:
        pass
    finally:
        SIGNALS_CACHE["clients"].discard(websocket)

@app.get("/api/signals")
def get_signals():
    return {"signals": SIGNALS_CACHE["signals"]}

@app.post("/api/signals")
async def create_signal(signal: NewSignalModel):
    rr = round(abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl), 1) if signal.entry!= signal.sl else 0
    mt5_data = get_mt5_data_cached()
    current_price = mt5_data.get("price", signal.entry)

    new_signal = {
        "id": int(datetime.now().timestamp() * 1000), "pair": "XAUUSD",
        "type": signal.type.upper(), "entry": signal.entry, "sl": signal.sl,
        "tp": signal.tp, "tp1": signal.tp, "tp2": signal.tp2, "tp3": signal.tp3,
        "status": "WAITING" if abs(current_price - signal.entry) > 0.5 else "ACTIVE",
        "time": datetime.now(JAKARTA).strftime("%H:%M:%S"),
        "date": datetime.now(JAKARTA).strftime("%Y-%m-%d"),
        "confidence": signal.confidence,
        "source": signal.source, "rr": rr, "pnl": None, "current_price": current_price,
        "close_reason": None, "closed_at": None, "triggered_at": None
    }
    SIGNALS_CACHE["signals"].insert(0, new_signal)
    await broadcast_signal(new_signal)
    return {"status": "success", "signal": new_signal}

# Hapus endpoint /api/analytics, /api/history, /api/positions karena butuh MT5
# Nanti bisa dibikin versi yang ambil dari database

@app.get("/api/settings")
def get_settings():
    return load_settings()

@app.post("/api/settings")
def update_settings(data: SettingsModel):
    save_settings(data.dict())
    return {"status": "success", "settings": data.dict()}

@app.get("/")
async def root():
    return {"message": "Farone API Online", "mt5_mode": "external"}
