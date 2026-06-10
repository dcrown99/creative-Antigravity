//+------------------------------------------------------------------+
//|                                              NakaneMaster.mq5     |
//|                         Tokyo Fix Strategy Implementation         |
//|                                                                    |
//| Strategy: Gotobi + Month-End (Short Only)                          |
//| Schedule (JST):                                                    |
//|   09:55 : Open Sell (Post-Fix)                                     |
//|   10:25 : Close Sell                                               |
//|                                                                    |
//| v3.00: +Month-End, 25th re-enabled, PF ~1.75 (2023-2025)          |
//+------------------------------------------------------------------+
#property copyright   "NakaneMaster"
#property version     "3.00"
#property description "Tokyo Fix / Gotobi + Month-End Strategy"

#include <TrendMaster\RiskManager.mqh>
#include <TrendMaster\TradeExecutor.mqh>
#include <NakaneMaster\TimeFilter.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                   |
//+------------------------------------------------------------------+
input group           "=== Time Settings ==="
input int             InpServerGMTOffset = 2;       // Server GMT Offset (Winter=2, Summer=3)
input bool            InpGotobiOnly      = true;    // Trade only on Gotobi days
input string          InpEnableDays      = "5,15,20,25,30"; // Enable specific Gotobi days (comma separated)
input string          InpExcludeDays     = "10";             // HARD BLOCK these Gotobi days (overrides Monday logic)
input bool            InpTradeMondays    = true;    // Trade on all Mondays (regardless of Gotobi)
input bool            InpTradeMonthEnd   = true;    // Trade on month-end business day (PF 3.32)

input group           "=== Risk Management ==="
input double          InpRiskPercent     = 2.0;     // Risk per trade (%)
input double          InpStopLoss        = 20.0;    // Stop Loss (Pips)
input double          InpTakeProfit      = 40.0;    // Take Profit (Pips) - Safety net
input double          InpMaxSpread_Pips  = 2.0;     // Max Spread allowed (Pips)

input group           "=== General ==="
input ulong           InpMagicNumber     = 20260216;
input ulong           InpDeviation       = 30;

//+------------------------------------------------------------------+
CTimeFilter     g_time; // Fix class name if needed (Check TimeFilter.mqh)
CRiskManager    g_risk;
CTradeExecutor  g_trade;

int m_last_entry_day = -1;
int m_last_fix_day = -1;
bool m_enabled_days[32]; // Flags for enabled days (index 1-31)
bool m_excluded_days[32]; // Flags for excluded days

//+------------------------------------------------------------------+
//| Initialization                                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   if(InpRiskPercent <= 0 || InpRiskPercent > 10) return INIT_PARAMETERS_INCORRECT;

   g_time.Init(InpServerGMTOffset, true); // Enable Auto-DST (US Rules for XM)
   
   if(!g_risk.Init(_Symbol, PERIOD_M15, 14, InpRiskPercent, 
                     1.0, 1.0, 1.0, 1, InpMagicNumber))
   { Print("ERROR: RiskManager init failed"); return INIT_FAILED; }
   
   if(!g_trade.Init(_Symbol, InpMagicNumber, 3, 500, InpDeviation))
   { Print("ERROR: TradeExecutor init failed"); return INIT_FAILED; }
   
   // Parse Enabled Days
   ArrayInitialize(m_enabled_days, false);
   string days[];
   int count = StringSplit(InpEnableDays, ',', days);
   for(int i=0; i<count; i++)
   {
      int d = (int)StringToInteger(days[i]);
      if(d >= 1 && d <= 31) m_enabled_days[d] = true;
   }
   
   // Parse Excluded Days
   ArrayInitialize(m_excluded_days, false);
   string ex_days[];
   int ex_count = StringSplit(InpExcludeDays, ',', ex_days);
   for(int i=0; i<ex_count; i++)
   {
      int d = (int)StringToInteger(ex_days[i]);
      if(d >= 1 && d <= 31) m_excluded_days[d] = true;
   }
   
   Print("NakaneMaster v3.00 (US DST + MonthEnd) | Enabled: ", InpEnableDays, " | MonthEnd: ", InpTradeMonthEnd);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { g_risk.Deinit(); }

//+------------------------------------------------------------------+
//| Tick Logic                                                         |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime current_time = TimeCurrent();
   datetime jst_time     = g_time.GetJapanTime(current_time);
   
   // 1. Gotobi Filter
   // 2. Check Day Filter
   bool is_valid_day = false;

   // A) Gotobi Check
   int gotobi_date = g_time.GetGotobiDate(current_time);
   
   // Hard Block (v2.21): If it's a "Loser Gotobi" (10, 25), BLOCK IT even if it's Monday
   if (gotobi_date > 0 && m_excluded_days[gotobi_date]) return;

   if (InpGotobiOnly && gotobi_date > 0 && m_enabled_days[gotobi_date])
   {
      is_valid_day = true;
   }
   
   // C) Month-End Check (v3.00)
   if (InpTradeMonthEnd && g_time.IsMonthEnd(current_time))
   {
       is_valid_day = true;
       Print(">>> Month-End Trading Day detected: ", TimeToString(current_time));
   }
   
   // B) Monday Check (v2.20)
   MqlDateTime dt_current; // Use a different name to avoid conflict with dt later
   TimeToStruct(current_time, dt_current);
   if (InpTradeMondays && dt_current.day_of_week == 1) // 1 = Monday
   {
      is_valid_day = true;
   }

   if (!is_valid_day) return; // Not in enabled list
   
   // 2. Spread Check
   double spread_pips = (double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) / 10.0;
   if(spread_pips > InpMaxSpread_Pips) return; // Strict spread control
   
   // 3. Time Logic (JST)
   MqlDateTime dt;
   TimeToStruct(jst_time, dt);
   int jst_min_sum = dt.hour * 60 + dt.min; 
   int day_of_year = dt.day_of_year;
   
   // Target Times (JST)
   // 09:00 = 540 min
   // 09:55 = 595 min
   // 10:25 = 625 min
   
   // --- EVENT 1: ENTRY BUY (09:00) ---
   // DISABLED: Python analysis showed PF 0.80 for Long leg. Short Only strategy.
   /*
   if(dt.hour == 9 && dt.min == 0) // Window: 09:00:00 - 09:00:59
   {
      if(m_last_entry_day != day_of_year)
      {
         if(g_risk.CountOpenPositions() == 0)
         {
            double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
            double sl_points = InpSL_Pips * 10;
            double sl_price_dist = sl_points * point;

            double lots = g_risk.CalculateLotSize(sl_price_dist); 
            
            if(lots > 0)
            {
               double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
               double sl = ask - sl_price_dist;
               double tp = 0; // Time exit
               
               if(g_trade.OpenBuy(lots, sl, tp, "Nakane Buy"))
               {
                  m_last_entry_day = day_of_year; // Mark as traded
                  Print(">>> Nakane Buy | Lots:", lots, " | SL:", sl);
               }
            }
         }
      }
   }
   */
   
   // --- EVENT 2: FIX / REVERSE (09:55) ---
   // Reverting to 55 (matches Python 'Fix 54' Close time of 09:55:00)
   if(dt.hour == 9 && dt.min == 55) // Window: 09:55
   {
      if(m_last_fix_day != day_of_year)
      {
         // 1. Close ALL Buys
         CloseAll(POSITION_TYPE_BUY);
         
         // 2. Open Sell (Reverse) - only set flag on success
         if(OpenTrade(ORDER_TYPE_SELL, "Nakane Short"))
         {
            m_last_fix_day = day_of_year;
         }
      }
   }
   
   // --- EVENT 3: EXIT SELL (10:25) ---
   if(dt.hour == 10 && dt.min == 25)
   {
      // Close ALL Sells
      CloseAll(POSITION_TYPE_SELL);
   }
}

//+------------------------------------------------------------------+
//| Helper: Open Trade                                                 |
//+------------------------------------------------------------------+
bool OpenTrade(ENUM_ORDER_TYPE type, string comment)
{
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double sl_dist = InpStopLoss * 10 * point;
   double tp_dist = InpTakeProfit * 10 * point;
   
   double lots = g_risk.CalculateLotSize(sl_dist);
   if(lots <= 0) return false;
   
   double price, sl, tp;
   
   if(type == ORDER_TYPE_BUY)
   {
      price = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      sl = price - sl_dist;
      tp = price + tp_dist;
      return g_trade.OpenBuy(lots, sl, tp, comment);
   }
   else if(type == ORDER_TYPE_SELL)
   {
      price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      sl = price + sl_dist;
      tp = price - tp_dist;
      return g_trade.OpenSell(lots, sl, tp, comment);
   }
   return false;
}

//+------------------------------------------------------------------+
//| Helper: Close All specific type                                    |
//+------------------------------------------------------------------+
void CloseAll(ENUM_POSITION_TYPE type)
{
   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      
      // Filter by Magic Number + Symbol + Type
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_TYPE) != type) continue;
      
      g_trade.ClosePosition(ticket);
   }
}

