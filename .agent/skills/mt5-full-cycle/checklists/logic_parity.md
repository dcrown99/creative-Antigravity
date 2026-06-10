# ロジックパリティ チェックリスト

MQL5 実装前に、Python ロジックとの対応を 1 行ずつ確認する。

---

## データ参照の対応表

| Python (backtesting.py) | MQL5 | 意味 | 注意 |
|:---|:---|:---|:---|
| `self.data.Close[-1]` | `iClose(_Symbol, tf, 0)` | 現在足（未確定） | ⚠️ リペインティング |
| `self.data.Close[-2]` | `iClose(_Symbol, tf, 1)` | 1本前の確定足 | ✅ 安全 |
| `self.data.Close[-N]` | `iClose(_Symbol, tf, N-1)` | N本前 | インデックスが1ずれる |
| `self.data.High[-1]` | `iHigh(_Symbol, tf, 0)` | 現在足の高値 | |
| `self.data.Low[-1]` | `iLow(_Symbol, tf, 0)` | 現在足の安値 | |
| `pd.Series(c).shift(1)` | `iClose(_Symbol, tf, 1)` | 1本前の値 | shift の N = MQL の N |

---

## チェック項目

- [ ] **エントリー条件:** Python の条件式と MQL の `if` 文が完全一致するか
- [ ] **インデックスのズレ:** `[-N]` と `iXxx(N-1)` の対応は正しいか
- [ ] **確定足 vs 未確定足:** エントリー判断に `shift(0)` / `iClose(0)` を使っていないか
- [ ] **時間フィルター:** Python の `.hour` / `.minute` と MQL の `TimeLocal()` / `TimeGMT()` が同じ時間を指すか
- [ ] **DST (サマータイム):** GMT+2/+3 の切り替えが考慮されているか
- [ ] **ストップロス / テイクプロフィット:** pips 換算と Point 換算が一致するか
- [ ] **ロットサイズ計算:** Python の `cash * risk%` と MQL の `RiskManager` が同じ式か

---

## よくあるミスパターン

| ミス | 症状 | 対策 |
|:---|:---|:---|
| `shift(0)` を使ってエントリー判断 | Python は勝つが MT5 は負ける | `shift(1)` 以降を使う |
| Python は UTC、MQL はサーバー時間 | トレード時刻がズレる | GMT オフセットを明示的に変換 |
| `atr * 0.001` でSL計算 | SL が極端に小さい | USDJPY は `atr * 0.01` (3桁) |
| 週末バーを含めてバックテスト | 取引量ゼロの足でシグナル発生 | 土日除外フィルターを追加 |
