//+------------------------------------------------------------------+
//|                                 Farone_GANN_Magnet_AI_v2.mq5     |
//|                   GANN MAGNET 30 AI MULTI AGENT EA MT5           |
//|                   Multi Timeframe Institutional Magnet Engine    |
//|                   FarOneCapital Edition + Dashboard Sender      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, FarOneCapital"
#property link      "https://faronecapital.online/"
#property version   "2.00"
#property strict

#include <JAson.mqh>        // WAJIB: Buat kirim JSON ke dashboard
#include <Trade/Trade.mqh>

//=== INPUT ===//
input double Lots                    = 0.1;
input int    Slippage               = 5;
input int    Magic                  = 2025;
input string DashboardURL           = "https://faronecapital.online/api/update"; // URL Cloudflare
input int    SendIntervalSeconds    = 1; // Kirim data tiap X detik

//=== GLOBAL ===//
CTrade trade;
datetime lastSend = 0;
datetime lastBarTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(Magic);
   trade.SetDeviationInPoints(Slippage);
   
   EventSetTimer(SendIntervalSeconds); // Timer buat kirim data
   Print("FarOne GANN Magnet AI v2 Loaded. Dashboard: ", DashboardURL);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Timer function - Kirim data ke dashboard                         |
//+------------------------------------------------------------------+
void OnTimer()
{
   SendToDashboard();
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!IsNewBar()) return;
   
   // --- LOGIKA GANN MAGNET LU YANG ASLI TARUH DI SINI ---
   // Contoh doang, ganti sama logic entry lu
   double eq = GetEQLevel();
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   if(bid > eq && !PositionSelect(_Symbol))
      trade.Buy(Lots, _Symbol);
   if(bid < eq && !PositionSelect(_Symbol))
      trade.Sell(Lots, _Symbol);
   // --- END LOGIKA ASLI ---
}

//+------------------------------------------------------------------+
//| Cek Bar Baru                                                     |
//+------------------------------------------------------------------+
bool IsNewBar()
{
   datetime currentBarTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(currentBarTime != lastBarTime)
   {
      lastBarTime = currentBarTime;
      return(true);
   }
   return(false);
}

//+------------------------------------------------------------------+
//| Hitung Level EQ GANN                                             |
//+------------------------------------------------------------------+
double GetEQLevel()
{
   double h = iHigh(_Symbol, PERIOD_H1, iHighest(_Symbol, PERIOD_H1, MODE_HIGH, 24, 0));
   double l = iLow(_Symbol, PERIOD_H1, iLowest(_Symbol, PERIOD_H1, MODE_LOW, 24, 0));
   return(l + (h-l) * 0.50);
}

//+------------------------------------------------------------------+
//| KIRIM DATA KE DASHBOARD CLOUDFLARE                               |
//+------------------------------------------------------------------+
void SendToDashboard()
{
   CJAVal json;
   
   // Card 1: Account
   json["balance"] = AccountInfoDouble(ACCOUNT_BALANCE);
   json["equity"] = AccountInfoDouble(ACCOUNT_EQUITY);
   json["profit"] = AccountInfoDouble(ACCOUNT_PROFIT);
   
   // Card 2: GANN % To EQ
   double h = iHigh(_Symbol, PERIOD_H1, iHighest(_Symbol, PERIOD_H1, MODE_HIGH, 24, 0));
   double l = iLow(_Symbol, PERIOD_H1, iLowest(_Symbol, PERIOD_H1, MODE_LOW, 24, 0));
   double eq = l + (h-l) * 0.50;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double pct = 0;
   if(h-l > 0) pct = ((bid - eq) / (h-l)) * 100.0;
   json["pctToEQ"] = NormalizeDouble(pct, 2);
   json["eqLevel"] = NormalizeDouble(eq, 2);
   
   // Card 3: Position
   if(PositionSelect(_Symbol))
   {
      json["position"] = PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? "BUY" : "SELL";
      json["lots"] = PositionGetDouble(POSITION_VOLUME);
      json["openPrice"] = PositionGetDouble(POSITION_PRICE_OPEN);
      json["posProfit"] = PositionGetDouble(POSITION_PROFIT);
   } else {
      json["position"] = "FLAT";
      json["lots"] = 0;
      json["openPrice"] = 0;
      json["posProfit"] = 0;
   }
   
   // Card 4-7: Custom lu
   json["symbol"] = _Symbol;
   json["price"] = bid;
   json["agentsActive"] = 30;
   json["timestamp"] = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS);
   json["magic"] = Magic;
   
   // Kirim
   char data[], result[];
   string headers = "Content-Type: application/json\r\n";
   string json_str = json.Serialize();
   StringToCharArray(json_str, data, 0, StringLen(json_str));
   
   int res = WebRequest("POST", DashboardURL, headers, 5000, data, result, headers);
   
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4060) Print("WebRequest Error: Tambahin URL di Tools > Options > Expert Advisors");
      else Print("WebRequest Error: ", err);
   }
}
//+------------------------------------------------------------------+