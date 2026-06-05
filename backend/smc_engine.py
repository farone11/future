# backend/smc_engine.py
import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from datetime import datetime, time
from typing import Dict, Optional
from loguru import logger
import asyncio
import httpx

class SMCOrchestrator:
    def __init__(self, symbol: str = "XAUUSDc", api_url: str = "http://127.0.0.1:5400"):
        self.symbol = symbol
        self.api_url = api_url
        self.tf_exec = mt5.TIMEFRAME_M15
        self.tf_htf = mt5.TIMEFRAME_H1
        self.last_signal_time = None
        self.min_rr = 2.0
        self.session_killzone = [time(13,0), time(16,0)] # London-NY GMT+7
    
    def get_rates(self, tf, bars=200):
        rates = mt5.copy_rates_from_pos(self.symbol, tf, 0, bars)
        if rates is None: return None
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        return df
    
    def detect_structure(self) -> Dict:
        df = self.get_rates(self.tf_htf)
        if df is None or len(df) < 20: return {"structure": "NEUTRAL"}
        
        df['swing_high'] = df['high'][(df['high'].shift(1) < df['high']) & (df['high'].shift(-1) < df['high'])]
        df['swing_low'] = df['low'][(df['low'].shift(1) > df['low']) & (df['low'].shift(-1) > df['low'])]
        
        highs = df['swing_high'].dropna().tail(3).values
        lows = df['swing_low'].dropna().tail(3).values
        
        if len(highs) >= 2 and len(lows) >= 2:
            if highs[-1] > highs[-2] and lows[-1] > lows[-2]:
                return {"structure": "BULLISH", "bos_level": highs[-2], "trend": "UP"}
            elif highs[-1] < highs[-2] and lows[-1] < lows[-2]:
                return {"structure": "BEARISH", "bos_level": lows[-2], "trend": "DOWN"}
        return {"structure": "RANGING", "trend": "SIDEWAYS"}
    
    def find_ob(self, structure: Dict) -> Optional[Dict]:
        df = self.get_rates(self.tf_exec, 50)
        if df is None: return None
        
        for i in range(len(df)-5, 10, -1):
            body = abs(df['close'][i] - df['open'][i])
            avg_body = abs(df['close'] - df['open']).rolling(10).mean()[i]
            if pd.isna(avg_body) or body < avg_body * 1.5: continue
                
            if structure["trend"] == "UP" and df['close'][i] > df['open'][i]:
                for j in range(i-1, max(0, i-5), -1):
                    if df['close'][j] < df['open'][j]:
                        return {"type": "BULLISH_OB", "entry": df['high'][j], "sl_zone": df['low'][j]}
            elif structure["trend"] == "DOWN" and df['close'][i] < df['open'][i]:
                for j in range(i-1, max(0, i-5), -1):
                    if df['close'][j] > df['open'][j]:
                        return {"type": "BEARISH_OB", "entry": df['low'][j], "sl_zone": df['high'][j]}
        return None
    
    def is_killzone(self) -> bool:
        now = datetime.now().time()
        return self.session_killzone[0] <= now <= self.session_killzone[1]
    
    def build_signal(self, structure: Dict, ob: Dict) -> Optional[Dict]:
        if not ob or not self.is_killzone(): return None
        
        entry = ob["entry"]
        sl = ob["sl_zone"]
        risk = abs(entry - sl)
        if risk < 1.0 or risk > 15.0: return None
        
        if structure["trend"] == "UP":
            tp1 = entry + risk * 1.0
            tp2 = entry + risk * 2.0
            tp3 = entry + risk * 3.0
            signal_type = "BUY"
        else:
            tp1 = entry - risk * 1.0
            tp2 = entry - risk * 2.0
            tp3 = entry - risk * 3.0
            signal_type = "SELL"
        
        rr = abs(tp2 - entry) / risk
        if rr < self.min_rr: return None
        
        return {
            "type": signal_type,
            "entry": round(entry, 2),
            "sl": round(sl, 2),
            "tp": round(tp1, 2),
            "tp2": round(tp2, 2),
            "tp3": round(tp3, 2),
            "source": f"AI-SMC-{ob['type']}",
            "confidence": 88,
            "rr": round(rr, 1)
        }
    
    async def run_cycle(self):
        try:
            structure = self.detect_structure()
            if structure["structure"] == "RANGING": return
            
            ob = self.find_ob(structure)
            if not ob: return
            
            signal = self.build_signal(structure, ob)
            if not signal: return
            
            # Anti spam 15 menit
            now = datetime.now()
            if self.last_signal_time and (now - self.last_signal_time).seconds < 900:
                return
            
            async with httpx.AsyncClient() as client:
                res = await client.post(f"{self.api_url}/api/signals", json=signal, timeout=5.0)
                if res.status_code == 200:
                    self.last_signal_time = now
                    logger.success(f"AI Signal Posted: {signal['type']} @ {signal['entry']}")
                else:
                    logger.error(f"API error: {res.text}")
        except Exception as e:
            logger.error(f"SMC cycle error: {e}")
    
    async def start(self):
        logger.info("SMC Multi-Agent Engine Started")
        while True:
            await self.run_cycle()
            await asyncio.sleep(60) # Scan tiap 1 menit