//+------------------------------------------------------------------+
//|                                                   TimeFilter.mqh  |
//|                                            NakaneMaster Component |
//|                                                                    |
//| Handles GMT conversion, Nakane Time Logic, and Gotobi Check       |
//| Now supports Auto-DST (EET Standard)                              |
//+------------------------------------------------------------------+
#property copyright "NakaneMaster"
#property version   "2.10"

class CTimeFilter
{
private:
   int m_manual_offset; 
   bool m_auto_dst;

public:
   CTimeFilter();
   ~CTimeFilter();
   
   // Init with manual offset or Auto-DST mode
   // auto_dst=true assumes EET (GMT+2/3) compliant server (e.g. XM, Axi)
   void Init(int manual_offset, bool auto_dst=true);
   
   // Get JST Time (GMT+9) handling DST automatically
   datetime GetJapanTime(datetime server_time);
   
   // Get specific Gotobi Date (5, 10... 30) or 0 if not Gotobi
   int GetGotobiDate(datetime server_time);

   bool IsGotobiDay(datetime server_time);
   
   // Check if today (JST) is the last business day of the month
   bool IsMonthEnd(datetime server_time);
   
private:
   int GetCurrentGMTOffset(datetime time);
   bool IsDstEET(datetime time);
   int DaysInMonth(int year, int month);
};

//+------------------------------------------------------------------+
CTimeFilter::CTimeFilter() : m_manual_offset(2), m_auto_dst(true) {}
CTimeFilter::~CTimeFilter() {}

void CTimeFilter::Init(int manual_offset, bool auto_dst)
{
   m_manual_offset = manual_offset;
   m_auto_dst = auto_dst;
}

//+------------------------------------------------------------------+
//| Get JST Time                                                       |
//+------------------------------------------------------------------+
datetime CTimeFilter::GetJapanTime(datetime server_time)
{
   // Server(GMT+X) -> GMT -> JST(GMT+9)
   int offset = GetCurrentGMTOffset(server_time);
   
   // Convert Server to GMT
   datetime gmt = server_time - (offset * 3600);
   
   // Convert GMT to JST
   return gmt + (9 * 3600);
}

//+------------------------------------------------------------------+
//| Determine Offset (Fixed of Dynamic)                                |
//+------------------------------------------------------------------+
int CTimeFilter::GetCurrentGMTOffset(datetime time)
{
   if(!m_auto_dst) return m_manual_offset;
   
   // Auto EET Detection: Win=2, Sum=3
   return IsDstEET(time) ? 3 : 2;
}

//+------------------------------------------------------------------+
//| Check US DST (XM/FX Defaults)                                      |
//| Start: 2nd Sunday March at 02:00                                   |
//| End:   1st Sunday November at 02:00                                |
//+------------------------------------------------------------------+
bool CTimeFilter::IsDstEET(datetime time)
{
   MqlDateTime dt;
   TimeToStruct(time, dt);
   
   // Winter: Jan, Feb, Dec
   if(dt.mon < 3 || dt.mon > 11) return false;
   
   // Summer: Apr to Oct
   if(dt.mon > 3 && dt.mon < 11) return true;
   
   // March: Starts 2nd Sunday at 02:00
   if(dt.mon == 3)
   {
      // Find 1st of March
      MqlDateTime mar1 = dt; mar1.day = 1; mar1.mon = 3;
      datetime mar1_t = StructToTime(mar1);
      TimeToStruct(mar1_t, mar1);
      
      int days_to_sun1 = (7 - mar1.day_of_week) % 7;
      int sun1_day = 1 + days_to_sun1;
      int sun2_day = sun1_day + 7;
      
      if(dt.day > sun2_day) return true;
      if(dt.day < sun2_day) return false;
      
      // On the day
      if(dt.hour >= 2) return true; // Switch at 2am
      return false;
   }
   
   // November: Ends 1st Sunday at 02:00
   if(dt.mon == 11)
   {
      // Find 1st of Nov
      MqlDateTime nov1 = dt; nov1.day = 1; nov1.mon = 11;
      datetime nov1_t = StructToTime(nov1);
      TimeToStruct(nov1_t, nov1);
      
      int days_to_sun1 = (7 - nov1.day_of_week) % 7;
      int sun1_day = 1 + days_to_sun1;
      
      if(dt.day > sun1_day) return false; // Already Winter
      if(dt.day < sun1_day) return true;  // Still Summer
      
      // On the day
      if(dt.hour >= 2) return false; // Switch Back to Winter
      return true;
   }
   
   return false; 
}

//+------------------------------------------------------------------+
//| Get Gotobi Date Type (5, 10, 15, 20, 25, 30)                       |
//| Returns 0 if not a Gotobi day                                      |
//+------------------------------------------------------------------+
int CTimeFilter::GetGotobiDate(datetime server_time)
{
   datetime jst = GetJapanTime(server_time);
   MqlDateTime dt;
   TimeToStruct(jst, dt);
   
   // 1. Basic Check on Weekdays
   if(dt.day % 5 == 0 && dt.day_of_week >= 1 && dt.day_of_week <= 5) return dt.day;
   
   // 2. Weekend Adjustment (Friday covers Sat/Sun)
   if(dt.day_of_week == 5) // Friday
   {
       // Check Sat
       datetime sat = jst + 86400;
       MqlDateTime dts; TimeToStruct(sat, dts);
       if(dts.day % 5 == 0) return dts.day;
       
       // Check Sun
       datetime sun = jst + 172800;
       MqlDateTime dtu; TimeToStruct(sun, dtu);
       if(dtu.day % 5 == 0) return dtu.day;
   }
   
   return 0;
}

//+------------------------------------------------------------------+
//| Gotobi Check (Wrapper)                                             |
//+------------------------------------------------------------------+
bool CTimeFilter::IsGotobiDay(datetime server_time)
{
   return GetGotobiDate(server_time) > 0;
}

//+------------------------------------------------------------------+
//| Helper: Days in Month                                               |
//+------------------------------------------------------------------+
int CTimeFilter::DaysInMonth(int year, int month)
{
   int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
   if(month < 1 || month > 12) return 30;
   int d = days[month - 1];
   // Leap year for February
   if(month == 2 && (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)))
      d = 29;
   return d;
}

//+------------------------------------------------------------------+
//| Check if today (JST) is the last business day of the month         |
//| Logic: Check if the next weekday falls in a different month        |
//+------------------------------------------------------------------+
bool CTimeFilter::IsMonthEnd(datetime server_time)
{
   datetime jst = GetJapanTime(server_time);
   MqlDateTime dt;
   TimeToStruct(jst, dt);
   
   int total_days = DaysInMonth(dt.year, dt.mon);
   
   // Check if any remaining day this month is a weekday
   for(int d = dt.day + 1; d <= total_days; d++)
   {
      MqlDateTime check = dt;
      check.day = d;
      datetime check_t = StructToTime(check);
      TimeToStruct(check_t, check);
      
      // If there's still a weekday left in this month, today is NOT month-end
      if(check.day_of_week >= 1 && check.day_of_week <= 5)
         return false;
   }
   
   // No weekdays remain -> today IS the last business day
   return true;
}
