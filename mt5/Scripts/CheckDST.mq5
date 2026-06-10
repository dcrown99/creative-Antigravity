//+------------------------------------------------------------------+
//|                                                     CheckDST.mq5 |
//|                                  Copyright 2024, NakaneMaster |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "NakaneMaster"
#property version   "1.00"
#property script_show_inputs

#include <NakaneMaster\TimeFilter.mqh>

//+------------------------------------------------------------------+
//| Script program start function                                    |
//+------------------------------------------------------------------+
void OnStart()
{
   CTimeFilter timeFilter;
   timeFilter.Init(2, true); // Offset 2, Auto-DST True
   
   // Test Date: March 11, 2024 (Monday) at 02:55 Server Time
   // Expected: Summer Time (DST=True). Offset became 3.
   // JST = Server - 3 + 9 = Server + 6.
   // 02:55 + 6 = 08:55.
   
   MqlDateTime dt;
   dt.year = 2024;
   dt.mon = 3;
   dt.day = 11;
   dt.hour = 2;
   dt.min = 55;
   dt.sec = 0;
   
   datetime test_time = StructToTime(dt);
   
   datetime jst = timeFilter.GetJapanTime(test_time);
   
   MqlDateTime jst_dt;
   TimeToStruct(jst, jst_dt);
   
   Print("=== DST CHECK START ===");
   PrintFormat("Test Server Time: %s", TimeToString(test_time));
   PrintFormat("Calculated JST:   %s", TimeToString(jst));
   PrintFormat("JST Hour: %d, Min: %d", jst_dt.hour, jst_dt.min);
   
   // Check if 09:55
   if(jst_dt.hour == 9 && jst_dt.min == 55)
   {
      Print("RESULT: 09:55 JST -> WINTER TIME LOGIC APPLIED (Offset 2)");
   }
   else if(jst_dt.hour == 8 && jst_dt.min == 55)
   {
      Print("RESULT: 08:55 JST -> SUMMER TIME LOGIC APPLIED (Offset 3)");
   }
   else
   {
      Print("RESULT: UNKNOWN OFFSET");
   }
   
   Print("=== DST CHECK END ===");
}
