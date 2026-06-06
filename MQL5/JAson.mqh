//+------------------------------------------------------------------+
//| JAson.mqh - FIXED for MT5 Build 4730+                            |
//| Original by Yann Renard, Fixed by FarOneCapital                  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, FarOneCapital"
#property link      "https://faronecapital.online/"
#property strict

class CJAVal
{
public:
   CJAVal() { Clear(); }
   ~CJAVal() { Clear(); }
   
   void Clear() { m_type=jtUNDEF; m_sv=""; ArrayResize(m_a,0); ArrayResize(m_keys,0); }
   
   bool Copy(const CJAVal &a) { Clear(); return(CopyData(GetPointer(this),&a)); }
   void operator=(const CJAVal &a) { Copy(a); }
   
   bool Set(const CJAVal &v) { if(v.m_type==jtUNDEF) { Clear(); return(true); } return(CopyData(GetPointer(this),&v)); }
   bool Set(const string v) { Clear(); m_type=jtSTR; m_sv=v; return(true); }
   bool Set(const long v) { Clear(); m_type=jtINT; m_iv=v; m_dv=(double)m_iv; m_sv=IntegerToString(m_iv); return(true); }
   bool Set(const int v) { Set((long)v); return(true); }
   bool Set(const double v,int d=8) { Clear(); m_type=jtDBL; m_dv=v; m_iv=(long)m_dv; m_sv=DoubleToString(m_dv,d); return(true); }
   bool Set(const bool v) { Clear(); m_type=jtBOOL; m_bv=v; m_iv=m_bv; m_dv=m_bv; m_sv=(m_bv?"true":"false"); return(true); }
   
   void operator=(const string v) { Set(v); }
   void operator=(const long v) { Set(v); }
   void operator=(const int v) { Set(v); }
   void operator=(const double v) { Set(v); }
   void operator=(const bool v) { Set(v); }
   
   string GetStr(string def="") const { return(m_type==jtUNDEF?def:m_sv); }
   long GetInt(long def=0) const { return(m_type==jtUNDEF?def:m_iv); }
   double GetDb(double def=0) const { return(m_type==jtUNDEF?def:m_dv); }
   bool GetBool(bool def=false) const { return(m_type==jtUNDEF?def:m_bv); }
   
   void SetNull() { Clear(); m_type=jtNULL; m_sv="null"; }
   
   CJAVal* operator[](int i) { if(m_type==jtUNDEF) { m_type=jtARRAY; } if(m_type==jtARRAY) { if(i==ArraySize(m_a)) { ArrayResize(m_a,i+1); m_a[i]=new CJAVal; } if(i>=0 && i<ArraySize(m_a)) return(m_a[i]); } return(NULL); }
   CJAVal* operator[](string k) { if(m_type==jtUNDEF) m_type=jtOBJECT; if(m_type==jtOBJECT) { int idx=FindKey(k); if(idx<0) { idx=ArraySize(m_a); ArrayResize(m_a,idx+1); ArrayResize(m_keys,idx+1); m_a[idx]=new CJAVal; m_keys[idx]=k; } return(m_a[idx]); } return(NULL); }
   
   string Serialize() { bool ml=false; return(Serialize(ml)); }
   string Serialize(bool ml) { if(m_type==jtUNDEF) return("null"); else if(m_type==jtNULL) return("null"); else if(m_type==jtBOOL) return(m_bv?"true":"false"); else if(m_type==jtINT) return(IntegerToString(m_iv)); else if(m_type==jtDBL) return(DoubleToString(m_dv,8)); else if(m_type==jtSTR) { string ss=StringReplaceSpecial(m_sv); return("\""+ss+"\""); } else if(m_type==jtARRAY) return(SerializeArray(ml)); else if(m_type==jtOBJECT) return(SerializeObject(ml)); return("null"); }

private:
   enum json_type { jtUNDEF, jtNULL, jtBOOL, jtINT, jtDBL, jtSTR, jtARRAY, jtOBJECT };
   json_type m_type;
   string m_sv;
   long m_iv;
   double m_dv;
   bool m_bv;
   CJAVal* m_a[];
   string m_keys[];
   
   static bool CopyData(CJAVal* d,const CJAVal* s) { d.m_type=s.m_type; d.m_sv=s.m_sv; d.m_iv=s.m_iv; d.m_dv=s.m_dv; d.m_bv=s.m_bv; int sz=ArraySize(s.m_a); ArrayResize(d.m_a,sz); ArrayResize(d.m_keys,sz); for(int i=0;i<sz;i++) { d.m_a[i]=new CJAVal; CopyData(d.m_a[i],s.m_a[i]); d.m_keys[i]=s.m_keys[i]; } return(true); }
   int FindKey(string k) { for(int i=ArraySize(m_keys)-1;i>=0;--i) if(m_keys[i]==k) return(i); return(-1); }
   string SerializeArray(bool ml) { string s="["; int sz=ArraySize(m_a); for(int i=0;i<sz;i++) { if(i>0) s+=","; s+=m_a[i].Serialize(ml); } s+="]"; return(s); }
   string SerializeObject(bool ml) { string s="{"; int sz=ArraySize(m_a); for(int i=0;i<sz;i++) { if(i>0) s+=","; s+="\""+m_keys[i]+"\":"+m_a[i].Serialize(ml); } s+="}"; return(s); }
   static string StringReplaceSpecial(string s) { StringReplace(s,"\\","\\\\"); StringReplace(s,"\"","\\\""); StringReplace(s,"\n","\\n"); StringReplace(s,"\r","\\r"); StringReplace(s,"\t","\\t"); return(s); }
};