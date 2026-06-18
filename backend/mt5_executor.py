import MetaTrader5 as mt5
import requests
import time
import os
from dotenv import load_dotenv
from datetime import datetime
import pytz

load_dotenv()

API_BASE = os.getenv("API_URL", "https://api.faronecapital.online")
SYMBOL = os.getenv("MT5_SYMBOL", "XAUUSDc")
MT5_PATH = os.getenv("MT5_PATH")
MT5_LOGIN = int(os.getenv("MT5_LOGIN", 0)) if os.getenv("MT5_LOGIN") else 0
MT5_PASSWORD = os.getenv("MT5_PASSWORD", "")
MT5_SERVER = os.getenv("MT5_SERVER", "")

RISK_PERCENT = 1.0  # Risk 1% per trade
MAGIC = 20260619
CHECK_INTERVAL = 3  # Cek API tiap 3 detik
last_executed_id = 0

def get_jakarta_time():
    return datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%H:%M:%S")

def init_mt5():
    print(f"[EXECUTOR] API Target: {API_BASE}")
    if MT5_LOGIN and MT5_PASSWORD and MT5_SERVER:
        if not mt5.initialize(path=MT5_PATH, login=MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
            print(f"[EXECUTOR] MT5 init failed: {mt5.last_error()}")
            return False
    else:
        if not mt5.initialize(path=MT5_PATH):
            print(f"[EXECUTOR] MT5 init failed: {mt5.last_error()}")
            return False
    
    acc = mt5.account_info()
    if not acc:
        print("[EXECUTOR] Gagal ambil account info")
        return False
        
    print(f"[EXECUTOR] MT5 Connected. Login: {acc.login} | Balance: ${acc.balance:.2f}")
    if not mt5.symbol_select(SYMBOL, True):
        print(f"[EXECUTOR] Gagal select {SYMBOL}")
        return False
    return True

def calc_lot_size(entry, sl):
    """Hitung lot berdasarkan risk %"""
    acc_info = mt5.account_info()
    if not acc_info: return 0.01
    
    balance = acc_info.balance
    risk_amount = balance * RISK_PERCENT / 100.0
    
    symbol_info = mt5.symbol_info(SYMBOL)
    if not symbol_info: return 0.01
    
    sl_points = abs(entry - sl) / symbol_info.point
    if sl_points == 0: return 0.01
    
    tick_value = symbol_info.trade_tick_value
    lot = risk_amount / (sl_points * tick_value)
    
    lot = max(symbol_info.volume_min, min(lot, symbol_info.volume_max))
    lot = round(lot / symbol_info.volume_step) * symbol_info.volume_step
    return round(lot, 2)

def open_order(signal):
    """Open market order berdasarkan signal dari API"""
    symbol_info = mt5.symbol_info(SYMBOL)
    if not symbol_info:
        print("[EXECUTOR] Symbol info error")
        return False
    
    entry = signal['entry']
    sl = signal['sl']
    tp1 = signal['tp1']
    lot = calc_lot_size(entry, sl)
    
    if lot < symbol_info.volume_min:
        print(f"[EXECUTOR] Lot {lot} kekecilan, min {symbol_info.volume_min}")
        return False
    
    point = symbol_info.point
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": SYMBOL,
        "volume": lot,
        "type": mt5.ORDER_TYPE_BUY if signal['type'] == "BUY" else mt5.ORDER_TYPE_SELL,
        "price": mt5.symbol_info_tick(SYMBOL).ask if signal['type'] == "BUY" else mt5.symbol_info_tick(SYMBOL).bid,
        "sl": round(sl, symbol_info.digits),
        "tp": round(tp1, symbol_info.digits),
        "deviation": 50,
        "magic": MAGIC,
        "comment": f"FaroneAI-{signal['id']}",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    result = mt5.order_send(request)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"[EXECUTOR] Order failed: {result.retcode} | {result.comment}")
        return False
    
    jkt = get_jakarta_time()
    print(f"[{jkt} WIB] [EXECUTOR] {signal['type']} Order OK | Ticket: {result.order} | Lot: {lot} | ID:{signal['id']}")
    return True

def check_api_signals():
    """GET /api/signals, cari yg WAITING, belum di-execute"""
    global last_executed_id
    try:
        r = requests.get(f"{API_BASE}/api/signals", timeout=10)
        if r.status_code != 200:
            print(f"[EXECUTOR] API Error {r.status_code}")
            return
        
        data = r.json()
        if not data.get('signals'): return
        
        # Ambil signal WAITING paling baru
        for sig in reversed(data['signals']):
            if sig['status'] == 'WAITING' and sig['id'] != last_executed_id:
                # Cek udah ada posisi dgn comment yg sama belum
                positions = mt5.positions_get(symbol=SYMBOL) or []
                if any(p.comment == f"FaroneAI-{sig['id']}" for p in positions):
                    last_executed_id = sig['id']
                    continue
                
                print(f"[EXECUTOR] New Signal ID:{sig['id']} | {sig['type']} | Entry:{sig['entry']}")
                if open_order(sig):
                    last_executed_id = sig['id']
                break # Cuma execute 1 per loop
                
    except Exception as e:
        print(f"[EXECUTOR] Exception: {e}")

def main():
    if not init_mt5(): return
    print("[EXECUTOR] Start monitoring API for new signals...")
    print("[EXECUTOR] Tekan CTRL+C buat stop\n")
    
    try:
        while True:
            check_api_signals()
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        print("\n[EXECUTOR] Stop by user")
    finally:
        mt5.shutdown()
        print("[EXECUTOR] MT5 shutdown")

if __name__ == "__main__":
    main()