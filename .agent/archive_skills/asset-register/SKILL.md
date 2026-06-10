---
name: asset-register
category: DevOps & DevOpsCore
description: 資産データ登録時の計算確認手順
---

# 資産データ登録スキル

MCP SQLite で資産データを登録・更新する際、計算ミスを防ぐためのチェックリスト。

---

## 適用条件

以下のいずれかに該当する場合、このスキルを適用:

1. **新規資産登録**: MCP SQLite で INSERT
2. **資産データ更新**: MCP SQLite で UPDATE (quantity, avgCost, currentPrice)
3. **ユーザー提供データ**: 評価額/取得価格/損益がユーザーから提供された場合

---

## 計算式

### 投資信託 (1万口あたり)
```
評価額 = currentPrice × quantity / 10000
取得金額 = avgCost × quantity / 10000
損益 = 評価額 - 取得金額
```

### 株式 (1株あたり)
```
評価額 = currentPrice × quantity
取得金額 = avgCost × quantity
損益 = 評価額 - 取得金額
```

---

## 登録手順

### Step 1: ユーザー提供値を確認
| 項目 | ユーザー提供値 |
|:---|---:|
| 評価額 | ¥XXX |
| 取得価格 | ¥XXX |
| 損益 | ¥XXX |

### Step 2: 必要な値を逆算
**投信の場合** (評価額と取得価格から):
```
quantity = 評価額 × 10000 / currentPrice
avgCost = 取得価格 × 10000 / quantity
```

### Step 3: 登録後に確認クエリ
```sql
SELECT name, quantity, avgCost, currentPrice,
       (currentPrice * quantity / 10000) as valuation,
       (avgCost * quantity / 10000) as cost,
       (currentPrice * quantity / 10000) - (avgCost * quantity / 10000) as profit
FROM Asset 
WHERE name = '銘柄名'
```

### Step 4: 差異チェック
| 項目 | ユーザー値 | 計算値 | 差異 |
|:---|---:|---:|---:|
| 評価額 | ¥XXX | ¥XXX | X% |
| 取得価格 | ¥XXX | ¥XXX | X% |
| 損益 | ¥XXX | ¥XXX | X% |

**許容差異**: 1% 以内

---

## チェックリスト

登録前に確認:

- [ ] 資産タイプ (株式 vs 投信) を確認
- [ ] 計算式の選択 (1株 vs 1万口) が正しい
- [ ] quantity, avgCost, currentPrice を設定
- [ ] 登録後のクエリで計算値を確認
- [ ] ユーザー提供値との差異が 1% 以内

---

## よくあるミス

| ミス | 原因 | 対処 |
|:---|:---|:---|
| 評価額が10倍ずれ | 口数の桁違い | 逆算して quantity を確認 |
| 損益がマイナスなのにプラス表示 | avgCost と currentPrice が逆 | 値を入れ替え |
| 小数点以下が反映されない | Decimal型の精度不足 | step="any" で入力 |
