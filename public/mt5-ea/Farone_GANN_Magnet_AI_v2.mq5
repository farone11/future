//+------------------------------------------------------------------+
//|          GANN MAGNET 30 AI MULTI AGENT EA MT5                    |
//|      Multi Timeframe Institutional Magnet Engine                 |
//|                     FarOneCapital Edition                        |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, FarOneCapital"
#property link      "https://faronecapital-mpwoya25.durable.site/"
#property version   "2.00"

#include <Trade/Trade.mqh>

//====================================================//
// INPUT
//====================================================//
input double Lots               = 0.1;
input int    Slippage           = 5;

input double StopLossPoints     = 4500;
input double TakeProfitPoints   = 9900;

input bool Enable_M1            = false;
input bool Enable_M5            = false;
input bool Enable_M15           = true;
input bool Enable_M30           = true;
input bool Enable_H1            = true;
input bool Enable_H4            = true;
input bool Enable_D1            = true;

input int Lookback              = 240;

input bool OnePositionPerTF     = true;
input bool ShowPanel            = true;

//====================================================//
// GLOBAL
//====================================================//
CTrade Trade;

string EAName      = "30_AI_MULTI_AGENT_MT5";
string PanelPrefix = "";

ENUM_TIMEFRAMES TFs[7] =
{
   PERIOD_M1,
   PERIOD_M5,
   PERIOD_M15,
   PERIOD_M30,
   PERIOD_H1,
   PERIOD_H4,
   PERIOD_D1
};

string TFNames[7] =
{
   "M1","M5","M15","M30","H1","H4","D1"
};

bool TFEnabled[7];

double TF_High[7];
double TF_Low[7];
double TF_EQ[7];
double TF_Range[7];
double TF_Percent[7];

bool TF_DataReady[7];

long MagicNumbers[7] =
{
   10001,
   10005,
   10015,
   10030,
   10060,
   10240,
   11440
};

string MemoryFiles[7] =
{
   "memory_M1.csv",
   "memory_M5.csv",
   "memory_M15.csv",
   "memory_M30.csv",
   "memory_H1.csv",
   "memory_H4.csv",
   "memory_D1.csv"
};

//====================================================//
// GET MAGIC
//====================================================//
long GetMagic(int index)
{
   return MagicNumbers[index];
}

//====================================================//
// INIT TF
//====================================================//
void InitTFEnable()
{
   TFEnabled[0] = Enable_M1;
   TFEnabled[1] = Enable_M5;
   TFEnabled[2] = Enable_M15;
   TFEnabled[3] = Enable_M30;
   TFEnabled[4] = Enable_H1;
   TFEnabled[5] = Enable_H4;
   TFEnabled[6] = Enable_D1;
}

//====================================================//
// PRELOAD TF
//====================================================//
void PreloadAllTF()
{
   for(int i=0;i<7;i++)
   {
      if(!TFEnabled[i])
         continue;

      MqlRates rates[];
      CopyRates(_Symbol,TFs[i],0,5,rates);
   }
}

//====================================================//
// GET HIGH
//====================================================//
double GetHighTF(ENUM_TIMEFRAMES tf)
{
   double high[];

   ArraySetAsSeries(high,true);

   int copied =
      CopyHigh(_Symbol,tf,0,Lookback,high);

   if(copied <= 0)
      return 0;

   double h = high[0];

   for(int i=1;i<copied;i++)
   {
      if(high[i] > h)
         h = high[i];
   }

   return h;
}

//====================================================//
// GET LOW
//====================================================//
double GetLowTF(ENUM_TIMEFRAMES tf)
{
   double low[];

   ArraySetAsSeries(low,true);

   int copied =
      CopyLow(_Symbol,tf,0,Lookback,low);

   if(copied <= 0)
      return 0;

   double l = low[0];

   for(int i=1;i<copied;i++)
   {
      if(low[i] < l)
         l = low[i];
   }

   return l;
}

//====================================================//
// CALCULATE TF
//====================================================//
void CalculateTF(int index)
{
   ENUM_TIMEFRAMES tf = TFs[index];

   int bars = Bars(_Symbol,tf);

   if(bars < Lookback)
   {
      TF_DataReady[index] = false;
      return;
   }

   double H = GetHighTF(tf);
   double L = GetLowTF(tf);

   if(H <= L || H <= 0 || L <= 0)
   {
      TF_DataReady[index] = false;
      return;
   }

   double range = H - L;
   double eq    = L + (range * 0.50);

   double closeArr[];

   ArraySetAsSeries(closeArr,true);

   if(CopyClose(_Symbol,tf,0,1,closeArr) <= 0)
   {
      TF_DataReady[index] = false;
      return;
   }

   double price = closeArr[0];

   double pct =
      ((price - eq) / range) * 100.0;

   TF_High[index]      = H;
   TF_Low[index]       = L;
   TF_EQ[index]        = eq;
   TF_Range[index]     = range;
   TF_Percent[index]   = pct;
   TF_DataReady[index] = true;
}

//====================================================//
// HAS POSITION
//====================================================//
bool HasPosition(long magic)
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionSelectByTicket(ticket))
      {
         string symbol =
            PositionGetString(POSITION_SYMBOL);

         long mg =
            PositionGetInteger(POSITION_MAGIC);

         if(symbol == _Symbol && mg == magic)
            return true;
      }
   }

   return false;
}

//====================================================//
// SAVE MEMORY
//====================================================//
void SaveMemory(int index,string signal,string status)
{
   int handle =
      FileOpen(
         MemoryFiles[index],
         FILE_CSV|
         FILE_READ|
         FILE_WRITE|
         FILE_SHARE_WRITE|
         FILE_ANSI,
         ';'
      );

   if(handle == INVALID_HANDLE)
      return;

   FileSeek(handle,0,SEEK_END);

   FileWrite(
      handle,
      TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS),
      TFNames[index],
      signal,
      status,
      DoubleToString(SymbolInfoDouble(_Symbol,SYMBOL_BID),_Digits),
      DoubleToString(TF_EQ[index],_Digits),
      DoubleToString(TF_Percent[index],1)
   );

   FileClose(handle);
}

//====================================================//
// UPDATE WIN LOSS MEMORY
//====================================================//
void UpdateClosedTradesMemory()
{
   static datetime lastCheck = 0;

   if(!HistorySelect(TimeCurrent()-86400*30,TimeCurrent()))
      return;

   int deals = HistoryDealsTotal();

   for(int i=deals-1;i>=0;i--)
   {
      ulong ticket = HistoryDealGetTicket(i);

      if(ticket <= 0)
         continue;

      datetime dealTime =
         (datetime)HistoryDealGetInteger(ticket,DEAL_TIME);

      if(dealTime <= lastCheck)
         continue;

      string symbol =
         HistoryDealGetString(ticket,DEAL_SYMBOL);

      if(symbol != _Symbol)
         continue;

      long entry =
         HistoryDealGetInteger(ticket,DEAL_ENTRY);

      if(entry != DEAL_ENTRY_OUT)
         continue;

      long magic =
         HistoryDealGetInteger(ticket,DEAL_MAGIC);

      double profit =
         HistoryDealGetDouble(ticket,DEAL_PROFIT);

      int tfIndex = -1;

      for(int j=0;j<7;j++)
      {
         if(GetMagic(j) == magic)
         {
            tfIndex = j;
            break;
         }
      }

      if(tfIndex < 0)
         continue;

      string result = "LOSS";

      if(profit > 0)
         result = "WIN";

      SaveMemory(tfIndex,"CLOSE",result);
   }

   lastCheck = TimeCurrent();
}

//====================================================//
// GET MEMORY STATS
//====================================================//
void GetMemoryStats(int index,int &total,int &win,int &loss)
{
   total = 0;
   win   = 0;
   loss  = 0;

   int handle =
      FileOpen(
         MemoryFiles[index],
         FILE_CSV|
         FILE_READ|
         FILE_ANSI,
         ';'
      );

   if(handle == INVALID_HANDLE)
      return;

   while(!FileIsEnding(handle))
   {
      string c1 = FileReadString(handle);
      string c2 = FileReadString(handle);
      string c3 = FileReadString(handle);
      string c4 = FileReadString(handle);
      string c5 = FileReadString(handle);
      string c6 = FileReadString(handle);
      string c7 = FileReadString(handle);

      if(c4 == "WIN")
      {
         win++;
         total++;
      }
      else if(c4 == "LOSS")
      {
         loss++;
         total++;
      }
   }

   FileClose(handle);
}

//====================================================//
// OPEN BUY
//====================================================//
void OpenBuy(long magic,string comment)
{
   double ask =
      SymbolInfoDouble(_Symbol,SYMBOL_ASK);

   double sl = 0;
   double tp = 0;

   if(StopLossPoints > 0)
      sl = ask - (StopLossPoints * _Point);

   if(TakeProfitPoints > 0)
      tp = ask + (TakeProfitPoints * _Point);

   Trade.SetExpertMagicNumber(magic);
   Trade.SetDeviationInPoints(Slippage);

   bool result =
      Trade.Buy(
         Lots,
         _Symbol,
         ask,
         sl,
         tp,
         comment
      );

   if(result)
   {
      Print("BUY OPENED : ",comment);
      SaveMemory(ArrayBsearch(MagicNumbers,magic),"BUY","SIGNAL");
   }
   else
   {
      Print("BUY FAILED : ",Trade.ResultRetcode());
   }
}

//====================================================//
// OPEN SELL
//====================================================//
void OpenSell(long magic,string comment)
{
   double bid =
      SymbolInfoDouble(_Symbol,SYMBOL_BID);

   double sl = 0;
   double tp = 0;

   if(StopLossPoints > 0)
      sl = bid + (StopLossPoints * _Point);

   if(TakeProfitPoints > 0)
      tp = bid - (TakeProfitPoints * _Point);

   Trade.SetExpertMagicNumber(magic);
   Trade.SetDeviationInPoints(Slippage);

   bool result =
      Trade.Sell(
         Lots,
         _Symbol,
         bid,
         sl,
         tp,
         comment
      );

   if(result)
   {
      Print("SELL OPENED : ",comment);
      SaveMemory(ArrayBsearch(MagicNumbers,magic),"SELL","SIGNAL");
   }
   else
   {
      Print("SELL FAILED : ",Trade.ResultRetcode());
   }
}

//====================================================//
// EXECUTE AGENT
//====================================================//
void ExecuteAgent(int index)
{
   if(!TFEnabled[index])
      return;

   if(!TF_DataReady[index])
      return;

   long magic = GetMagic(index);

   if(OnePositionPerTF)
   {
      if(HasPosition(magic))
         return;
   }

   double pct = TF_Percent[index];

   if(pct <= -50.0)
   {
      OpenBuy(
         magic,
         EAName + " BUY " + TFNames[index]
      );
   }
   else
   if(pct >= 50.0)
   {
      OpenSell(
         magic,
         EAName + " SELL " + TFNames[index]
      );
   }
}

//====================================================//
// DRAW LABEL
//====================================================//
void DrawLabel(
   string name,
   string text,
   int x,
   int y,
   color clr,
   int size=10
)
{
   if(ObjectFind(0,name) < 0)
      ObjectCreate(0,name,OBJ_LABEL,0,0,0);

   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);

   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetString(0,name,OBJPROP_FONT,"Consolas");

   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);

   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
}

//====================================================//
// DRAW PANEL
//====================================================//
void DrawPanel()
{
   if(!ShowPanel)
      return;

   DrawLabel(
      PanelPrefix+"TITLE",
      "30 AI MULTI AGENTS FARONE ENGINE [MT5]",
      10,
      10,
      clrGold,
      12
   );

   int y = 40;

   for(int i=0;i<7;i++)
   {
      string status = "MAGNET";
      color c = clrWhite;

      if(!TFEnabled[i])
      {
         status = "DISABLED";
         c = clrGray;
      }
      else
      if(!TF_DataReady[i])
      {
         status = "LOADING";
         c = clrSilver;
      }
      else
      if(TF_Percent[i] <= -50)
      {
         status = "BUY ZONE";
         c = clrLime;
      }
      else
      if(TF_Percent[i] >= 50)
      {
         status = "SELL ZONE";
         c = clrRed;
      }

      string txt =
         TFNames[i]+
         " | EQ="+DoubleToString(TF_EQ[i],_Digits)+
         " | %="+DoubleToString(TF_Percent[i],1)+
         " | "+status;

      DrawLabel(
         PanelPrefix+"TF_"+IntegerToString(i),
         txt,
         10,
         y,
         c,
         10
      );

      int total=0;
      int win=0;
      int loss=0;

      GetMemoryStats(i,total,win,loss);

      string mem =
         "AI MEMORY : "+TFNames[i]+
         " | TOTAL="+IntegerToString(total)+
         " | WIN="+IntegerToString(win)+
         " | LOSS="+IntegerToString(loss)+
         " | MAGIC="+IntegerToString((int)GetMagic(i));

      DrawLabel(
         PanelPrefix+"MEM_"+IntegerToString(i),
         mem,
         30,
         y+15,
         clrAqua,
         8
      );

      y += 35;
   }

   double balance =
      AccountInfoDouble(ACCOUNT_BALANCE);

   double equity =
      AccountInfoDouble(ACCOUNT_EQUITY);

   long spread =
      SymbolInfoInteger(_Symbol,SYMBOL_SPREAD);

   DrawLabel(
      PanelPrefix+"BAL",
      "BALANCE : "+DoubleToString(balance,2),
      10,
      y+10,
      clrAqua,
      10
   );

   DrawLabel(
      PanelPrefix+"EQ",
      "EQUITY : "+DoubleToString(equity,2),
      10,
      y+30,
      clrAqua,
      10
   );

   DrawLabel(
      PanelPrefix+"SPR",
      "SPREAD : "+IntegerToString((int)spread),
      10,
      y+50,
      clrOrange,
      10
   );

   ChartRedraw(0);
}

//====================================================//
// DELETE PANEL
//====================================================//
void DeletePanel()
{
   int total = ObjectsTotal(0);

   for(int i=total-1;i>=0;i--)
   {
      string name = ObjectName(0,i);

      if(StringFind(name,PanelPrefix) == 0)
         ObjectDelete(0,name);
   }
}

//====================================================//
// INIT
//====================================================//
int OnInit()
{
   PanelPrefix =
      _Symbol+"_"+IntegerToString((int)ChartID())+"_";

   InitTFEnable();

   DeletePanel();

   PreloadAllTF();

   Print("=== GANN MAGNET AI MULTI AGENT MT5 READY ===");

   return(INIT_SUCCEEDED);
}

//====================================================//
// ON TICK
//====================================================//
void OnTick()
{
   UpdateClosedTradesMemory();

   for(int i=0;i<7;i++)
   {
      CalculateTF(i);

      ExecuteAgent(i);
   }

   DrawPanel();
}

//====================================================//
// DEINIT
//====================================================//
void OnDeinit(const int reason)
{
   DeletePanel();

   Print("EA DEINIT : ",reason);
}
//+------------------------------------------------------------------+