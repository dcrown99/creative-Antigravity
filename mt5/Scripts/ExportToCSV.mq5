//+------------------------------------------------------------------+
//|                                                  ExportToCSV.mq5  |
//|                                      Script for Data Extraction   |
//|                                      DEBUG VERSION                |
//+------------------------------------------------------------------+
#property copyright "Python Workflow"
#property version   "1.03"
#property script_show_inputs

input string   InpFileNamePrefix = "Data\\"; 
input datetime InpStartDate_M1   = D'2023.01.01'; 
input datetime InpEndDate        = D'2025.12.31'; 

void OnStart()
{
   Alert("Script Started. Target: USDJPY M1 (2023-)");
   
   if(EnsureHistory("USDJPY", PERIOD_M1, InpStartDate_M1))
   {
      Export("USDJPY", PERIOD_M1, InpStartDate_M1, InpEndDate);
   }
   else
   {
      Alert("History Download Failed for M1");
   }
   
   Alert("Script Finished.");
}

bool EnsureHistory(string symbol, ENUM_TIMEFRAMES period, datetime target_date)
{
   // Check current oldest
   long first_date_sec = SeriesInfoInteger(symbol, period, SERIES_FIRSTDATE);
   datetime first_date = (datetime)first_date_sec;
   
   Alert("Oldest Date Found: ", first_date);
   
   if(first_date > 0 && first_date <= target_date) return true;
   
   Alert("Attempting to download history... Please wait.");
   
   int max_attempts = 10; 
   for(int i=0; i<max_attempts; i++)
   {
      first_date = (datetime)SeriesInfoInteger(symbol, period, SERIES_FIRSTDATE);
      if(first_date > 0 && first_date <= target_date) return true;
      
      // Request data
      datetime query = first_date - 30*24*3600; // 1 month prior
      MqlRates rates[];
      CopyRates(symbol, period, query, first_date, rates);
      
      Sleep(1000);
   }
   
   return false;
}

void Export(string symbol, ENUM_TIMEFRAMES period, datetime start_date, datetime end_date)
{
   string filename = symbol + "_PERIOD_M1.csv"; // Simple filename
   
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   
   int copied = CopyRates(symbol, period, start_date, end_date, rates);
   if(copied <= 0)
   {
      Alert("CopyRates Failed. Error: ", GetLastError());
      return;
   }
   
   Alert("CopyRates Success. Bars: ", copied);
   
   int handle = FileOpen(filename, FILE_WRITE|FILE_CSV|FILE_ANSI, ",");
   if(handle == INVALID_HANDLE)
   {
      Alert("FileOpen Failed. Error: ", GetLastError());
      return;
   }
   
   FileWrite(handle, "Date", "Time", "Open", "High", "Low", "Close", "TickVol", "Vol", "Spread");
   
   for(int i=0; i<copied; i++)
   {
      string date = TimeToString(rates[i].time, TIME_DATE);
      string time = TimeToString(rates[i].time, TIME_MINUTES);
      FileWrite(handle, date, time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume, rates[i].real_volume, rates[i].spread);
   }
   
   FileClose(handle);
   Alert("Export Complete: ", filename);
}
