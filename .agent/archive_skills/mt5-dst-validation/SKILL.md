---
description: MT5 EAの夏時間ロジックとサーバー時間（GMT Offset）を検証する手順
---

# MT5 Server Time & DST Verification Skill

## 背景 (Why)
MT5のストラテジーテスター内で時間ロジック（特にDST移行日）をデバッグしようとすると、以下の問題が発生しやすい。
1.  **ログの間引き**: 高頻度ログが出力されるとテスターがログを省略する。
2.  **実行タイミング**: 具体的な日時（例: 3月第2日曜日 02:00）での動作を確認するには、長時間のバックテストが必要。
3.  **環境差異**: バックテスト環境とライブ環境で `TimeCurrent()` の挙動が異なる場合がある。

## 解決策 (Solution)
**専用のスクリプト (`CheckDST.mq5`)** を作成し、任意のチャート上で実行することで、ロジックを「隔離環境」で検証する。

## 手順 (Procedure)

### 1. 検証用スクリプトの作成
`MQL5/Scripts` フォルダに `CheckDST.mq5` を作成する。
以下のテンプレートを使用し、検証したい日時 (`dt` 構造体) をハードコードする。

### 2. スクリプトのデプロイ
`force_deploy.ps1` を使用してデプロイする場合、`Experts` だけでなく `Scripts` もコピーされるようにスクリプトを修正する必要がある。

```powershell
# force_deploy.ps1 excerpt
Copy-Item "Scripts\*.mq5" "$dest\MQL5\Scripts\" -Force
```

### 3. MT5上での実行
1.  MT5 ナビゲータ -> 「スクリプト」 -> `CheckDST` をチャートにドラッグ＆ドロップ。
2.  「パラメーター入力」等は特にないため「OK」をクリック。
3.  「操作履歴 (Journal)」タブを確認。

### 4. ログ確認
`Experts` タブまたは `Journal` タブに `RESULT:` から始まるログが出力される。
例: `RESULT: 08:55 JST -> SUMMER TIME LOGIC APPLIED`

## テンプレート (CheckDST.mq5)

```cpp
//+------------------------------------------------------------------+
//|                                                     CheckDST.mq5 |
//|                                  Copyright 2024, NakaneMaster |
//+------------------------------------------------------------------+
#property script_show_inputs
#include <NakaneMaster\TimeFilter.mqh>

void OnStart()
{
   CTimeFilter timeFilter;
   timeFilter.Init(2, true); // Offset 2, Auto-DST True
   
   // Test Target Date
   MqlDateTime dt;
   dt.year = 2024; dt.mon = 3; dt.day = 11;
   dt.hour = 2; dt.min = 55; dt.sec = 0;
   
   datetime test_time = StructToTime(dt);
   datetime jst = timeFilter.GetJapanTime(test_time);
   MqlDateTime jst_dt; TimeToStruct(jst, jst_dt);
   
   Print("=== DST CHECK START ===");
   PrintFormat("Test Server Time: %s", TimeToString(test_time));
   PrintFormat("Calculated JST:   %s", TimeToString(jst));
   
   // Logic Verification
   if(jst_dt.hour == 8 && jst_dt.min == 55)
      Print("RESULT: SUMMER TIME LOGIC APPLIED (Offset 3)");
   else if(jst_dt.hour == 9 && jst_dt.min == 55)
      Print("RESULT: WINTER TIME LOGIC APPLIED (Offset 2)");
   else
      Print("RESULT: UNKNOWN OFFSET");
      
   Print("=== DST CHECK END ===");
}
```
