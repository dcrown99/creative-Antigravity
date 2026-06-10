---
description: MT5 Expert Advisor (EA) Development Workflow (Analysis -> Build -> Deploy -> Verify)
---

# MT5 EA Development Skill

This skill documents the standardized workflow for developing, testing, and deploying MT5 Expert Advisors, based on the **NakaneMaster** project.

## 1. Strategy Analysis (Python First)
Before writing MQL5 code, validate the logic using Python and historical M1 data.

-   **Data Source**: `data/USDJPY_M1.csv` (JST adjusted manually if needed).
-   **Template**:
    ```python
    import pandas as pd
    from datetime import timedelta
    
    def load_data(filepath):
        df = pd.read_csv(filepath)
        df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
        df.set_index('Datetime', inplace=True)
        # Shift to JST (Example: +7 hours for Winter Time CSVs)
        df.index = df.index + timedelta(hours=7) 
        return df

    # Implement strategy logic (e.g. loops or vectorization)
    ```
-   **Goal**: Calculate PF, Win Rate, and Trade Count. **Target PF > 1.2**.

## 2. Implementation (MQL5)
-   **Location**: `mt5/Experts/<EAName>.mq5`
-   **Versioning**: Always update `#property version "X.XX"` when making logic changes.
-   **Inputs**: Use `input` variables for all parameters (Risk, SL, TP, Times).

## 3. Compilation (CLI)
Use `metaeditor64.exe` from the command line to catch errors quickly.

```powershell
& "C:\Program Files\XM Trading MT5\metaeditor64.exe" /compile:"C:\path\to\YourEA.mq5" /log:"C:\path\to\compile.log"
Get-Content "C:\path\to\compile.log"
```

## 4. Deployment (Force Deploy)
MT5 often fails to reload compiled EAs if the file timestamp isn't "new enough" or if it's cached.
**ALWAYS** use `force_deploy.ps1` to deploy.

-   **Script**: `mt5/force_deploy.ps1`
-   **Action**:
    1.  Finds the target MT5 AppData folder (via `TerminalInfoString` logic or hardcoded path).
    2.  **Deletes** the old `.ex5` file.
    3.  **Copies** the new `.ex5` file.
    4.  Prints the deployment path.

```powershell
./mt5/force_deploy.ps1
```

## 5. Verification
-   **Backtest**: Run Strategy Tester in MT5.
-   **Logs**: Use `read_logs.ps1` to verify internal errors or logic flow.
    ```powershell
    ./mt5/read_logs.ps1
    ```
-   **Checklist**:
    -   [ ] PF matches Python prediction? (within reason)
    -   [ ] Trade count matches?
    -   [ ] Execution times correct (JST/Server Time)?

## 6. Directory Structure
```text
/mt5
  /Experts/       # Source code (.mq5)
  /Include/       # Headers (.mqh)
  /Scripts/       # Utility scripts
  force_deploy.ps1
  read_logs.ps1
/analysis         # Python scripts
/data             # Historical CSVs
```
