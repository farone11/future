//+------------------------------------------------------------------+
//| JAson.mqh |
//| Copyright 2014, Yann Renard |
//| https://www.mql5.com/en/code/13663 |
//+------------------------------------------------------------------+
#property strict

class CJAVal
{
public:
   CJAVal() { Clear(); }
   ~CJAVal() { Clear(); }
   
   void Clear() { m_type=jtUNDEF; m_sv=""; ArrayResize(m_a,0); ArrayResize(m_keys,0); }
   
   bool Copy(const CJAVal &a) { Clear(); return(CopyData(this,a)); }
   void operator=(const CJAVal &a) { Copy(a); }
   
   bool Set(const CJAVal &v) { if(v.m_type==jtUNDEF) { Clear(); return(true); } return(CopyData(this,v)); }
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
   
   bool IsNull() const { return(m_type==jtNULL); }
   bool IsNumeric() const { return(m_type==jtINT || m_type==jtDBL); }
   
   string GetStr(string def="") const { return(m_type==jtUNDEF?def:m_sv); }
   long GetInt(long def=0) const { return(m_type==jtUNDEF?def:m_iv); }
   double GetDb(double def=0) const { return(m_type==jtUNDEF?def:m_dv); }
   bool GetBool(bool def=false) const { return(m_type==jtUNDEF?def:m_bv); }
   
   void SetNull() { Clear(); m_type=jtNULL; m_sv="null"; }
   
   int Size() { return(ArraySize(m_a)); }
   CJAVal* operator[](int i) { if(m_type==jtUNDEF) { m_type=jtARRAY; } if(m_type==jtARRAY) { if(i==ArraySize(m_a)) { ArrayResize(m_a,i+1); m_a[i]=new CJAVal; } if(i>=0 && i<ArraySize(m_a)) return(m_a[i]); } return(NULL); }
   CJAVal* operator[](string k) { if(m_type==jtUNDEF) m_type=jtOBJECT; if(m_type==jtOBJECT) { int idx=FindKey(k); if(idx<0) { idx=ArraySize(m_a); ArrayResize(m_a,idx+1); ArrayResize(m_keys,idx+1); m_a[idx]=new CJAVal; m_keys[idx]=k; } return(m_a[idx]); } return(NULL); }
   
   string Serialize() { bool ml=false; return(Serialize(ml)); }
   string Serialize(bool ml) { if(m_type==jtUNDEF) return("null"); else if(m_type==jtNULL) return("null"); else if(m_type==jtBOOL) return(m_bv?"true":"false"); else if(m_type==jtINT) return(IntegerToString(m_iv)); else if(m_type==jtDBL) return(DoubleToString(m_dv,8)); else if(m_type==jtSTR) { string ss=StringReplaceSpecial(m_sv); return("\""+ss+"\""); } else if(m_type==jtARRAY) return(SerializeArray(ml)); else if(m_type==jtOBJECT) return(SerializeObject(ml)); return("null"); }
   
   bool Deserialize(char &json[],int slen,int &i) { string num=""; int ii=i; if(!ExtrJson(json,slen,ii)) return(false); i=ii; return(true); }
   bool Deserialize(string json,int acp=CP_ACP) { int i=0; char arr[]; int slen=StringToCharArray(json,arr,0,WHOLE_ARRAY,acp); ArrayResize(arr,slen); return(Deserialize(arr,slen,i)); }
   bool Deserialize(char &json[],int acp=CP_ACP) { int i=0; return(Deserialize(json,ArraySize(json),i)); }

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
   bool ExtrJson(char &json[],int slen,int &i) { for(;i<slen;i++) { char c=json[i]; if(c==0) break; else if(c==' '||c=='\r'||c=='\n'||c=='\t') continue; else if(c=='n') { if(i+3<slen && json[i+1]=='u' && json[i+2]=='l' && json[i+3]=='l') { i+=4; SetNull(); return(true); } return(false); } else if(c=='t') { if(i+3<slen && json[i+1]=='r' && json[i+2]=='u' && json[i+3]=='e') { i+=4; Set(true); return(true); } return(false); } else if(c=='f') { if(i+4<slen && json[i+1]=='a' && json[i+2]=='l' && json[i+3]=='s' && json[i+4]=='e') { i+=5; Set(false); return(true); } return(false); } else if(c=='"' ) return(ExtrStr(json,slen,i)); else if(c>='0' && c<='9' || c=='-') return(ExtrNum(json,slen,i)); else if(c=='[') return(ExtrArr(json,slen,i)); else if(c=='{' ) return(ExtrObj(json,slen,i)); return(false); } return(false); }
   bool ExtrStr(char &json[],int slen,int &i) { string s=""; int start=++i; for(;i<slen;i++) { char c=json[i]; if(c==0) break; else if(c=='"') { s=StringSubstr(CharArrayToString(json,0,WHOLE_ARRAY),start,i-start); Set(s); i++; return(true); } else if(c=='\\' && i+1<slen) { i++; } } return(false); }
   bool ExtrNum(char &json[],int slen,int &i) { int start=i; bool isdbl=false; for(;i<slen;i++) { char c=json[i]; if(c==0) break; else if(c>='0' && c<='9') continue; else if(c=='.' || c=='e' || c=='E') { isdbl=true; continue; } else break; } string s=StringSubstr(CharArrayToString(json,0,WHOLE_ARRAY),start,i-start); if(isdbl) Set(StringToDouble(s)); else Set(StringToInteger(s)); return(true); }
   bool ExtrArr(char &json[],int slen,int &i) { m_type=jtARRAY; i++; for(;i<slen;) { while(i<slen && (json[i]==' '||json[i]=='\r'||json[i]=='\n'||json[i]=='\t')) i++; if(i<slen && json[i]==']') { i++; return(true); } CJAVal *v=new CJAVal; ArrayResize(m_a,ArraySize(m_a)+1); m_a[ArraySize(m_a)-1]=v; if(!v.ExtrJson(json,slen,i)) return(false); while(i<slen && (json[i]==' '||json[i]=='\r'||json[i]=='\n'||json[i]=='\t')) i++; if(i<slen && json[i]==',') i++; else if(i<slen && json[i]==']') { i++; return(true); } else return(false); } return(false); }
   bool ExtrObj(char &json[],int slen,int &i) { m_type=jtOBJECT; i++; for(;i<slen;) { while(i<slen && (json[i]==' '||json[i]=='\r'||json[i]=='\n'||json[i]=='\t')) i++; if(i<slen && json[i]=='}') { i++; return(true); } if(i>=slen || json[i]!='"') return(false); string key=""; int start=++i; for(;i<slen;i++) { if(json[i]=='"') { key=StringSubstr(CharArrayToString(json,0,WHOLE_ARRAY),start,i-start); i++; break; } } while(i<slen && (json[i]==' '||json[i]=='\r'||json[i]=='\n'||json[i]=='\t')) i++; if(i>=slen || json[i]!=':') return(false); i++; CJAVal *v=new CJAVal; if(!v.ExtrJson(json,slen,i)) { delete v; return(false); } ArrayResize(m_a,ArraySize(m_a)+1); ArrayResize(m_keys,ArraySize(m_keys)+1); m_a[ArraySize(m_a)-1]=v; m_keys[ArraySize(m_keys)-1]=key; while(i<slen && (json[i]==' '||json[i]=='\r'||json[i]=='\n'||json[i]=='\t')) i++; if(i<slen && json[i]==',') i++; else if(i<slen && json[i]=='}') { i++; return(true); } else return(false); } return(false); }
   static string StringReplaceSpecial(string s) { StringReplace(s,"\\","\\\\"); StringReplace(s,"\"","\\\""); StringReplace(s,"\n","\\n"); StringReplace(s,"\r","\\r"); StringReplace(s,"\t","\\t"); return(s); }
};
