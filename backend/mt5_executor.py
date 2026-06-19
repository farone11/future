import MetaTrader5 as mt5
import requests
import time
import os
import re
import logging
import sys
from dotenv import load_dotenv
from datetime import datetime, timezone
import pytz
import numpy as np

load_dotenv()

# --- LOGGER V5.2 ---
LOG_FILE = "C:/Users/DELL/Documents/New project/Project_02/backend/farone_executor.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(LOG_FILE, encoding='utf-8'), logging.StreamHandler(sys.stdout)]
)
def log(msg): logging.info(msg)
# --- END LOGGER ---

API_BASE = os.getenv("API_URL", "https://api.faronecapital.online")
SYMBOL = os.getenv("MT5_SYMBOL", "XAUUSDc")
MT5_PATH = os.getenv("MT5_PATH", "")
MT5_LOGIN = int(os.getenv("MT5_LOGIN", 0)) if os.getenv("MT5_LOGIN") else 0
MT5_PASSWORD = os.getenv("MT5_PASSWORD", "")
MT5_SERVER = os.getenv("MT5_SERVER", "")

RISK_PERCENT = 1.0
MAGIC = 20260619
CHECK_INTERVAL = 3
executed_ids = set()
last_signal_time = 0
daily_start_balance = 0
today_date = -1

# --- SMC ENGINE V3.0 PARAMS ---
MIN_ATR_POINTS = 100
MIN_CONFIDENCE = 70

def get_jakarta_time():
    return datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%H:%M:%S")

def init_mt5():
    log("="*70)
    log(f"[ENGINE] FARONE.AI INSTITUTIONAL SMC ENGINE v5.2")
    log("="*70)
    log(f"[ENGINE] API Target: {API_BASE}")
    log(f"[ENGINE] Symbol: {SYMBOL}")

    init_kwargs = {}
    if MT5_PATH and os.path.exists(MT5_PATH):
        init_kwargs['path'] = MT5_PATH
    if MT5_LOGIN and MT5_PASSWORD and MT5_SERVER:
        init_kwargs.update({'login': MT5_LOGIN, 'password': MT5_PASSWORD, 'server': MT5_SERVER})

    if not mt5.initialize(**init_kwargs):
        log(f"[ENGINE] ❌ MT5 init failed: {mt5.last_error()}")
        return False

    acc = mt5.account_info()
    if not acc:
        log("[ENGINE] ❌ Gagal ambil account info")
        mt5.shutdown()
        return False

    log(f"[ENGINE] ✅ MT5 Connected. Login: {acc.login} | Balance: ${acc.balance:.2f}")
    mt5.symbol_select(SYMBOL, True)
    log("[ENGINE] ✅ Init OK\n")
    return True

def detect_bos(timeframe, bullish, shift=1):
    rates = mt5.copy_rates_from_pos(SYMBOL, timeframe, shift, 3)
    if rates is None or len(rates) < 3: return False
    h1, h2 = rates[1]['high'], rates[2]['high']
    l1, l2 = rates[1]['low'], rates[2]['low']
    c1 = rates[1]['close']
    if bullish: return h1 > h2 and l1 > l2 and c1 > h2
    return l1 < l2 and h1 < h2 and c1 < l2

def detect_liquidity_sweep(bullish):
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M15, 1, 20)
    if rates is None: return False
    eq_high = np.max(rates['high'])
    eq_low = np.min(rates['low'])
    tick = mt5.symbol_info_tick(SYMBOL)
    if not tick: return False
    if bullish:
        return tick.bid < eq_low and rates[-1]['close'] > eq_low
    return tick.ask > eq_high and rates[-1]['close'] < eq_high

def get_last_ob(bullish):
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M15, 2, 50)
    if rates is None: return None, None
    for i in range(len(rates)-1):
        idx = len(rates) - 1 - i
        o, c, h, l = rates[idx]['open'], rates[idx]['close'], rates[idx]['high'], rates[idx]['low']
        body = abs(c - o)
        range_c = h - l
        if range_c == 0: continue
        if bullish and c < o and body > range_c * 0.5: return h, l
        if not bullish and c > o and body > range_c * 0.5: return h, l
    return None, None

def detect_fvg(bullish):
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M15, 1, 3)
    if rates is None or len(rates) < 3: return None, None
    h1, l1 = rates[2]['high'], rates[2]['low']
    h3, l3 = rates[0]['high'], rates[0]['low']
    if bullish and h1 < l3: return l3, h1
    if not bullish and l1 > h3: return l1, h3
    return None, None

def is_discount():
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_H4, 1, 50)
    if rates is None: return False
    swing_h = np.max(rates['high'])
    swing_l = np.min(rates['low'])
    mid = swing_l + (swing_h - swing_l) * 0.5
    tick = mt5.symbol_info_tick(SYMBOL)
    return tick and tick.bid < mid

def get_session():
    h = datetime.now(timezone.utc).hour
    if 7 <= h < 10: return "LONDON"
    if 12 <= h < 15: return "NEWYORK"
    return "BLOCK"

def check_atr():
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M15, 0, 15)
    if rates is None: return False
    tr = np.maximum(rates['high'][1:] - rates['low'][1:],
                    np.abs(rates['high'][1:] - rates['close'][:-1]),
                    np.abs(rates['low'][1:] - rates['close'][:-1]))
    atr = np.mean(tr)
    return atr / mt5.symbol_info(SYMBOL).point > MIN_ATR_POINTS

def check_risk():
    global daily_start_balance, today_date
    acc = mt5.account_info()
    if not acc: return False
    if today_date!= datetime.now().day:
        today_date = datetime.now().day
        daily_start_balance = acc.balance
    dd = (daily_start_balance - acc.equity) / daily_start_balance * 100
    if dd >= 3.0: return False
    if len(mt5.positions_get(symbol=SYMBOL) or []) >= 3: return False
    return True

def calc_confidence(buy):
    score = 0
    if detect_bos(mt5.TIMEFRAME_H1, buy): score += 20
    if detect_liquidity_sweep(buy): score += 20
    obh, obl = get_last_ob(buy)
    if obh: score += 15
    fvgh, fvgl = detect_fvg(buy)
    if fvgh: score += 10
    if get_session()!= "BLOCK": score += 10
    if check_atr(): score += 10
    return score

def post_signal_to_api(direction, entry, sl, tp, confidence, session):
    jkt_time = datetime.now(pytz.timezone('Asia/Jakarta'))
    tick = mt5.symbol_info_tick(SYMBOL)
    if not tick: return False
    
    rr_val = abs(entry - sl)
    if rr_val > 0:
        rr = round(abs(tp - entry) / rr_val, 1)
        tp2 = entry + (entry - sl) * 2 if direction == "BUY" else entry - (sl - entry) * 2
    else:
        rr = 0
        tp2 = tp
    
    payload = {
        "pair": "XAUUSD",
        "type": direction,
        "entry": round(entry, 2),
        "sl": round(sl, 2),
        "tp": round(tp, 2),
        "tp1": round(tp, 2),
        "tp2": round(tp2, 2),
        "tp3": None,
        "status": "WAITING",
        "time": jkt_time.strftime("%H:%M:%S"),
        "date": jkt_time.strftime("%Y-%m-%d"),
        "confidence": confidence,
        "source": "FARONE_AI_INSTITUTIONAL_SMC",
        "rr": rr,
        "pnl": 0,
        "current_price": round(tick.bid, 2),
        "close_reason": None,
        "closed_at": None,
        "triggered_at": None
    }
    
    try:
        r = requests.post(f"{API_BASE}/api/signals", json=payload, timeout=5)
        log(f"[ENGINE] API POST: {r.status_code} | ID:{r.json().get('signal',{}).get('id')} | {direction} {entry}")
        return r.status_code == 200
    except Exception as e:
        log(f"[ENGINE] API POST Error: {e}")
        return False

def scan_smc_signals():
    global last_signal_time
    if time.time() - last_signal_time < 300: return
    if not check_risk(): return
    if get_session() == "BLOCK": return
    if not check_atr(): return

    bias_h4 = detect_bos(mt5.TIMEFRAME_H4, True)
    tick = mt5.symbol_info_tick(SYMBOL)
    if not tick: return

    if bias_h4 and is_discount() and detect_liquidity_sweep(True):
        obh, obl = get_last_ob(True)
        fvgh, fvgl = detect_fvg(True)
        if obh and fvgh:
            zone_high = min(obh, fvgh)
            zone_low = max(obl, fvgl)
            if zone_low <= tick.ask <= zone_high:
                score = calc_confidence(True)
                log(f"[ENGINE] BUY Setup Found | Score: {score}")
                if score >= MIN_CONFIDENCE:
                    entry = tick.ask
                    sl = obl - 10 * mt5.symbol_info(SYMBOL).point
                    tp = entry + (entry - sl) * 5
                    if post_signal_to_api("BUY", entry, sl, tp, score, get_session()):
                        last_signal_time = time.time()

    if not bias_h4 and not is_discount() and detect_liquidity_sweep(False):
        obh, obl = get_last_ob(False)
        fvgh, fvgl = detect_fvg(False)
        if obh and fvgh:
            zone_high = min(obh, fvgh)
            zone_low = max(obl, fvgl)
            if zone_low <= tick.bid <= zone_high:
                score = calc_confidence(False)
                log(f"[ENGINE] SELL Setup Found | Score: {score}")
                if score >= MIN_CONFIDENCE:
                    entry = tick.bid
                    sl = obh + 10 * mt5.symbol_info(SYMBOL).point
                    tp = entry - (sl - entry) * 5
                    if post_signal_to_api("SELL", entry, sl, tp, score, get_session()):
                        last_signal_time = time.time()

def parse_price_field(value):
    if value is None: return 0.0
    if isinstance(value, (int, float)): return float(value)
    cleaned = str(value).replace('$', '').replace(',', '').strip()
    match = re.search(r'(\d+\.?\d*)', cleaned)
    if match: return float(match.group(1))
    return 0.0

def calc_lot_size(entry, sl):
    acc_info = mt5.account_info()
    if not acc_info: return 0.01
    balance = acc_info.balance
    risk_amount = balance * RISK_PERCENT / 100.0
    symbol_info = mt5.symbol_info(SYMBOL)
    if not symbol_info or symbol_info.point == 0: return 0.01
    sl_points = abs(entry - sl) / symbol_info.point
    if sl_points == 0 or symbol_info.trade_tick_value == 0: return symbol_info.volume_min
    lot = risk_amount / (sl_points * symbol_info.trade_tick_value)
    lot = round(lot / symbol_info.volume_step) * symbol_info.volume_step
    lot = max(symbol_info.volume_min, min(lot, symbol_info.volume_max))
    return round(lot, 2)

def execute_signal(sig):
    symbol_info = mt5.symbol_info(SYMBOL)
    tick = mt5.symbol_info_tick(SYMBOL)
    if not symbol_info or not tick: return False

    entry, sl = sig['entry'], sig['sl']
    tp1 = sig.get('tp1') or sig.get('tp')
    if not tp1 or tp1 == 0:
        rr = abs(entry - sl)
        tp1 = entry + rr if sig['type'] == "BUY" else entry - rr

    lot = calc_lot_size(entry, sl)
    if lot < symbol_info.volume_min: return False

    point = symbol_info.point
    buffer = max(10 * point, symbol_info.trade_stops_level * point)
    request = {
        "symbol": SYMBOL, "volume": lot, "magic": MAGIC, "comment": f"FaroneAI-{sig['id']}",
        "type_time": mt5.ORDER_TIME_GTC, "type_filling": mt5.ORDER_FILLING_IOC,
    }

    if sig['type'] == 'BUY':
        if entry > tick.ask + buffer:
            request.update({"action": mt5.TRADE_ACTION_PENDING, "type": mt5.ORDER_TYPE_BUY_STOP, "price": entry, "sl": sl, "tp": tp1})
            order_type = "BUY STOP"
        elif entry < tick.bid - buffer:
            request.update({"action": mt5.TRADE_ACTION_PENDING, "type": mt5.ORDER_TYPE_BUY_LIMIT, "price": entry, "sl": sl, "tp": tp1})
            order_type = "BUY LIMIT"
        else:
            request.update({"action": mt5.TRADE_ACTION_DEAL, "type": mt5.ORDER_TYPE_BUY, "price": tick.ask, "sl": sl, "tp": tp1})
            order_type = "BUY MARKET"
    else:
        if entry < tick.bid - buffer:
            request.update({"action": mt5.TRADE_ACTION_PENDING, "type": mt5.ORDER_TYPE_SELL_STOP, "price": entry, "sl": sl, "tp": tp1})
            order_type = "SELL STOP"
        elif entry > tick.ask + buffer:
            request.update({"action": mt5.TRADE_ACTION_PENDING, "type": mt5.ORDER_TYPE_SELL_LIMIT, "price": entry, "sl": sl, "tp": tp1})
            order_type = "SELL LIMIT"
        else:
            request.update({"action": mt5.TRADE_ACTION_DEAL, "type": mt5.ORDER_TYPE_SELL, "price": tick.bid, "sl": sl, "tp": tp1})
            order_type = "SELL MARKET"

    result = mt5.order_send(request)
    if result.retcode!= mt5.TRADE_RETCODE_DONE:
        log(f"[ENGINE] Order failed: {result.retcode} | {result.comment}")
        return False

    log(f"[{get_jakarta_time()} WIB] [ENGINE] ✅ {order_type} OK | Ticket: {result.order} | Lot: {lot} | ID:{sig['id']}")
    try:
        requests.put(f"{API_BASE}/api/signals/{sig['id']}",
                    json={"status": "ACTIVE", "triggered_at": datetime.now(pytz.utc).isoformat()}, timeout=5)
    except: pass
    return True

def check_api_signals():
    global executed_ids
    try:
        r = requests.get(f"{API_BASE}/api/signals", timeout=10)
        if r.status_code!= 200: return
        data = r.json()
        if not data.get('signals'): return
        for sig in data['signals']:
            if str(sig.get('status', '')).upper() not in ['WAITING', '']: continue
            if sig['id'] in executed_ids: continue
            if sig.get('pair') != 'XAUUSD': continue
            all_comments = [p.comment for p in mt5.positions_get(symbol=SYMBOL) or []] + [o.comment for o in mt5.orders_get(symbol=SYMBOL) or []]
            if f"FaroneAI-{sig['id']}" in all_comments:
                executed_ids.add(sig['id'])
                continue
            sig_type = sig.get('type') or ('SELL' if str(sig.get('direction','')).upper() == 'SHORT' else 'BUY')
            mapped_sig = {
                'id': sig['id'], 'type': sig_type,
                'entry': parse_price_field(sig.get('entry') or sig.get('entry_zone')),
                'sl': parse_price_field(sig.get('sl') or sig.get('stop_loss')),
                'tp1': parse_price_field(sig.get('tp') or sig.get('tp1') or sig.get('target_1'))
            }
            if mapped_sig['entry'] == 0 or mapped_sig['sl'] == 0: continue
            log(f"[ENGINE] 🔔 New Signal ID:{mapped_sig['id']} | {mapped_sig['type']} | Entry:{mapped_sig['entry']}")
            if execute_signal(mapped_sig): executed_ids.add(mapped_sig['id'])
    except Exception as e:
        log(f"[ENGINE] Exception: {e}")

def main():
    if not init_mt5(): return
    log("[ENGINE] Start SMC Scanner + Executor...")
    log("[ENGINE] Tekan CTRL+C buat stop\n")
    try:
        while True:
            scan_smc_signals()
            check_api_signals()
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        log("\n[ENGINE] Stop by user")
    finally:
        mt5.shutdown()
        log("[ENGINE] MT5 shutdown")

if __name__ == "__main__":
    main()