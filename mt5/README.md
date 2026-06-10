# NakaneMaster (MT5 EA)

**通貨ペア:** USDJPY  
**時間足:** M1  
**バージョン:** 2.01 (Short Only Edition)  
**検証結果:** PF 1.45 (2023-2025)

---

## 概要
ゴトー日（5・10日）の仲値（9:55 JST）における需給アノマリーを利用したEAです。
最新の分析に基づき、**「仲値後の戻り売り（ショート）」** に特化しています。

## インストール手順

1. **配置**
   - ソースコード (`NakaneMaster.mq5`) を `Experts` フォルダに配置します。
     - `MQL5/Experts/NakaneMaster/NakaneMaster.mq5` (推奨)
   - 依存ライブラリ (`Include` フォルダ) も配置されていることを確認します。
     - `MQL5/Include/NakaneMaster/TimeFilter.mqh`
     - `MQL5/Include/TrendMaster/RiskManager.mqh`
     - `MQL5/Include/TrendMaster/TradeExecutor.mqh`

2. **コンパイル**
   - MT5のメタエディタを開き、`NakaneMaster.mq5` をコンパイルします。
   - エラーが出ないことを確認してください。

3. **チャート設定**
   - 通貨ペア: **USDJPY**
   - 時間足: **M1 (1分足)** ※重要

4. **EA適用**
   - ナビゲータから `NakaneMaster` をチャートにドラッグ＆ドロップします。

## パラメータ設定

| パラメータ | 推奨値 | 説明 |
| :--- | :--- | :--- |
| **InpServerGMTOffset** | **Winter=2 / Summer=3** | XM Trading等の標準設定。これがズレると動作しません。 |
| **InpGotobiOnly** | `true` | ゴトー日（5,10,15,20,25,30日）のみトレードします。 |
| **InpRiskPercent** | `2.0` | 口座資金に対する1トレードあたりの許容リスク(%)。 |
| **InpSL_Pips** | `15.0` | 損切り幅。 |
| **InpMaxSpread_Pips** | `2.0` | スプレッドフィルター。これ以上開いているときはエントリーしません。 |

## ロジック詳細

- **エントリー**: 09:55 JST (仲値確定直後) に **売り(Sell)**
  - *買い(Buy)ロジックは無効化されています。*
- **エグジット**: 10:25 JST (時間決済) または ストップロス(-15pips)
- **資金管理**: 資金の2%リスクに基づき、ロット数を自動計算します。

## 注意点
- **GMTオフセット**: サーバー時間が冬時間GMT+2 / 夏時間GMT+3 のブローカー(XMなど)を想定しています。日本時間9:55に動作するか、バックテストまたはデモ口座で必ず確認してください。

