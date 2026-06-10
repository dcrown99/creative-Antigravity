//+------------------------------------------------------------------+
//|                                              RiskManager.mqh      |
//|                               TrendMaster EA - Risk Management    |
//|                  ATR-based position sizing, SL/TP, trailing stop  |
//+------------------------------------------------------------------+
#property copyright "TrendMaster"
#property version   "1.00"

//+------------------------------------------------------------------+
//| Risk Manager Class                                                |
//+------------------------------------------------------------------+
class CRiskManager
{
private:
   // ATR handle
   int               m_atr_handle;
   
   // Parameters
   string            m_symbol;
   ENUM_TIMEFRAMES   m_timeframe;
   int               m_atr_period;
   double            m_risk_percent;
   double            m_sl_atr_mult;
   double            m_tp_atr_mult;
   double            m_trail_atr_mult;
   int               m_max_positions;
   ulong             m_magic_number;
   
public:
                     CRiskManager();
                    ~CRiskManager();
   
   // Initialization
   bool              Init(string symbol,
                          ENUM_TIMEFRAMES timeframe,
                          int atr_period,
                          double risk_percent,
                          double sl_atr_mult,
                          double tp_atr_mult,
                          double trail_atr_mult,
                          int max_positions,
                          ulong magic_number);
   void              Deinit();
   
   // Core functions
   double            CalculateLotSize(double sl_distance);
   double            GetATRValue();
   double            GetStopLossDistance();
   double            GetTakeProfitDistance();
   void              ManageTrailingStop();
   int               CountOpenPositions();
   bool              CanOpenNewPosition();
   
   // Helpers
   double            NormalizeLots(double lots);
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CRiskManager::CRiskManager()
{
   m_atr_handle = INVALID_HANDLE;
}

//+------------------------------------------------------------------+
//| Destructor                                                        |
//+------------------------------------------------------------------+
CRiskManager::~CRiskManager()
{
   Deinit();
}

//+------------------------------------------------------------------+
//| Initialize                                                        |
//+------------------------------------------------------------------+
bool CRiskManager::Init(string symbol,
                         ENUM_TIMEFRAMES timeframe,
                         int atr_period,
                         double risk_percent,
                         double sl_atr_mult,
                         double tp_atr_mult,
                         double trail_atr_mult,
                         int max_positions,
                         ulong magic_number)
{
   m_symbol         = symbol;
   m_timeframe      = timeframe;
   m_atr_period     = atr_period;
   m_risk_percent   = risk_percent;
   m_sl_atr_mult    = sl_atr_mult;
   m_tp_atr_mult    = tp_atr_mult;
   m_trail_atr_mult = trail_atr_mult;
   m_max_positions  = max_positions;
   m_magic_number   = magic_number;
   
   // Create ATR handle on entry timeframe
   m_atr_handle = iATR(m_symbol, m_timeframe, m_atr_period);
   if(m_atr_handle == INVALID_HANDLE)
   {
      Print("Failed to create ATR handle: ", GetLastError());
      return false;
   }
   
   Print("RiskManager initialized: Risk=", m_risk_percent, "%, SL=", m_sl_atr_mult,
         "xATR, TP=", m_tp_atr_mult, "xATR, Trail=", m_trail_atr_mult, "xATR");
   return true;
}

//+------------------------------------------------------------------+
//| Release handles                                                   |
//+------------------------------------------------------------------+
void CRiskManager::Deinit()
{
   if(m_atr_handle != INVALID_HANDLE)
   {
      IndicatorRelease(m_atr_handle);
      m_atr_handle = INVALID_HANDLE;
   }
}

//+------------------------------------------------------------------+
//| Get current ATR value (using completed bar)                       |
//+------------------------------------------------------------------+
double CRiskManager::GetATRValue()
{
   double atr[];
   if(m_atr_handle == INVALID_HANDLE) return 0;
   
   if(CopyBuffer(m_atr_handle, 0, 1, 1, atr) < 1)
   {
      Print("Failed to get ATR value: ", GetLastError());
      return 0;
   }
   
   return atr[0];
}

//+------------------------------------------------------------------+
//| Calculate SL distance in price                                    |
//+------------------------------------------------------------------+
double CRiskManager::GetStopLossDistance()
{
   double atr = GetATRValue();
   if(atr == 0) return 0;
   return atr * m_sl_atr_mult;
}

//+------------------------------------------------------------------+
//| Calculate TP distance in price                                    |
//+------------------------------------------------------------------+
double CRiskManager::GetTakeProfitDistance()
{
   double atr = GetATRValue();
   if(atr == 0) return 0;
   return atr * m_tp_atr_mult;
}

//+------------------------------------------------------------------+
//| Calculate position size based on risk percentage                  |
//|                                                                   |
//| Formula:                                                          |
//|   Risk Amount = Account Balance * Risk%                           |
//|   Lots = Risk Amount / (SL in points * Point Value per Lot)       |
//+------------------------------------------------------------------+
double CRiskManager::CalculateLotSize(double sl_distance)
{
   if(sl_distance <= 0) return 0;
   
   double account_balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double risk_amount     = account_balance * (m_risk_percent / 100.0);
   
   // Get tick value (value of 1 point movement per 1 lot)
   double tick_size  = SymbolInfoDouble(m_symbol, SYMBOL_TRADE_TICK_SIZE);
   double tick_value = SymbolInfoDouble(m_symbol, SYMBOL_TRADE_TICK_VALUE);
   
   if(tick_size == 0 || tick_value == 0) return 0;
   
   // Calculate the monetary value of the SL distance per lot
   double sl_value_per_lot = (sl_distance / tick_size) * tick_value;
   
   if(sl_value_per_lot == 0) return 0;
   
   // Calculate lot size
   double lots = risk_amount / sl_value_per_lot;
   
   return NormalizeLots(lots);
}

//+------------------------------------------------------------------+
//| Normalize lot size to broker requirements                         |
//+------------------------------------------------------------------+
double CRiskManager::NormalizeLots(double lots)
{
   double min_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MIN);
   double max_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MAX);
   double lot_step = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_STEP);
   
   // Clamp to min/max
   if(lots < min_lot) lots = min_lot;
   if(lots > max_lot) lots = max_lot;
   
   // Round to lot step
   if(lot_step > 0)
      lots = MathFloor(lots / lot_step) * lot_step;
   
   // Normalize to 2 decimal places
   lots = NormalizeDouble(lots, 2);
   
   return lots;
}

//+------------------------------------------------------------------+
//| Count open positions for this EA (by magic number)                |
//+------------------------------------------------------------------+
int CRiskManager::CountOpenPositions()
{
   int count = 0;
   int total = PositionsTotal();
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      
      if(PositionGetInteger(POSITION_MAGIC) == (long)m_magic_number &&
         PositionGetString(POSITION_SYMBOL) == m_symbol)
      {
         count++;
      }
   }
   
   return count;
}

//+------------------------------------------------------------------+
//| Check if we can open a new position                               |
//+------------------------------------------------------------------+
bool CRiskManager::CanOpenNewPosition()
{
   return (CountOpenPositions() < m_max_positions);
}

//+------------------------------------------------------------------+
//| Manage trailing stop for all open positions                       |
//|                                                                   |
//| Trail SL by ATR * trail_multiplier from current price             |
//| Only move SL in the profitable direction (never widen)            |
//+------------------------------------------------------------------+
void CRiskManager::ManageTrailingStop()
{
   double atr = GetATRValue();
   if(atr == 0) return;
   
   double trail_distance = atr * m_trail_atr_mult;
   int total = PositionsTotal();
   
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      
      // Only manage our positions
      if(PositionGetInteger(POSITION_MAGIC) != (long)m_magic_number) continue;
      if(PositionGetString(POSITION_SYMBOL) != m_symbol) continue;
      
      long pos_type    = PositionGetInteger(POSITION_TYPE);
      double current_sl = PositionGetDouble(POSITION_SL);
      double current_tp = PositionGetDouble(POSITION_TP);
      double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      int digits        = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);
      
      double new_sl = 0;
      
      if(pos_type == POSITION_TYPE_BUY)
      {
         double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
         new_sl = NormalizeDouble(bid - trail_distance, digits);
         
         // Only move SL up, never down. Only trail after reaching breakeven.
         if(new_sl > current_sl && new_sl > open_price)
         {
            MqlTradeRequest request = {};
            MqlTradeResult  result  = {};
            
            request.action   = TRADE_ACTION_SLTP;
            request.position = ticket;
            request.symbol   = m_symbol;
            request.sl       = new_sl;
            request.tp       = current_tp;
            
            if(!OrderSend(request, result))
               Print("Trail SL failed for ticket ", ticket, ": ", result.comment);
         }
      }
      else if(pos_type == POSITION_TYPE_SELL)
      {
         double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
         new_sl = NormalizeDouble(ask + trail_distance, digits);
         
         // Only move SL down, never up. Only trail after reaching breakeven.
         if((current_sl == 0 || new_sl < current_sl) && new_sl < open_price)
         {
            MqlTradeRequest request = {};
            MqlTradeResult  result  = {};
            
            request.action   = TRADE_ACTION_SLTP;
            request.position = ticket;
            request.symbol   = m_symbol;
            request.sl       = new_sl;
            request.tp       = current_tp;
            
            if(!OrderSend(request, result))
               Print("Trail SL failed for ticket ", ticket, ": ", result.comment);
         }
      }
   }
}
//+------------------------------------------------------------------+
