# Verification Ticket: MonthEndFix (REJECTED)

## 概要
月次リバランス（Month-End Rebalancing）戦略の実装および検証を行ったが、**ロバスト性の欠如（Curve Fittingのリスク）** が確認されたため、採用を見送った。

## 検証結果
*   **ロジック:** 正常動作確認済み（PythonシミュレーションとMT5バックテストの結果が一致）。
*   **パフォーマンス:**
    *   当日シグナル（T）: PF 0.19（大敗）。2024年の相場で逆行が多発。
    *   前日シグナル（T-1）: PF 3.16（優秀）。1/31の大敗を回避できる。
*   **判断:**
    *   わずかなパラメータ変更（T vs T-1）で結果が激変するのは、典型的なオーバーフィッティング（Curve Fitting）の兆候。
    *   N数（取引回数）が年間数回と極めて少なく、統計的有意性を持てない。

## 処置
*   `MonthEndFix.ex5`: 削除済み。
*   ソースコード: `mt5/strategies/_archive/MonthEndFix` に移動済み。

---
*Created by Antigravity*
