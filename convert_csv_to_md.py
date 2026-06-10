import csv
from datetime import datetime
from collections import defaultdict

# Read CSV
transactions = []
with open('RbTorihiki-20251221123940.csv', 'r', encoding='shift_jis', errors='replace') as f:
    reader = csv.reader(f)
    header = next(reader)  # Skip header
    for row in reader:
        if len(row) >= 4:
            try:
                date_str = row[0].strip()
                amount = int(row[1].replace(',', ''))
                balance = int(row[2].replace(',', ''))
                description = row[3].strip() if len(row) > 3 else ''
                year = date_str[:4] if len(date_str) >= 4 else 'unknown'
                transactions.append({
                    'date': date_str,
                    'year': year,
                    'amount': amount,
                    'balance': balance,
                    'description': description
                })
            except:
                pass

# Format date helper
def format_date(d):
    try:
        return f'{d[:4]}/{d[4:6]}/{d[6:8]}'
    except:
        return d

# Group by year
by_year = defaultdict(list)
for t in transactions:
    by_year[t['year']].append(t)

# Generate Markdown for each year
for year, year_transactions in sorted(by_year.items()):
    income = sum(t['amount'] for t in year_transactions if t['amount'] > 0)
    expense = sum(t['amount'] for t in year_transactions if t['amount'] < 0)
    
    md = f'''# 楽天銀行 取引履歴 ({year}年)

> エクスポート日: 2024年12月21日
> 対象年: {year}年
> 取引件数: {len(year_transactions)} 件

## 概要

| 項目 | 値 |
|------|-----|
| 期間開始 | {format_date(year_transactions[-1]['date'])} |
| 期間終了 | {format_date(year_transactions[0]['date'])} |
| 期間開始残高 | ¥{year_transactions[-1]['balance']:,} |
| 期間終了残高 | ¥{year_transactions[0]['balance']:,} |

## 年間集計

| カテゴリ | 金額 |
|----------|------:|
| 入金合計 | ¥{income:,} |
| 出金合計 | ¥{expense:,} |
| 収支 | ¥{income + expense:,} |

## 取引履歴

| 日付 | 金額 | 残高 | 内容 |
|------|-----:|-----:|------|
'''

    for t in year_transactions:
        amount_str = f'+¥{t["amount"]:,}' if t['amount'] > 0 else f'¥{t["amount"]:,}'
        md += f'| {format_date(t["date"])} | {amount_str} | ¥{t["balance"]:,} | {t["description"][:50]} |\n'

    filename = f'RbTorihiki_{year}.md'
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(md)
    
    print(f'Created: {filename} ({len(year_transactions)} transactions)')

print(f'\nTotal: {len(transactions)} transactions split into {len(by_year)} files')
