//+------------------------------------------------------------------+
//|                                             TrendScanner_EA.mq5 |
//|                                      Copyright 2026, Antigravity |
//+------------------------------------------------------------------+
#property copyright "Antigravity"
#property link      ""
#property version   "1.00"

#include <Trade\Trade.mqh>

// =================================
// Parameters
// =================================
input bool   InpUsePriceAction  = true;  // Use Price Action Entry (Mode B)
input bool   InpDebugParity     = false; // Output Parity Debug Info

// --- Trend Settings ---
input int    InpAdxPeriod       = 14;    // ADX / DI Length
input int    InpAdxThreshold    = 30;    // ADX Threshold
input int    InpAtrPeriod       = 14;    // ATR Length
input int    InpAdxSlopeBars    = 3;     // ADX Slope Bars

// --- Setup Settings ---
input int    InpSwingLookback   = 10;    // Swing Lookback (Bars)
input double InpMinPbAtr        = 0.5;   // Min Pullback ATR
input double InpMaxPbAtr        = 1.5;   // Max Pullback ATR

// --- Risk Settings ---
input double InpSlAtrMult       = 1.0;   // Stop Loss ATR Multiplier (Mode A)
input double InpTrailAtrMult    = 2.0;   // Trail Stop ATR Multiplier
input double InpRiskPercent     = 1.0;   // Risk Per Trade (%)

// --- Daily Filter ---
input bool   InpUseDailyFilter  = true;  // Use Daily SMA Filter
input int    InpSmaFastLen      = 50;    // SMA Fast Length
input int    InpSmaSlowLen      = 200;   // SMA Slow Length

// --- Squeeze Filter ---
input bool   InpUseSqueezeFilter = true; // Use Volatility Squeeze
input int    InpSqueezeLength   = 20;    // Squeeze BB/KC Length


// =================================
// Global Variables
// =================================
CTrade         trade;
int            handle_adx;
int            handle_atr;
int            handle_sma_fast;
int            handle_sma_slow;
int            handle_stddev;
int            handle_squeeze_atr;

double         trail_price = 0.0;
double         open_sl     = 0.0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   handle_adx = iADX(_Symbol, _Period, InpAdxPeriod);
   // Note: We use purely Simple MA for ATR to match Pine's rma approximation if standard ATR differs, but standard ATR is usually fine.
   handle_atr = iATR(_Symbol, _Period, InpAtrPeriod);
   
   // Daily SMAs
   handle_sma_fast = iMA(_Symbol, PERIOD_D1, InpSmaFastLen, 0, MODE_SMA, PRICE_CLOSE);
   handle_sma_slow = iMA(_Symbol, PERIOD_D1, InpSmaSlowLen, 0, MODE_SMA, PRICE_CLOSE);

   // Squeeze Handles
   handle_stddev = iStdDev(_Symbol, _Period, InpSqueezeLength, 0, MODE_SMA, PRICE_CLOSE);
   handle_squeeze_atr = iATR(_Symbol, _Period, InpSqueezeLength);

   if(handle_adx == INVALID_HANDLE || handle_atr == INVALID_HANDLE || 
      handle_sma_fast == INVALID_HANDLE || handle_sma_slow == INVALID_HANDLE ||
      handle_stddev == INVALID_HANDLE || handle_squeeze_atr == INVALID_HANDLE)
     {
      Print("Error creating indicators");
      return(INIT_FAILED);
     }

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   IndicatorRelease(handle_adx);
   IndicatorRelease(handle_atr);
   IndicatorRelease(handle_sma_fast);
   IndicatorRelease(handle_sma_slow);
   IndicatorRelease(handle_stddev);
   IndicatorRelease(handle_squeeze_atr);
  }

//+------------------------------------------------------------------+
//| Custom functions                                                 |
//+------------------------------------------------------------------+
double GetSwingHigh(int lookback, int shift)
  {
   double max_val = 0;
   double high[];
   if(CopyHigh(_Symbol, _Period, shift, lookback, high) == lookback)
     {
      max_val = high[ArrayMaximum(high)];
     }
   return max_val;
  }

double GetSwingLow(int lookback, int shift)
  {
   double min_val = DBL_MAX;
   double low[];
   if(CopyLow(_Symbol, _Period, shift, lookback, low) == lookback)
     {
      min_val = low[ArrayMinimum(low)];
     }
   return min_val;
  }

double CalculateLotSize(double sl_distance)
  {
   double volume_step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double min_vol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double max_vol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   
   if (sl_distance <= 0) return min_vol;

   double risk_money = AccountInfoDouble(ACCOUNT_BALANCE) * (InpRiskPercent / 100.0);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double sl = ask - sl_distance; // Simulate a buy SL
   
   double loss_for_1_lot = 0;
   if(!OrderCalcProfit(ORDER_TYPE_BUY, _Symbol, 1.0, ask, sl, loss_for_1_lot)) return min_vol;
   
   double loss_value = MathAbs(loss_for_1_lot);
   if (loss_value <= 0) return min_vol;

   double lot = risk_money / loss_value;

   lot = MathFloor(lot / volume_step) * volume_step;
   if(lot < min_vol) lot = min_vol;
   if(lot > max_vol) lot = max_vol;
   
   return lot;
  }

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   // Only run on new bar to match Pine Script logic (closes)
   static datetime last_bar_time = 0;
   datetime current_time = iTime(_Symbol, _Period, 0);
   if(current_time == last_bar_time) return;

   // Get indicator data (Shift 1 = previous closed bar, Shift 0 = current open bar)
   // We analyze the previously closed bar (shift = 1) for signals.
   double adx[10], pdi[10], mdi[10], atr[2], sma_fast[2], sma_slow[2];
   double stddev[2], sqz_atr[2];
   double close[5], open[5], high[5], low[5];
   
   if(CopyBuffer(handle_adx, 0, 1, InpAdxSlopeBars + 1, adx) <= InpAdxSlopeBars) return;
   if(CopyBuffer(handle_adx, 1, 1, 2, pdi) <= 0) return;
   if(CopyBuffer(handle_adx, 2, 1, 2, mdi) <= 0) return;
   if(CopyBuffer(handle_atr, 0, 1, 2, atr) <= 0) return;
   
   // Daily SMAs (Shift 1 = yesterday's close)
   if(CopyBuffer(handle_sma_fast, 0, 1, 2, sma_fast) <= 0) return;
   if(CopyBuffer(handle_sma_slow, 0, 1, 2, sma_slow) <= 0) return;

   // Squeeze buffers
   if(CopyBuffer(handle_stddev, 0, 1, 2, stddev) <= 0) return;
   if(CopyBuffer(handle_squeeze_atr, 0, 1, 2, sqz_atr) <= 0) return;

   // Get last 5 bars for contextual PA
   if(CopyClose(_Symbol, _Period, 1, 5, close) <= 0) return;
   if(CopyOpen(_Symbol, _Period, 1, 5, open) <= 0) return;
   if(CopyHigh(_Symbol, _Period, 1, 5, high) <= 0) return;
   if(CopyLow(_Symbol, _Period, 1, 5, low) <= 0) return;

   // Index 0 in copied arrays represents the oldest, so Index [size-1] is the newest (Shift 1).
   int curr_idx_adx = InpAdxSlopeBars; 
   int prev_idx_adx = 0;
   
   double current_adx = adx[curr_idx_adx];
   double past_adx    = adx[prev_idx_adx];
   
   bool adxRising = current_adx > past_adx;
   bool isTrend = (current_adx >= InpAdxThreshold) && adxRising;
   bool isLong = pdi[1] > mdi[1];
   bool isShort = mdi[1] > pdi[1];
   
   bool dailyBullish = sma_fast[1] > sma_slow[1];
   bool dailyBearish = sma_fast[1] < sma_slow[1];
   
   bool longAllowed = (!InpUseDailyFilter) || dailyBullish;
   bool shortAllowed = (!InpUseDailyFilter) || dailyBearish;

   // Squeeze Logic
   // BB Width = 2 * 2 * StdDev. KC Width = 2 * 1.5 * ATR. Squeeze is BB inside KC.
   // Simplified: (2 * StdDev) < (1.5 * ATR) => Squeeze is ON (avoid entry)
   bool isSqueezeOn = false;
   if(InpUseSqueezeFilter)
     {
      double bb_half_width = 2.0 * stddev[1];
      double kc_half_width = 1.5 * sqz_atr[1];
      isSqueezeOn = bb_half_width < kc_half_width;
     }

   // Pullback Logic
   // Using close[4] which is shift 1 (newest in size 5 array)
   double swingH = GetSwingHigh(InpSwingLookback, 1);
   double swingL = GetSwingLow(InpSwingLookback, 1);
   
   double pullbackLong = swingH - close[4];
   double pullbackShort = close[4] - swingL;
   
   double distAtrLong = (atr[1] > 0) ? pullbackLong / atr[1] : 0.0;
   double distAtrShort = (atr[1] > 0) ? pullbackShort / atr[1] : 0.0;
   
   // Parity Debug CSV Output
   if(InpDebugParity && MQLInfoInteger(MQL_TESTER))
     {
      static int file_handle = INVALID_HANDLE;
      if(file_handle == INVALID_HANDLE)
        {
         file_handle = FileOpen("parity_debug.csv", FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON, ',');
         if(file_handle != INVALID_HANDLE)
           {
            FileWrite(file_handle, "Time", "Open", "High", "Low", "Close", "ADX", "PlusDI", "MinusDI", "ATR", "SMA_Fast", "SMA_Slow");
           }
        }
      
      if(file_handle != INVALID_HANDLE)
        {
         string time_str = TimeToString(iTime(_Symbol, _Period, 1), TIME_DATE|TIME_MINUTES);
         FileWrite(file_handle, time_str, 
                   DoubleToString(open[4], _Digits), DoubleToString(high[4], _Digits), 
                   DoubleToString(low[4], _Digits), DoubleToString(close[4], _Digits), 
                   DoubleToString(current_adx, 4), DoubleToString(pdi[1], 4), 
                   DoubleToString(mdi[1], 4), DoubleToString(atr[1], 5), 
                   DoubleToString(sma_fast[1], 3), DoubleToString(sma_slow[1], 3));
         FileFlush(file_handle); // Force write to disk safely for testing
        }
     }

   bool isSetupLong = false;
   bool isSetupShort = false;
   
   if(isTrend && isLong && !isSqueezeOn)
     {
      if(distAtrLong >= InpMinPbAtr && distAtrLong <= InpMaxPbAtr)
         isSetupLong = longAllowed;
     }

   if(isTrend && isShort && !isSqueezeOn)
     {
      if(distAtrShort >= InpMinPbAtr && distAtrShort <= InpMaxPbAtr)
         isSetupShort = shortAllowed;
     }
     
   // Previous bar state check (for Mode A entry)
   static bool prevSetupLong = false;
   static bool prevSetupShort = false;
   
   bool setupLongStart = isSetupLong && !prevSetupLong;
   bool setupShortStart = isSetupShort && !prevSetupShort;

   // Contextual Price Action Definitions (Mode B)
   // Use index 4 (shift 1, current completed bar) 
   // Use index 3 (shift 2, previous completed bar)
   double candleRange = high[4] - low[4];
   double bodySize = MathAbs(close[4] - open[4]);
   double lowerWick = MathMin(open[4], close[4]) - low[4];
   double upperWick = high[4] - MathMax(open[4], close[4]);
   
   bool isBullPinBar = (lowerWick > candleRange * 0.6) && (bodySize < candleRange * 0.3);
   bool isBearPinBar = (upperWick > candleRange * 0.6) && (bodySize < candleRange * 0.3);
   
   bool isBullEngulfing = (close[4] > open[4]) && (close[4] > open[3]) && (open[4] < close[3]) && (close[3] < open[3]);
   bool isBearEngulfing = (close[4] < open[4]) && (close[4] < open[3]) && (open[4] > close[3]) && (close[3] > open[3]);

   // Contextual Exhaustion Check: Require that the previous bar (index 3) showed momentum loss in the pullback direction.
   // For Long Setup (Pullback is down): Previous bar should be bearish or small body, closing near lows, to make a bullish PA valid reversal.
   bool contextBullish = (close[3] <= open[3]) && (close[3] - low[3] < (high[3] - low[3]) * 0.5); 
   bool contextBearish = (close[3] >= open[3]) && (high[3] - close[3] < (high[3] - low[3]) * 0.5);

   bool paBullish = (isBullPinBar || isBullEngulfing) && contextBullish;
   bool paBearish = (isBearPinBar || isBearEngulfing) && contextBearish;

   // Order Tracking
   bool hasOpenPosition = false;
   long currentType = -1;
   
   if(PositionsTotal() > 0)
     {
      for(int i=0; i<PositionsTotal(); i++)
        {
         if(PositionGetSymbol(i) == _Symbol)
           {
            hasOpenPosition = true;
            currentType = PositionGetInteger(POSITION_TYPE);
            break;
           }
        }
     }

   // Entry Logic
   bool doLongEntry = false;
   bool doShortEntry = false;
   double slPrice = 0.0;

   if(!hasOpenPosition)
     {
      if(!InpUsePriceAction)
        {
         // Mode A: Mechanical
         doLongEntry = setupLongStart;
         doShortEntry = setupShortStart;
         
         if(doLongEntry) slPrice = close[1] - (atr[1] * InpSlAtrMult);
         if(doShortEntry) slPrice = close[1] + (atr[1] * InpSlAtrMult);
        }
      else
        {
         // Mode B: Price Action
         doLongEntry = isSetupLong && paBullish;
         doShortEntry = isSetupShort && paBearish;
         
         // Use the standard SL ATR multiplier to prevent margin exhaustion from tiny SLs
         if(doLongEntry) slPrice = low[4] - (atr[1] * InpSlAtrMult); 
         if(doShortEntry) slPrice = high[4] + (atr[1] * InpSlAtrMult); 
        }
        
      if(doLongEntry)
        {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double sl_dist = ask - slPrice;
         double lot = CalculateLotSize(sl_dist);
         
         if(trade.Buy(lot, _Symbol, ask, slPrice, 0.0, "TrendScanner Long"))
           {
            trail_price = slPrice;
            open_sl = slPrice;
           }
        }
      else if(doShortEntry)
        {
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double sl_dist = slPrice - bid;
         double lot = CalculateLotSize(sl_dist);
         
         if(trade.Sell(lot, _Symbol, bid, slPrice, 0.0, "TrendScanner Short"))
           {
            trail_price = slPrice;
            open_sl = slPrice;
           }
        }
     }
   else
     {
      // Trailing Stop Logic
      double current_sl = PositionGetDouble(POSITION_SL);
      double current_close = close[1];
      
      if(currentType == POSITION_TYPE_BUY)
        {
         double newTrail = current_close - atr[1] * InpTrailAtrMult;
         if(trail_price == 0 || newTrail > trail_price) trail_price = newTrail;
         
         double target_sl = MathMax(open_sl, trail_price);
         if(target_sl > current_sl && target_sl < current_close)
           {
            trade.PositionModify(_Symbol, NormalizeDouble(target_sl, _Digits), 0.0);
           }
        }
      else if(currentType == POSITION_TYPE_SELL)
        {
         double newTrail = current_close + atr[1] * InpTrailAtrMult;
         if(trail_price == 0 || newTrail < trail_price) trail_price = newTrail;
         
         double target_sl = MathMin(open_sl, trail_price);
         if((target_sl < current_sl || current_sl == 0) && target_sl > current_close)
           {
            trade.PositionModify(_Symbol, NormalizeDouble(target_sl, _Digits), 0.0);
           }
        }
     }
     
   // Save states
   prevSetupLong = isSetupLong;
   prevSetupShort = isSetupShort;
   last_bar_time = current_time;
  }
//+------------------------------------------------------------------+
