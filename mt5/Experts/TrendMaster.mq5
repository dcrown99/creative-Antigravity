//+------------------------------------------------------------------+
//|                                              TrendMaster.mq5      |
//|                     Multi-Timeframe Trend Following EA v4.00      |
//|                                                                    |
//| v4.00 Changes:                                                     |
//|   - Revert to H1 Entry (v1 baseline)                              |
//|   - Disable ADX filter (set min=0) to catch all trends            |
//|   - Wide Session (2-22h) to filter ONLY rollover spread spike     |
//|   - High R:R Profile: SL 2.0 ATR, TP 3.0 ATR, Trail 1.5 ATR       |
//|   - Max positions = 1 (Strict risk control)                       |
//|   - Safety: Max lot size cap at 5.0                               |
//+------------------------------------------------------------------+
#property copyright   "TrendMaster"
#property version     "4.00"
#property description "Multi-Timeframe Trend Following EA v4.00"
#property description "H4 trend + H1 EMA cross + Wide filters"
#property description "Session 2-22h + High R:R + Safety max lot"

#include <TrendMaster\SignalModule.mqh>
#include <TrendMaster\RiskManager.mqh>
#include <TrendMaster\TradeExecutor.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                   |
//+------------------------------------------------------------------+
input group           "=== Risk Management ==="
input double          InpRiskPercent     = 2.0;     // Risk per trade (%) [v4: 2.0]
input int             InpMaxPositions    = 1;        // Max positions [v4: 1]
input double          InpSL_ATR_Mult     = 2.0;     // Stop Loss (ATR x) [v4: 2.0]
input double          InpTP_ATR_Mult     = 3.0;     // Take Profit (ATR x) [v4: 3.0]
input double          InpTrail_ATR_Mult  = 1.5;     // Trailing Stop (ATR x) [v4: 1.5]
input double          InpMaxLotSize      = 5.0;     // Safety cap for lots

input group           "=== Signal Parameters ==="
input int             InpEMA_Fast        = 20;      // Fast EMA period
input int             InpEMA_Slow        = 50;      // Slow EMA period
input int             InpEMA_Trend       = 200;     // Trend EMA period (H4)
input int             InpRSI_Period      = 14;      // RSI period
input int             InpATR_Period      = 14;      // ATR period

input group           "=== ADX Trend Strength (v4: disabled) ==="
input int             InpADX_Period      = 14;      // ADX period
input double          InpADX_Min         = 0.0;     // Min ADX (0 = disabled)

input group           "=== Session Filter ==="
input bool            InpUseSession      = true;    // Enable session filter
input int             InpSessionStart    = 2;       // Session start (server) [v4: 02:00]
input int             InpSessionEnd      = 22;      // Session end (server) [v4: 22:00]

input group           "=== Timeframes ==="
input ENUM_TIMEFRAMES InpTrendTF         = PERIOD_H4;   // Trend TF
input ENUM_TIMEFRAMES InpEntryTF         = PERIOD_H1;   // Entry TF [v4: H1]

input group           "=== General ==="
input ulong           InpMagicNumber     = 20260215;
input ulong           InpDeviation       = 30;

//+------------------------------------------------------------------+
CSignalModule   g_signal;
CRiskManager    g_risk;
CTradeExecutor  g_trade;
int g_total_trades = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   if(InpRiskPercent <= 0 || InpRiskPercent > 10) return INIT_PARAMETERS_INCORRECT;
   if(InpEMA_Fast >= InpEMA_Slow) return INIT_PARAMETERS_INCORRECT;

   if(!g_signal.Init(_Symbol, InpEMA_Trend, InpEMA_Fast, InpEMA_Slow,
                      InpRSI_Period, InpADX_Period, InpADX_Min,
                      InpTrendTF, InpEntryTF,
                      InpUseSession, InpSessionStart, InpSessionEnd))
   { Print("ERROR: SignalModule init failed"); return INIT_FAILED; }
   
   if(!g_risk.Init(_Symbol, InpEntryTF, InpATR_Period, InpRiskPercent,
                    InpSL_ATR_Mult, InpTP_ATR_Mult, InpTrail_ATR_Mult,
                    InpMaxPositions, InpMagicNumber))
   { Print("ERROR: RiskManager init failed"); return INIT_FAILED; }
   
   if(!g_trade.Init(_Symbol, InpMagicNumber, 3, 500, InpDeviation))
   { Print("ERROR: TradeExecutor init failed"); return INIT_FAILED; }
   
   Print("TrendMaster v4.00 | ", _Symbol, " | Risk:", InpRiskPercent, "% | MaxPos:", InpMaxPositions);
   
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { g_signal.Deinit(); g_risk.Deinit(); }

void OnTick()
{
   g_risk.ManageTrailingStop();
   
   if(!g_signal.IsNewBar()) return;
   if(!g_signal.IsInTradingSession()) return;
   if(!g_risk.CanOpenNewPosition()) return;
   
   ENUM_TREND_DIRECTION trend = g_signal.GetTrendDirection();
   if(trend == TREND_NONE) return;
   
   ENUM_ENTRY_SIGNAL signal = g_signal.GetEntrySignal();
   if(signal == SIGNAL_NONE) return;
   
   if((trend == TREND_UP && signal != SIGNAL_BUY) ||
      (trend == TREND_DOWN && signal != SIGNAL_SELL))
      return;
   
   double sl_distance = g_risk.GetStopLossDistance();
   double tp_distance = g_risk.GetTakeProfitDistance();
   if(sl_distance <= 0 || tp_distance <= 0) return;
   
   double lots = g_risk.CalculateLotSize(sl_distance);
   if(lots <= 0) return;
   
   // Safety cap
   if(lots > InpMaxLotSize) lots = InpMaxLotSize;
   
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   
   if(signal == SIGNAL_BUY)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double sl  = NormalizeDouble(ask - sl_distance, digits);
      double tp  = NormalizeDouble(ask + tp_distance, digits);
      
      if(g_trade.OpenBuy(lots, sl, tp, StringFormat("TMv4 B|R%.1f", InpRiskPercent)))
      {
         g_total_trades++;
         Print(">>> BUY v4 | Lots:", lots, " | SL:", sl, " | TP:", tp);
      }
   }
   else if(signal == SIGNAL_SELL)
   {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double sl  = NormalizeDouble(bid + sl_distance, digits);
      double tp  = NormalizeDouble(bid - tp_distance, digits);
      
      if(g_trade.OpenSell(lots, sl, tp, StringFormat("TMv4 S|R%.1f", InpRiskPercent)))
      {
         g_total_trades++;
         Print(">>> SELL v4 | Lots:", lots, " | SL:", sl, " | TP:", tp);
      }
   }
}
//+------------------------------------------------------------------+
