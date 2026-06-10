//+------------------------------------------------------------------+
//|                                              SignalModule.mqh     |
//|                                    TrendMaster EA v3.00           |
//|         Refined: H1 entry + session filter + ADX strength         |
//+------------------------------------------------------------------+
#property copyright "TrendMaster"
#property version   "3.00"

//+------------------------------------------------------------------+
enum ENUM_TREND_DIRECTION
{
   TREND_UP   =  1,
   TREND_DOWN = -1,
   TREND_NONE =  0
};

enum ENUM_ENTRY_SIGNAL
{
   SIGNAL_BUY  =  1,
   SIGNAL_SELL = -1,
   SIGNAL_NONE =  0
};

//+------------------------------------------------------------------+
//| Signal Module v3: Added ADX trend strength filter                 |
//+------------------------------------------------------------------+
class CSignalModule
{
private:
   int               m_ema_trend_handle;
   int               m_ema_fast_handle;
   int               m_ema_slow_handle;
   int               m_rsi_handle;
   int               m_adx_handle;        // v3: ADX for trend strength
   
   string            m_symbol;
   int               m_ema_trend_period;
   int               m_ema_fast_period;
   int               m_ema_slow_period;
   int               m_rsi_period;
   int               m_adx_period;
   double            m_adx_min;           // Minimum ADX for trade
   ENUM_TIMEFRAMES   m_trend_timeframe;
   ENUM_TIMEFRAMES   m_entry_timeframe;
   
   bool              m_use_session_filter;
   int               m_session_start_hour;
   int               m_session_end_hour;
   
   datetime          m_last_bar_time;
   
public:
                     CSignalModule();
                    ~CSignalModule();
   
   bool              Init(string symbol,
                          int ema_trend_period,
                          int ema_fast_period,
                          int ema_slow_period,
                          int rsi_period,
                          int adx_period,
                          double adx_min,
                          ENUM_TIMEFRAMES trend_tf,
                          ENUM_TIMEFRAMES entry_tf,
                          bool use_session_filter,
                          int session_start,
                          int session_end);
   void              Deinit();
   
   ENUM_TREND_DIRECTION GetTrendDirection();
   ENUM_ENTRY_SIGNAL    GetEntrySignal();
   bool                 IsNewBar();
   bool                 IsInTradingSession();
   bool                 IsTrendStrong();
   
   double            GetIndicatorValue(int handle, int buffer, int shift);
};

//+------------------------------------------------------------------+
CSignalModule::CSignalModule()
{
   m_ema_trend_handle = INVALID_HANDLE;
   m_ema_fast_handle  = INVALID_HANDLE;
   m_ema_slow_handle  = INVALID_HANDLE;
   m_rsi_handle       = INVALID_HANDLE;
   m_adx_handle       = INVALID_HANDLE;
   m_last_bar_time    = 0;
}

CSignalModule::~CSignalModule() { Deinit(); }

//+------------------------------------------------------------------+
bool CSignalModule::Init(string symbol,
                          int ema_trend_period,
                          int ema_fast_period,
                          int ema_slow_period,
                          int rsi_period,
                          int adx_period,
                          double adx_min,
                          ENUM_TIMEFRAMES trend_tf,
                          ENUM_TIMEFRAMES entry_tf,
                          bool use_session_filter,
                          int session_start,
                          int session_end)
{
   m_symbol              = symbol;
   m_ema_trend_period    = ema_trend_period;
   m_ema_fast_period     = ema_fast_period;
   m_ema_slow_period     = ema_slow_period;
   m_rsi_period          = rsi_period;
   m_adx_period          = adx_period;
   m_adx_min             = adx_min;
   m_trend_timeframe     = trend_tf;
   m_entry_timeframe     = entry_tf;
   m_use_session_filter  = use_session_filter;
   m_session_start_hour  = session_start;
   m_session_end_hour    = session_end;
   
   m_ema_trend_handle = iMA(m_symbol, m_trend_timeframe, m_ema_trend_period, 0, MODE_EMA, PRICE_CLOSE);
   if(m_ema_trend_handle == INVALID_HANDLE) { Print("EMA trend failed"); return false; }
   
   m_ema_fast_handle = iMA(m_symbol, m_entry_timeframe, m_ema_fast_period, 0, MODE_EMA, PRICE_CLOSE);
   if(m_ema_fast_handle == INVALID_HANDLE) { Print("EMA fast failed"); return false; }
   
   m_ema_slow_handle = iMA(m_symbol, m_entry_timeframe, m_ema_slow_period, 0, MODE_EMA, PRICE_CLOSE);
   if(m_ema_slow_handle == INVALID_HANDLE) { Print("EMA slow failed"); return false; }
   
   m_rsi_handle = iRSI(m_symbol, m_entry_timeframe, m_rsi_period, PRICE_CLOSE);
   if(m_rsi_handle == INVALID_HANDLE) { Print("RSI failed"); return false; }
   
   // v3: ADX on entry timeframe for trend strength
   m_adx_handle = iADX(m_symbol, m_entry_timeframe, m_adx_period);
   if(m_adx_handle == INVALID_HANDLE) { Print("ADX failed"); return false; }
   
   Print("SignalModule v3.00 | ADX min:", m_adx_min,
         " | Session:", m_use_session_filter, " (", m_session_start_hour, "-", m_session_end_hour, "h)");
   return true;
}

//+------------------------------------------------------------------+
void CSignalModule::Deinit()
{
   if(m_ema_trend_handle != INVALID_HANDLE) { IndicatorRelease(m_ema_trend_handle); m_ema_trend_handle = INVALID_HANDLE; }
   if(m_ema_fast_handle  != INVALID_HANDLE) { IndicatorRelease(m_ema_fast_handle);  m_ema_fast_handle  = INVALID_HANDLE; }
   if(m_ema_slow_handle  != INVALID_HANDLE) { IndicatorRelease(m_ema_slow_handle);  m_ema_slow_handle  = INVALID_HANDLE; }
   if(m_rsi_handle       != INVALID_HANDLE) { IndicatorRelease(m_rsi_handle);       m_rsi_handle       = INVALID_HANDLE; }
   if(m_adx_handle       != INVALID_HANDLE) { IndicatorRelease(m_adx_handle);       m_adx_handle       = INVALID_HANDLE; }
}

//+------------------------------------------------------------------+
bool CSignalModule::IsInTradingSession()
{
   if(!m_use_session_filter) return true;
   
   MqlDateTime dt;
   TimeCurrent(dt);
   int hour = dt.hour;
   
   if(m_session_start_hour < m_session_end_hour)
      return (hour >= m_session_start_hour && hour < m_session_end_hour);
   else
      return (hour >= m_session_start_hour || hour < m_session_end_hour);
}

//+------------------------------------------------------------------+
//| v3: Check if ADX shows a strong enough trend                      |
//| ADX > threshold = trending market, worth trading                  |
//| ADX < threshold = ranging/choppy, stay out                        |
//+------------------------------------------------------------------+
bool CSignalModule::IsTrendStrong()
{
   double adx_main = GetIndicatorValue(m_adx_handle, 0, 1); // ADX main line
   if(adx_main == 0) return false;
   return (adx_main >= m_adx_min);
}

//+------------------------------------------------------------------+
ENUM_TREND_DIRECTION CSignalModule::GetTrendDirection()
{
   double ema_trend = GetIndicatorValue(m_ema_trend_handle, 0, 1);
   if(ema_trend == 0) return TREND_NONE;
   
   double close[];
   if(CopyClose(m_symbol, m_trend_timeframe, 1, 1, close) < 1)
      return TREND_NONE;
   
   double point = SymbolInfoDouble(m_symbol, SYMBOL_POINT);
   double buffer = 10 * point;
   
   if(close[0] > ema_trend + buffer)
      return TREND_UP;
   else if(close[0] < ema_trend - buffer)
      return TREND_DOWN;
   
   return TREND_NONE;
}

//+------------------------------------------------------------------+
//| v3 entry: EMA cross + RSI + ADX strength                         |
//| Key change from v1: added ADX filter to avoid choppy entries      |
//| Key change from v2: back to simple cross (no pullback), H1 TF    |
//+------------------------------------------------------------------+
ENUM_ENTRY_SIGNAL CSignalModule::GetEntrySignal()
{
   double ema_fast_curr = GetIndicatorValue(m_ema_fast_handle, 0, 1);
   double ema_fast_prev = GetIndicatorValue(m_ema_fast_handle, 0, 2);
   double ema_slow_curr = GetIndicatorValue(m_ema_slow_handle, 0, 1);
   double ema_slow_prev = GetIndicatorValue(m_ema_slow_handle, 0, 2);
   double rsi_curr      = GetIndicatorValue(m_rsi_handle, 0, 1);
   
   if(ema_fast_curr == 0 || ema_fast_prev == 0 ||
      ema_slow_curr == 0 || ema_slow_prev == 0 ||
      rsi_curr == 0)
      return SIGNAL_NONE;
   
   bool golden_cross = (ema_fast_prev <= ema_slow_prev) && (ema_fast_curr > ema_slow_curr);
   bool death_cross  = (ema_fast_prev >= ema_slow_prev) && (ema_fast_curr < ema_slow_curr);
   
   // BUY: golden cross + RSI 45-70 + ADX strong
   if(golden_cross && rsi_curr > 45.0 && rsi_curr < 70.0 && IsTrendStrong())
      return SIGNAL_BUY;
   
   // SELL: death cross + RSI 30-55 + ADX strong
   if(death_cross && rsi_curr < 55.0 && rsi_curr > 30.0 && IsTrendStrong())
      return SIGNAL_SELL;
   
   return SIGNAL_NONE;
}

//+------------------------------------------------------------------+
bool CSignalModule::IsNewBar()
{
   datetime current_bar_time = iTime(m_symbol, m_entry_timeframe, 0);
   if(current_bar_time == 0) return false;
   
   if(m_last_bar_time == 0)
   {
      m_last_bar_time = current_bar_time;
      return false;
   }
   
   if(current_bar_time != m_last_bar_time)
   {
      m_last_bar_time = current_bar_time;
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
double CSignalModule::GetIndicatorValue(int handle, int buffer, int shift)
{
   double value[];
   if(handle == INVALID_HANDLE) return 0;
   if(CopyBuffer(handle, buffer, shift, 1, value) < 1) return 0;
   return value[0];
}
//+------------------------------------------------------------------+
