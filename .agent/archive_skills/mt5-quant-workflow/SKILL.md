---
description: MT5 Quant Strategy Development Workflow (Python Analysis -> MQL5 Port -> CLI Verification)
---

# MT5 Quant Strategy Workflow

This skill guides you through the "Python-First" development cycle for MT5 strategies.
Instead of slow MQL5 backtesting, use Python for rapid prototyping and optimization, then port only the winning logic to MQL5.

## 1. Prerequisites
- **Python**: `pandas`, `backtesting`, `matplotlib` installed.
- **MT5**: Terminal installed and logged in (Demo account OK).
- **Data**: M1/H1 CSV data exported from MT5 (use `ExportToCSV.mq5`).

## 2. Workflow Steps

### Step 1: Rapid Prototyping (Python)
Use `backtesting.py` to test trade logic in seconds.
1.  Copy `scripts/analysis_template.py` to `analysis/analyze_{strategy_name}.py`.
2.  Implement your entry/exit logic in the `next()` method or vectorized logic.
3.  Run the script to find optimal parameters (e.g., Entry Time, Stop Loss).
4.  **Goal**: Confirm PF > 1.3 and stable equity curve before writing MQL5 code.

### Step 2: MQL5 Implementation
Port the winning Python logic to MQL5.
1.  Create `mt5/Experts/{StrategyName}.mq5`.
2.  Implement `OnTick()` using the exact logic verified in Python.
3.  Use `TimeFilter.mqh` for time-based logic (essential for JST/GMT handling).
4.  Use `RiskManager.mqh` for position sizing.

### Step 3: Verification (MT5 CLI)
Verify that the MQL5 implementation matches Python results.
1.  Configure `mt5/tests/{strategy}_test.ini` (see template below).
2.  Run `scripts/run_backtest.ps1` (generic runner).
3.  Check the HTML report for PF and Trade Count alignment.

## 3. Templates

### Python Analysis Template
See `inputs/analysis_template.py`.

### MT5 CLI Runner
See `inputs/run_backtest.ps1` (Generic PowerShell script).

### MT5 Config Template (ini)
```ini
[Tester]
Expert=Experts\{StrategyName}\{StrategyName}.mq5
Symbol=USDJPY
Period=M1
Model=1  ; 0=EveryTick, 1=1MinuteOHLC, 2=OpenPrices, 3=MathCalc, 4=EveryTickReal
FromDate=2023.01.01
ToDate=2025.12.31
Deposit=1000000
Currency=JPY
Leverage=500
Report=tests/{strategy}_report
ReplaceReport=1
ShutdownTerminal=1
```
