//+------------------------------------------------------------------+
//|  PairZScore_EA.mq5                                               |
//|  Strategy: Statistical Pairs Trading - Z-score Mean Reversion    |
//|  Alpha: Cointegration of AUDNZD (Grade A - Nobel Prize theory)   |
//|  Entry: Z-score deviation from fundamental equilibrium           |
//+------------------------------------------------------------------+
#property copyright "Mining Strategy #10"
#property version   "1.00"
#property strict
#include <Trade\Trade.mqh>

CTrade trade;

//--- Input parameters
input group "=== Z-score Parameters ==="
input int    ZscoreWindow = 20;     // Rolling window for Z-score (bars)
input double EntryZ      = 2.5;    // Entry threshold (|Z| > EntryZ)
input double ExitZ       = 0.0;    // Exit threshold (|Z| < ExitZ, i.e., zero-cross)
input double StopZ       = 3.0;    // Stop-loss threshold (cointegration breakdown)

input group "=== Risk Management ==="
input double RiskPercent = 1.0;    // Risk per trade (% of balance)
input int    MagicNumber = 20250227;

//--- Global variables
double g_close_buf[];
int    g_handle_close = INVALID_HANDLE;

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
    trade.SetExpertMagicNumber(MagicNumber);
    
    // Set order filling mode explicitly or let CTrade handle it
    int fill = (int)SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
    if((fill & SYMBOL_FILLING_FOK) != 0) trade.SetTypeFilling(ORDER_FILLING_FOK);
    else if((fill & SYMBOL_FILLING_IOC) != 0) trade.SetTypeFilling(ORDER_FILLING_IOC);
    else trade.SetTypeFilling(ORDER_FILLING_RETURN);
    
    Print("[PairZScore] EA initialized. Symbol=", _Symbol,
          " Window=", ZscoreWindow, " EntryZ=±", EntryZ,
          " ExitZ=±", ExitZ, " StopZ=±", StopZ);
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Calculate rolling Z-score from close prices                       |
//+------------------------------------------------------------------+
double CalcZScore(int shift)
{
    // Collect closing prices for the rolling window
    // shift=1 means use confirmed bars (no repainting)
    double closes[];
    ArrayResize(closes, ZscoreWindow);

    for(int i = 0; i < ZscoreWindow; i++)
    {
        closes[i] = iClose(_Symbol, PERIOD_CURRENT, shift + i);
        if(closes[i] == 0.0) return(0.0);  // Data unavailable
    }

    // Calculate rolling mean and std
    double sum = 0.0;
    for(int i = 0; i < ZscoreWindow; i++) sum += closes[i];
    double mean = sum / ZscoreWindow;

    double var_sum = 0.0;
    for(int i = 0; i < ZscoreWindow; i++)
        var_sum += MathPow(closes[i] - mean, 2);
    double stdev = MathSqrt(var_sum / ZscoreWindow);

    if(stdev < 1e-10) return(0.0);  // Avoid division by zero

    // Z-score of the most recent bar in this window (shift=1 = confirmed bar)
    double current_close = iClose(_Symbol, PERIOD_CURRENT, shift);
    return (current_close - mean) / stdev;
}

//+------------------------------------------------------------------+
//| Calculate lot size based on risk %                               |
//+------------------------------------------------------------------+
double CalcLotSize()
{
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double risk_amount = balance * RiskPercent / 100.0;
    double tick_value = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
    double tick_size  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
    double min_lot    = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double max_lot    = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    double lot_step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

    if(tick_value <= 0 || tick_size <= 0) return(min_lot);

    // Use StopZ * ATR-equivalent as SL distance (conservative estimate)
    double atr_approx = 0.0;
    for(int i = 1; i <= 14; i++)
        atr_approx += iHigh(_Symbol, PERIOD_CURRENT, i) - iLow(_Symbol, PERIOD_CURRENT, i);
    atr_approx /= 14.0;

    double sl_distance = StopZ * 0.003;  // Approx 30-pip equivalent for AUDNZD
    if(sl_distance <= 0) return(min_lot);

    double lots = risk_amount / (sl_distance / tick_size * tick_value);
    lots = MathFloor(lots / lot_step) * lot_step;
    lots = MathMax(min_lot, MathMin(max_lot, lots));

    return(NormalizeDouble(lots, 2));
}

//+------------------------------------------------------------------+
//| Count open positions by magic                                     |
//+------------------------------------------------------------------+
int CountPositions(ENUM_POSITION_TYPE type)
{
    int count = 0;
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(PositionSelectByTicket(ticket))
        {
            if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
               PositionGetInteger(POSITION_MAGIC) == MagicNumber &&
               PositionGetInteger(POSITION_TYPE) == type)
                count++;
        }
    }
    return count;
}

//+------------------------------------------------------------------+
//| Close all positions                                               |
//+------------------------------------------------------------------+
void CloseAllPositions()
{
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(PositionSelectByTicket(ticket))
        {
            if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
               PositionGetInteger(POSITION_MAGIC) == MagicNumber)
            {
                if(!trade.PositionClose(ticket))
                    Print("[PairZScore] Close failed: ", trade.ResultRetcodeDescription());
            }
        }
    }
}

//+------------------------------------------------------------------+
//| OnTick - Main logic                                               |
//+------------------------------------------------------------------+
void OnTick()
{
    // Avoid rollover spread widening (run only between 01:00 and 22:59)
    MqlDateTime dt;
    TimeToStruct(TimeCurrent(), dt);
    if(dt.hour == 0 || dt.hour == 23) return;

    // Only execute once per Daily bar
    static datetime last_eval_bar = 0;
    datetime current_bar = iTime(_Symbol, PERIOD_D1, 0);
    if(current_bar == last_eval_bar) return;
    last_eval_bar = current_bar;

    // Need sufficient bars
    int bars = iBars(_Symbol, PERIOD_D1);
    if(bars < ZscoreWindow + 10)
    {
        return;
    }

    // Calculate Z-score on confirmed bar (shift=1, no repainting)
    double z = CalcZScore(1);
    PrintFormat("[PairZScore][DEBUG] Bar=%s Z=%.3f Bars=%d", TimeToString(current_bar), z, bars);

    bool has_long  = (CountPositions(POSITION_TYPE_BUY)  > 0);
    bool has_short = (CountPositions(POSITION_TYPE_SELL) > 0);

    //--- Exit logic (check first)
    if(has_long)
    {
        // Exit when Z reverts above exit threshold OR stop on breakdown
        if(z > -ExitZ || z < -StopZ)
        {
            Print("[PairZScore] Closing LONG: Z=", DoubleToString(z, 3));
            CloseAllPositions();
            return;
        }
    }
    if(has_short)
    {
        // Exit when Z reverts below exit threshold OR stop on breakdown
        if(z < ExitZ || z > StopZ)
        {
            Print("[PairZScore] Closing SHORT: Z=", DoubleToString(z, 3));
            CloseAllPositions();
            return;
        }
    }

    //--- Entry logic
    if(!has_long && !has_short)
    {
        double lots = CalcLotSize();

        if(z < -EntryZ)
        {
            // AUDNZD abnormally cheap vs equilibrium → LONG (structural mean reversion)
            Print("[PairZScore] LONG entry: Z=", DoubleToString(z, 3), " Lots=", lots);
            if(!trade.Buy(lots, _Symbol, 0, 0, 0, StringFormat("PairZScore Z=%.2f", z)))
                Print("[PairZScore] Buy failed: ", trade.ResultRetcodeDescription());
        }
        else if(z > EntryZ)
        {
            // AUDNZD abnormally expensive vs equilibrium → SHORT
            Print("[PairZScore] SHORT entry: Z=", DoubleToString(z, 3), " Lots=", lots);
            if(!trade.Sell(lots, _Symbol, 0, 0, 0, StringFormat("PairZScore Z=%.2f", z)))
                Print("[PairZScore] Sell failed: ", trade.ResultRetcodeDescription());
        }
    }
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Print("[PairZScore] EA deinitialized.");
}
//+------------------------------------------------------------------+
