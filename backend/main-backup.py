from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
import MetaTrader5 as mt5
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
from smc_engine import SMCOrchestrator

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
        # Sort: AI signals dulu, terus yg terbaru
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

    try:
        tick = mt5.symbol_info_tick(SYMBOL)
        if tick is None:
            raise Exception(f"Symbol {SYMBOL} tidak ditemukan")

        account = mt5.account_info()
        if account is None:
            raise Exception("Gagal ambil info akun MT5")

        rates_d1 = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_D1, 0, 2)
        daily_change = 0
        daily_change_pct = 0
        if rates_d1 is not None and len(rates_d1) > 1:
            prev_close = rates_d1[-2]['close']
            daily_change = round(tick.bid - prev_close, 2)
            daily_change_pct = round((daily_change / prev_close) * 100, 2) if prev_close else 0

        jakarta_time = datetime.fromtimestamp(tick.time, tz=UTC).astimezone(JAKARTA)

        data = {
            "price": tick.bid, "ask": tick.ask, "spread": round(tick.ask - tick.bid, 2),
            "daily_change": daily_change, "daily_change_pct": daily_change_pct,
            "time": jakarta_time.strftime("%H:%M:%S"), "date": jakarta_time.strftime("%Y-%m-%d"),
            "balance": account.balance, "equity": account.equity,
            "margin": account.margin, "free_margin": account.margin_free,
        }
        CACHE["data"] = data
        CACHE["last_good"] = data
        CACHE["timestamp"] = now
        return data
    except Exception as e:
        logger.error(f"MT5 Error: {e}")
        return CACHE["last_good"] or {"error": str(e)}

def get_daily_dd_percent() -> float:
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
    # PRIORITAS: AI signal dulu, baru manual
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
            tick = mt5.symbol_info_tick(SYMBOL)
            if not tick:
                await asyncio.sleep(1)
                continue

            bid, ask = tick.bid, tick.ask
            updated_signals = []

            for signal in SIGNALS_CACHE["signals"]:
                old_status = signal["status"]
                new_status = old_status
                exit_price = signal.get("exit_price")
                pnl = signal.get("pnl")
                close_reason = signal.get("close_reason")

                # 1. WAITING -> ACTIVE
                if signal["status"] == "WAITING":
                    if signal["type"] == "BUY" and ask <= signal["entry"]:
                        new_status = "ACTIVE"
                        signal["triggered_at"] = datetime.now(JAKARTA).isoformat()
                        logger.info(f"Signal {signal['id']} TRIGGERED: BUY @ {ask}")
                    elif signal["type"] == "SELL" and bid >= signal["entry"]:
                        new_status = "ACTIVE"
                        signal["triggered_at"] = datetime.now(JAKARTA).isoformat()
                        logger.info(f"Signal {signal['id']} TRIGGERED: SELL @ {bid}")

                # 2. ACTIVE -> CLOSED kalo kena TP/SL
                elif signal["status"] == "ACTIVE":
                    if signal["type"] == "BUY":
                        # Check TP3 -> TP2 -> TP1 -> SL
                        if signal.get("tp3") and bid >= signal["tp3"]:
                            new_status = "CLOSED"
                            close_reason = "TP3_HIT"
                            exit_price = signal["tp3"]
                            pnl = round((exit_price - signal["entry"]) * 100, 2)
                        elif signal.get("tp2") and bid >= signal["tp2"]:
                            new_status = "CLOSED"
                            close_reason = "TP2_HIT"
                            exit_price = signal["tp2"]
                            pnl = round((exit_price - signal["entry"]) * 100, 2)
                        elif bid >= signal["tp1"]:
                            new_status = "CLOSED"
                            close_reason = "TP1_HIT"
                            exit_price = signal["tp1"]
                            pnl = round((exit_price - signal["entry"]) * 100, 2)
                        elif bid <= signal["sl"]:
                            new_status = "CLOSED"
                            close_reason = "SL_HIT"
                            exit_price = signal["sl"]
                            pnl = round((signal["sl"] - signal["entry"]) * 100, 2)

                    else: # SELL
                        if signal.get("tp3") and ask <= signal["tp3"]:
                            new_status = "CLOSED"
                            close_reason = "TP3_HIT"
                            exit_price = signal["tp3"]
                            pnl = round((signal["entry"] - exit_price) * 100, 2)
                        elif signal.get("tp2") and ask <= signal["tp2"]:
                            new_status = "CLOSED"
                            close_reason = "TP2_HIT"
                            exit_price = signal["tp2"]
                            pnl = round((signal["entry"] - exit_price) * 100, 2)
                        elif ask <= signal["tp1"]:
                            new_status = "CLOSED"
                            close_reason = "TP1_HIT"
                            exit_price = signal["tp1"]
                            pnl = round((signal["entry"] - exit_price) * 100, 2)
                        elif ask >= signal["sl"]:
                            new_status = "CLOSED"
                            close_reason = "SL_HIT"
                            exit_price = signal["sl"]
                            pnl = round((signal["entry"] - signal["sl"]) * 100, 2)

                # Update current price buat dashboard
                signal["current_price"] = bid if signal["type"] == "BUY" else ask

                if new_status!= old_status:
                    signal["status"] = new_status
                    signal["exit_price"] = exit_price
                    signal["pnl"] = pnl
                    signal["close_reason"] = close_reason
                    if new_status == "CLOSED":
                        signal["closed_at"] = datetime.now(JAKARTA).isoformat()
                        logger.success(f"Signal {signal['id']} {close_reason}: PnL ${pnl}")
                    updated_signals.append(signal)

            if updated_signals:
                save_signals()
                for s in updated_signals:
                    await broadcast_signal(s)

        except Exception as e:
            logger.error(f"Monitor error: {e}\n{traceback.format_exc()}")

        await asyncio.sleep(1)

# === AI SMC ENGINE ===
smc_orchestrator = SMCOrchestrator(SYMBOL, "http://127.0.0.1:5400")

@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("logs").mkdir(exist_ok=True)
    if not mt5.initialize():
        logger.error(f"MT5 Gagal Initialize: {mt5.last_error()}")
    else:
        logger.success(f"MT5 Connected | Symbol: {SYMBOL} | Timezone: GMT+7")
    load_settings()
    load_signals_to_cache()
    asyncio.create_task(signal_monitor())
    asyncio.create_task(smc_orchestrator.start())
    yield
    mt5.shutdown()
    logger.info("MT5 Shutdown")

app = FastAPI(title="FARONE.AI MT5 API", version="7.1 AI-SMC", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://app.farone.ai", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    mt5_ok = mt5.terminal_info() is not None
    return {"status": "ok" if mt5_ok else "error", "mt5": mt5_ok, "timestamp": datetime.now(JAKARTA).isoformat()}

@app.get("/api/dashboard")
def dashboard():
    mt5_data = get_mt5_data_cached()
    if "error" in mt5_data:
        return {"error": mt5_data["error"], "ai_status": "MT5 ERROR", "fallback": True}

    settings = load_settings()
    try:
        date_from = datetime.now(JAKARTA) - timedelta(days=30)
        date_to = datetime.now(JAKARTA) + timedelta(days=1)
        deals = mt5.history_deals_get(date_from, date_to)
        closed_deals = [d for d in deals if d.entry == 1 and d.symbol == SYMBOL] if deals else []
        total_trades = len(closed_deals)
        win_trades = len([d for d in closed_deals if (d.profit + d.swap + d.commission) > 0])
        win_rate = round((win_trades / total_trades * 100), 1) if total_trades > 0 else 0
    except Exception as e:
        logger.warning(f"Dashboard deals error: {e}")
        win_rate = 0
        total_trades = 0

    positions = mt5.positions_get(symbol=SYMBOL)
    open_positions = len(positions) if positions else 0
    daily_dd = get_daily_dd_percent()
    kill_switch_triggered = settings["kill_switch"] and daily_dd >= settings["max_daily_dd"]

    return {
        "ai_status": "ACTIVE" if not kill_switch_triggered else "KILL SWITCH",
        "gold_price": mt5_data["price"], "ask_price": mt5_data["ask"], "spread": mt5_data["spread"],
        "daily_change": mt5_data["daily_change"], "daily_change_pct": mt5_data["daily_change_pct"],
        "win_rate": win_rate, "total_trades": total_trades, "open_positions": open_positions,
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
    logger.info("Dashboard WS connected")
    try:
        while True:
            data = dashboard()
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info("Dashboard WS disconnected")
    except Exception as e:
        logger.error(f"Dashboard WS error: {e}")

@app.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket):
    await websocket.accept()
    SIGNALS_CACHE["clients"].add(websocket)
    client_id = f"{websocket.client.host}:{websocket.client.port}"
    logger.info(f"Signals WS connected: {client_id}. Total: {len(SIGNALS_CACHE['clients'])}")

    try:
        await websocket.send_json({
            "type": "init",
            "signals": SIGNALS_CACHE["signals"],
            "server_time": datetime.now(JAKARTA).isoformat()
        })

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({
                    "type": "heartbeat",
                    "time": datetime.now(JAKARTA).strftime("%H:%M:%S"),
                    "active_clients": len(SIGNALS_CACHE["clients"])
                })

    except WebSocketDisconnect:
        logger.info(f"Signals WS disconnected gracefully: {client_id}")
    except Exception as e:
        logger.error(f"Signals WS error: {e}")
    finally:
        SIGNALS_CACHE["clients"].discard(websocket)
        logger.info(f"Client removed. Total: {len(SIGNALS_CACHE['clients'])}")

@app.get("/api/signals")
def get_signals():
    return {"signals": SIGNALS_CACHE["signals"]}

@app.post("/api/signals")
async def create_signal(signal: NewSignalModel):
    rr = round(abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl), 1) if signal.entry!= signal.sl else 0
    tick = mt5.symbol_info_tick(SYMBOL)
    current_price = tick.bid if tick else signal.entry

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
    logger.info(f"New signal: {new_signal['type']} @ {new_signal['entry']} | Source: {new_signal['source']}")
    await broadcast_signal(new_signal)
    return {"status": "success", "signal": new_signal}

@app.get("/api/analytics")
def analytics(days: int = Query(30, ge=1, le=365)):
    try:
        # Gabungin MT5 trades + AI Signals yg CLOSED
        utc_from = datetime.now(JAKARTA) - timedelta(days=days)
        utc_to = datetime.now(JAKARTA) + timedelta(days=1)
        deals = mt5.history_deals_get(utc_from, utc_to)
        deals_close = [d for d in deals if d.entry == 1 and d.symbol == SYMBOL] if deals else []

        # Tambah signal AI yg closed
        ai_closed = [s for s in SIGNALS_CACHE["signals"] if s["status"] == "CLOSED" and s.get("pnl") is not None]

        if len(deals_close) == 0 and len(ai_closed) == 0:
            return {"error": "No data", "total_pl": 0, "profit_factor": 0, "max_dd_pct": 0, "sharpe_ratio": 0, "sortino_ratio": 0, "expectancy": 0, "recovery_factor": 0, "avg_win": 0, "avg_loss": 0, "equity_curve": []}

        account = mt5.account_info()
        if not account: raise Exception("Account info missing")

        # Gabungin returns
        mt5_returns = [d.profit + d.swap + d.commission for d in deals_close]
        ai_returns = [s["pnl"] for s in ai_closed]
        returns = mt5_returns + ai_returns

        total_pl = sum(returns)
        wins = [r for r in returns if r > 0]
        losses = [abs(r) for r in returns if r < 0]
        profit_factor = round(sum(wins) / sum(losses), 2) if losses else 0
        avg_win = round(np.mean(wins), 2) if wins else 0
        avg_loss = round(np.mean(losses), 2) if losses else 0
        expectancy = round((len(wins)/len(returns) * avg_win) - (len(losses)/len(returns) * avg_loss), 2) if returns else 0

        if len(returns) > 1:
            returns_np = np.array(returns)
            sharpe = round(np.mean(returns_np) / np.std(returns_np) * np.sqrt(252), 2) if np.std(returns_np) > 0 else 0
            downside = returns_np[returns_np < 0]
            sortino = round(np.mean(returns_np) / np.std(downside) * np.sqrt(252), 2) if len(downside) > 0 and np.std(downside) > 0 else 0
        else:
            sharpe = sortino = 0

        # Equity curve
        start_balance = account.balance - total_pl
        equity_curve = []
        running_equity = start_balance
        peak = start_balance
        max_dd = 0

        for i, pl in enumerate(returns):
            running_equity += pl
            peak = max(peak, running_equity)
            dd = peak - running_equity
            max_dd = max(max_dd, dd)
            equity_curve.append({"date": f"Trade {i+1}", "equity": round(running_equity, 2), "drawdown": round(dd, 2)})

        recovery_factor = round(total_pl / max_dd, 2) if max_dd > 0 else 0
        max_dd_pct = round(max_dd / peak * 100, 2) if peak > 0 else 0

        return {
            "period_days": days, "total_pl": round(total_pl, 2), "max_drawdown": round(max_dd, 2),
            "max_dd_pct": max_dd_pct, "profit_factor": profit_factor, "expectancy": expectancy,
            "sharpe_ratio": sharpe, "sortino_ratio": sortino, "recovery_factor": recovery_factor,
            "avg_win": avg_win, "avg_loss": avg_loss, "equity_curve": equity_curve[-200:]
        }
    except Exception as e:
        logger.error(f"Analytics Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
def history(days: int = Query(30, ge=1, le=365)):
    try:
        utc_from = datetime.now(JAKARTA) - timedelta(days=days)
        utc_to = datetime.now(JAKARTA) + timedelta(days=1)
        deals = mt5.history_deals_get(utc_from, utc_to)
        if deals is None: return {"trades": []}
        deals_close = [d for d in deals if d.entry == 1 and d.symbol == SYMBOL]
        trades = []
        for d in sorted(deals_close, key=lambda x: x.time, reverse=True):
            dt = datetime.fromtimestamp(d.time, tz=UTC).astimezone(JAKARTA)
            profit = d.profit + d.swap + d.commission
            trades.append({"ticket": d.position_id, "date": dt.strftime("%Y-%m-%d %H:%M"), "type": "BUY" if d.type == 0 else "SELL", "volume": d.volume, "price": d.price, "profit": round(profit, 2), "result": "WIN" if profit >= 0 else "LOSS"})
        return {"trades": trades[:100]}
    except Exception as e:
        logger.error(f"History Error: {e}")
        return {"error": str(e)}

@app.get("/api/positions")
def positions():
    try:
        positions = mt5.positions_get(symbol=SYMBOL)
        if positions is None: return {"positions": []}
        result = []
        for pos in positions:
            result.append({"ticket": pos.ticket, "type": "BUY" if pos.type == 0 else "SELL", "volume": pos.volume, "price_open": pos.price_open, "price_current": pos.price_current, "sl": pos.sl, "tp": pos.tp, "profit": round(pos.profit + pos.swap, 2)})
        return {"positions": result}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/settings")
def get_settings():
    return load_settings()

@app.post("/api/settings")
def update_settings(data: SettingsModel):
    save_settings(data.dict())
    return {"status": "success", "settings": data.dict()}

@app.get("/api/export/pdf")
def export_pdf(days: int = 30):
    try:
        analytics_data = analytics(days)
        if "error" in analytics_data: raise HTTPException(status_code=400, detail=analytics_data["error"])
    except HTTPException as e:
        return {"error": f"Cannot generate PDF: {e.detail}"}
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 800, "FARONE.AI Performance Report")
    p.setFont("Helvetica", 12)
    p.drawString(100, 770, f"Period: {days} days | Symbol: {DISPLAY_SYMBOL}")
    p.drawString(100, 740, f"Total P/L: ${analytics_data['total_pl']}")
    p.drawString(100, 720, f"Max Drawdown: ${analytics_data['max_drawdown']} ({analytics_data['max_dd_pct']}%)")
    p.drawString(100, 700, f"Profit Factor: {analytics_data['profit_factor']}")
    p.drawString(100, 680, f"Sharpe Ratio: {analytics_data['sharpe_ratio']}")
    p.drawString(100, 660, f"Sortino Ratio: {analytics_data['sortino_ratio']}")
    p.drawString(100, 640, f"Expectancy: ${analytics_data['expectancy']}")
    p.drawString(100, 600, "Generated by FARONE.AI | For Institutional Use Only")
    p.showPage()
    p.save()
    buffer.seek(0)
    logger.info(f"PDF Report generated for {days} days")
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=farone_report.pdf"})
