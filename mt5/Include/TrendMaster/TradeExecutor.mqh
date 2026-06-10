//+------------------------------------------------------------------+
//|                                            TradeExecutor.mqh      |
//|                              TrendMaster EA - Trade Execution     |
//|                    Order sending with error handling & retries     |
//+------------------------------------------------------------------+
#property copyright "TrendMaster"
#property version   "1.00"

//+------------------------------------------------------------------+
//| Trade Executor Class                                              |
//+------------------------------------------------------------------+
class CTradeExecutor
{
private:
   string            m_symbol;
   ulong             m_magic_number;
   int               m_max_retries;
   int               m_retry_delay_ms;
   ulong             m_deviation;        // Slippage in points
   
public:
                     CTradeExecutor();
                    ~CTradeExecutor();
   
   // Initialization
   bool              Init(string symbol, ulong magic_number,
                          int max_retries = 3, int retry_delay_ms = 500,
                          ulong deviation = 30);
   
   // Trade operations
   bool              OpenBuy(double lots, double sl, double tp, string comment = "");
   bool              OpenSell(double lots, double sl, double tp, string comment = "");
   bool              ClosePosition(ulong ticket);
   void              CloseAllPositions();
   
private:
   bool              SendOrder(MqlTradeRequest &request, MqlTradeResult &result);
   string            GetRetcodeDescription(uint retcode);
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CTradeExecutor::CTradeExecutor()
{
   m_max_retries    = 3;
   m_retry_delay_ms = 500;
   m_deviation      = 30;
}

//+------------------------------------------------------------------+
//| Destructor                                                        |
//+------------------------------------------------------------------+
CTradeExecutor::~CTradeExecutor()
{
}

//+------------------------------------------------------------------+
//| Initialize                                                        |
//+------------------------------------------------------------------+
bool CTradeExecutor::Init(string symbol, ulong magic_number,
                           int max_retries, int retry_delay_ms,
                           ulong deviation)
{
   m_symbol         = symbol;
   m_magic_number   = magic_number;
   m_max_retries    = max_retries;
   m_retry_delay_ms = retry_delay_ms;
   m_deviation      = deviation;
   
   Print("TradeExecutor initialized: Symbol=", m_symbol, 
         " Magic=", m_magic_number, " Deviation=", m_deviation);
   return true;
}

//+------------------------------------------------------------------+
//| Open a BUY position                                               |
//+------------------------------------------------------------------+
bool CTradeExecutor::OpenBuy(double lots, double sl, double tp, string comment)
{
   if(lots <= 0) 
   {
      Print("OpenBuy: Invalid lot size: ", lots);
      return false;
   }
   
   int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);
   double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
   
   if(ask == 0)
   {
      Print("OpenBuy: Cannot get ASK price");
      return false;
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   
   request.action    = TRADE_ACTION_DEAL;
   request.symbol    = m_symbol;
   request.volume    = lots;
   request.type      = ORDER_TYPE_BUY;
   request.price     = ask;
   request.sl        = NormalizeDouble(sl, digits);
   request.tp        = NormalizeDouble(tp, digits);
   request.deviation = m_deviation;
   request.magic     = m_magic_number;
   request.comment   = (comment == "") ? "TrendMaster BUY" : comment;
   request.type_filling = ORDER_FILLING_IOC; // XM uses IOC filling
   
   if(SendOrder(request, result))
   {
      Print("BUY opened: Ticket=", result.order, " Price=", result.price,
            " Lots=", lots, " SL=", sl, " TP=", tp);
      return true;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Open a SELL position                                              |
//+------------------------------------------------------------------+
bool CTradeExecutor::OpenSell(double lots, double sl, double tp, string comment)
{
   if(lots <= 0)
   {
      Print("OpenSell: Invalid lot size: ", lots);
      return false;
   }
   
   int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);
   double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
   
   if(bid == 0)
   {
      Print("OpenSell: Cannot get BID price");
      return false;
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   
   request.action    = TRADE_ACTION_DEAL;
   request.symbol    = m_symbol;
   request.volume    = lots;
   request.type      = ORDER_TYPE_SELL;
   request.price     = bid;
   request.sl        = NormalizeDouble(sl, digits);
   request.tp        = NormalizeDouble(tp, digits);
   request.deviation = m_deviation;
   request.magic     = m_magic_number;
   request.comment   = (comment == "") ? "TrendMaster SELL" : comment;
   request.type_filling = ORDER_FILLING_IOC;
   
   if(SendOrder(request, result))
   {
      Print("SELL opened: Ticket=", result.order, " Price=", result.price,
            " Lots=", lots, " SL=", sl, " TP=", tp);
      return true;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Close a specific position by ticket                               |
//+------------------------------------------------------------------+
bool CTradeExecutor::ClosePosition(ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
   {
      Print("ClosePosition: Cannot select position ", ticket);
      return false;
   }
   
   long pos_type   = PositionGetInteger(POSITION_TYPE);
   double volume   = PositionGetDouble(POSITION_VOLUME);
   string symbol   = PositionGetString(POSITION_SYMBOL);
   
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   
   request.action    = TRADE_ACTION_DEAL;
   request.position  = ticket;
   request.symbol    = symbol;
   request.volume    = volume;
   request.deviation = m_deviation;
   request.magic     = m_magic_number;
   request.type_filling = ORDER_FILLING_IOC;
   
   if(pos_type == POSITION_TYPE_BUY)
   {
      request.type  = ORDER_TYPE_SELL;
      request.price = SymbolInfoDouble(symbol, SYMBOL_BID);
   }
   else
   {
      request.type  = ORDER_TYPE_BUY;
      request.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
   }
   
   if(SendOrder(request, result))
   {
      Print("Position closed: Ticket=", ticket, " Price=", result.price);
      return true;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Close all positions managed by this EA                            |
//+------------------------------------------------------------------+
void CTradeExecutor::CloseAllPositions()
{
   int total = PositionsTotal();
   
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      
      if(PositionGetInteger(POSITION_MAGIC) == (long)m_magic_number &&
         PositionGetString(POSITION_SYMBOL) == m_symbol)
      {
         ClosePosition(ticket);
      }
   }
}

//+------------------------------------------------------------------+
//| Send order with retry logic                                       |
//+------------------------------------------------------------------+
bool CTradeExecutor::SendOrder(MqlTradeRequest &request, MqlTradeResult &result)
{
   for(int attempt = 0; attempt < m_max_retries; attempt++)
   {
      ZeroMemory(result);
      
      if(!OrderSend(request, result))
      {
         Print("OrderSend failed (attempt ", attempt + 1, "/", m_max_retries,
               "): error=", GetLastError(), " retcode=", result.retcode,
               " desc=", GetRetcodeDescription(result.retcode));
         
         // Check if retryable
         if(result.retcode == TRADE_RETCODE_REQUOTE ||
            result.retcode == TRADE_RETCODE_PRICE_CHANGED ||
            result.retcode == TRADE_RETCODE_PRICE_OFF ||
            result.retcode == TRADE_RETCODE_CONNECTION ||
            result.retcode == TRADE_RETCODE_TIMEOUT)
         {
            Sleep(m_retry_delay_ms);
            
            // Refresh price for market orders
            if(request.action == TRADE_ACTION_DEAL)
            {
               if(request.type == ORDER_TYPE_BUY)
                  request.price = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
               else if(request.type == ORDER_TYPE_SELL)
                  request.price = SymbolInfoDouble(m_symbol, SYMBOL_BID);
            }
            continue;
         }
         
         // Non-retryable error
         return false;
      }
      
      // Check result
      if(result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED)
         return true;
      
      // Requote - retry with new price
      if(result.retcode == TRADE_RETCODE_REQUOTE)
      {
         Print("Requote received, retrying...");
         Sleep(m_retry_delay_ms);
         if(request.type == ORDER_TYPE_BUY)
            request.price = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
         else if(request.type == ORDER_TYPE_SELL)
            request.price = SymbolInfoDouble(m_symbol, SYMBOL_BID);
         continue;
      }
      
      Print("Order failed: retcode=", result.retcode, 
            " desc=", GetRetcodeDescription(result.retcode));
      return false;
   }
   
   Print("OrderSend failed after ", m_max_retries, " attempts");
   return false;
}

//+------------------------------------------------------------------+
//| Human-readable trade error descriptions                           |
//+------------------------------------------------------------------+
string CTradeExecutor::GetRetcodeDescription(uint retcode)
{
   switch(retcode)
   {
      case TRADE_RETCODE_REQUOTE:        return "Requote";
      case TRADE_RETCODE_REJECT:         return "Request rejected";
      case TRADE_RETCODE_CANCEL:         return "Request canceled";
      case TRADE_RETCODE_PLACED:         return "Order placed";
      case TRADE_RETCODE_DONE:           return "Done";
      case TRADE_RETCODE_DONE_PARTIAL:   return "Partially filled";
      case TRADE_RETCODE_ERROR:          return "General error";
      case TRADE_RETCODE_TIMEOUT:        return "Timeout";
      case TRADE_RETCODE_INVALID:        return "Invalid request";
      case TRADE_RETCODE_INVALID_VOLUME: return "Invalid volume";
      case TRADE_RETCODE_INVALID_PRICE:  return "Invalid price";
      case TRADE_RETCODE_INVALID_STOPS:  return "Invalid stops";
      case TRADE_RETCODE_TRADE_DISABLED: return "Trading disabled";
      case TRADE_RETCODE_MARKET_CLOSED:  return "Market closed";
      case TRADE_RETCODE_NO_MONEY:       return "Insufficient funds";
      case TRADE_RETCODE_PRICE_CHANGED:  return "Price changed";
      case TRADE_RETCODE_PRICE_OFF:      return "Price off";
      case TRADE_RETCODE_CONNECTION:     return "No connection";
      case TRADE_RETCODE_FROZEN:         return "Order frozen";
      case TRADE_RETCODE_TOO_MANY_REQUESTS: return "Too many requests";
      case 10027:                        return "AutoTrading disabled";
      default:                           return "Unknown (" + IntegerToString(retcode) + ")";
   }
}
//+------------------------------------------------------------------+
