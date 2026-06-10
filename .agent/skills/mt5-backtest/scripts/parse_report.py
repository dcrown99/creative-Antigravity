"""
MT5 Strategy Tester HTML Report Parser.

Parses MT5 backtest HTML reports (UTF-16LE encoded)
and outputs key metrics as JSON.

MT5 reports use a fixed positional row structure:
  Row pattern after settings section:
    - Net Profit row: profit | equity DD | balance DD
    - Max DD row: largest DD | DD% (equity) | DD% (balance)
    - PF row: PF | expected payoff | recovery%
    - Sharpe row: sharpe | factor | Z-score
    ...

Usage:
    python parse_report.py <report.html> [--python-pf <value>]
    python parse_report.py --validate <is_report.html> <oos_report.html>
"""
import re
import sys
import json
import os


def read_report(filepath: str) -> str:
    """Read MT5 HTML report handling various encodings."""
    for encoding in ['utf-16-le', 'utf-16', 'utf-8', 'shift_jis', 'cp932']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                content = f.read()
                if '<html' in content.lower() or '<table' in content.lower():
                    return content
        except (UnicodeDecodeError, UnicodeError):
            continue
    with open(filepath, 'rb') as f:
        return f.read().decode('utf-8', errors='ignore')


def extract_rows(html: str) -> list[list[str]]:
    """Extract all table rows with their bold values."""
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
    result = []
    for row in rows:
        values = re.findall(r'<b>([^<]+)</b>', row)
        if values:
            result.append(values)
    return result


def clean_number(s: str) -> float | None:
    """Convert MT5 formatted number to float. Handles '1 234' and '-1 156'."""
    s = s.strip()
    # Remove non-breaking spaces and regular spaces within numbers
    s = s.replace('\xa0', '').replace(' ', '')
    # Remove % and parenthetical
    s = re.sub(r'\(.*\)', '', s).strip().rstrip('%')
    try:
        return float(s)
    except ValueError:
        return None


def parse_report(filepath: str) -> dict:
    """Parse MT5 Strategy Tester report and return metrics dict."""
    html = read_report(filepath)
    rows = extract_rows(html)

    metrics = {
        'profit_factor': None,
        'total_net_profit': None,
        'total_trades': None,
        'win_rate': None,
        'max_drawdown_pct': None,
        'sharpe_ratio': None,
        'recovery_factor': None,
    }

    # MT5 results section structure (bold-row offsets from "100%"):
    #  +0: 100%
    #  +1: Bars | Ticks | Model Quality
    #  +2: Net Profit | 0 | Commission/Swap
    #  +3: Gross Profit | Equity DD abs (DD%) | Balance DD abs (DD%)
    #  +4: Gross Loss | DD% (abs) | DD% (abs)
    #  +5: PF | Expected Payoff | Recovery %
    #  +6: Sharpe | Recovery Factor | Z-Score
    #  +7: AHPR | Factor | MarginLevel
    #  +8: GHPR | Trades count
    #  +9: Total Trades (Short) | Won Short (%) | Lost Short (%)
    # +10: Total Trades (Long) | Won Long (%) | Lost Long (%)
    # +11: Max Win | Max Loss

    results_start = None
    for i, row in enumerate(rows):
        if len(row) == 1 and row[0].strip() == '100%':
            results_start = i
            break

    if results_start is None:
        for i, row in enumerate(rows):
            if len(row) == 3:
                v0 = clean_number(row[0])
                if v0 is not None and v0 > 10000:
                    results_start = i - 1
                    break

    if results_start is not None:
        # Net Profit (offset +2)
        idx = results_start + 2
        if idx < len(rows) and len(rows[idx]) >= 1:
            metrics['total_net_profit'] = clean_number(rows[idx][0])

        # DD% from offset +3 (Gross Profit | Equity DD (DD%) | Balance DD (DD%))
        idx = results_start + 3
        if idx < len(rows):
            for val in rows[idx][1:]:
                pct_match = re.search(r'\((\d+)%?\)', val)
                if pct_match:
                    metrics['max_drawdown_pct'] = float(pct_match.group(1))
                    break

        # Total Trades: scan rows +9 to +11 for pattern "N | N(x%) | N(y%)"
        for idx in range(results_start + 9, min(results_start + 12, len(rows))):
            if idx < len(rows) and len(rows[idx]) >= 3:
                total = clean_number(rows[idx][0])
                win_match = re.search(r'(\d+)\s*\((\d+\.?\d*)%\)', rows[idx][1])
                if total is not None and total < 100000 and win_match:
                    metrics['total_trades'] = int(total)
                    break

        # PF row (offset +5)
        idx = results_start + 5
        if idx < len(rows) and len(rows[idx]) >= 1:
            pf_val = clean_number(rows[idx][0])
            if pf_val is not None and 0 < pf_val < 100:  # sanity check
                metrics['profit_factor'] = pf_val

        # Sharpe / Recovery row (offset +6)
        idx = results_start + 6
        if idx < len(rows) and len(rows[idx]) >= 1:
            metrics['sharpe_ratio'] = clean_number(rows[idx][0])
            if len(rows[idx]) >= 2:
                rf = clean_number(rows[idx][1])
                if rf is not None:
                    metrics['recovery_factor'] = rf

        # Win rate: look for trade detail rows
        # Pattern: "N | W (W%) | L (L%)" for short/long trades
        # Usually at offset +9 or nearby
        # Win rate: look for trade detail rows
        # Pattern: "N | W (W%) | L (L%)" for short/long trades
        for idx in range(results_start + 9, min(results_start + 14, len(rows))):
            if idx < len(rows) and len(rows[idx]) >= 3:
                total = clean_number(rows[idx][0])
                win_match = re.search(r'(\d+)\s*\((\d+\.?\d*)%\)', rows[idx][1])
                if total is not None and win_match:
                    metrics['win_rate'] = float(win_match.group(2))
                    break

    # Fallback: try to find PF by scanning all rows for typical PF values
    if metrics['profit_factor'] is None:
        for row in rows:
            for val in row:
                v = clean_number(val)
                if v is not None and 0 < v < 50:
                    # Check if it looks like a PF (small float)
                    if '.' in val and v != 100.0:
                        # Could be PF, but too ambiguous without position
                        pass

    return metrics


def judge_parity(mt5_pf: float | None, python_pf: float) -> dict:
    """Judge parity between Python and MT5 results."""
    if mt5_pf is None:
        return {'verdict': 'ERROR', 'message': 'Could not extract MT5 PF from report'}

    deviation = abs(mt5_pf - python_pf) / python_pf * 100

    if mt5_pf < 1.0:
        verdict = 'REJECT'
        message = f'MT5 PF {mt5_pf:.2f} < 1.0 — strategy broken in MT5'
    elif deviation <= 20:
        verdict = 'PASS'
        message = f'PF deviation {deviation:.1f}% within tolerance (<=20%)'
    else:
        verdict = 'PARITY_CHECK'
        message = f'PF deviation {deviation:.1f}% exceeds 20% — check logic parity'

    return {
        'verdict': verdict,
        'mt5_pf': mt5_pf,
        'python_pf': python_pf,
        'deviation_pct': round(deviation, 1),
        'message': message,
    }


def judge_validate(is_pf: float | None, oos_pf: float | None) -> dict:
    """Judge IS/OOS validation results."""
    if is_pf is None or oos_pf is None:
        return {'verdict': 'ERROR', 'message': 'Could not extract PF from reports'}

    degradation = (is_pf - oos_pf) / is_pf * 100 if is_pf > 0 else 100

    if oos_pf < 1.0:
        verdict = 'REJECT'
        message = f'OOS PF {oos_pf:.2f} < 1.0 — strategy is losing out-of-sample'
    elif oos_pf < 1.3:
        verdict = 'OVERFIT'
        message = f'OOS PF {oos_pf:.2f} < 1.3 — likely overfitting (degradation {degradation:.0f}%)'
    elif degradation > 30:
        verdict = 'WARN'
        message = f'OOS PF {oos_pf:.2f} OK but degradation {degradation:.0f}% > 30%'
    else:
        verdict = 'PASS'
        message = f'IS {is_pf:.2f} -> OOS {oos_pf:.2f}, degradation {degradation:.0f}% — robust'

    return {
        'verdict': verdict,
        'is_pf': is_pf,
        'oos_pf': oos_pf,
        'degradation_pct': round(degradation, 1),
        'message': message,
    }


def compare_reports(base_metrics: dict, target_metrics: dict) -> dict:
    """Compare two reports to verify logic changes."""
    diffs = {}
    is_identical = True
    
    # Key metrics to compare
    keys = ['profit_factor', 'total_net_profit', 'total_trades', 'win_rate']
    
    for k in keys:
        v1 = base_metrics.get(k)
        v2 = target_metrics.get(k)
        
        if v1 is None and v2 is None:
            continue
            
        if v1 != v2:
            is_identical = False
            v1_val = v1 if v1 is not None else 0
            v2_val = v2 if v2 is not None else 0
            diff = v2_val - v1_val
            pct = (diff / abs(v1_val) * 100) if v1_val != 0 else 0
            diffs[k] = {
                'base': v1,
                'target': v2,
                'diff': diff,
                'diff_pct': round(pct, 2)
            }
    
    if is_identical:
        return {
            'verdict': 'no_change',
            'message': 'WARNING: Results are identical. Logic change may not be active.'
        }
    else:
        return {
            'verdict': 'changed',
            'diffs': diffs,
            'message': 'PASS: Logic change detected.'
        }


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_report.py <report.html> [--python-pf <value>]")
        print("       python parse_report.py --validate <is_report.html> <oos_report.html>")
        print("       python parse_report.py --compare <base_report.html> <target_report.html>")
        sys.exit(1)

    # Compare mode
    if sys.argv[1] == '--compare' and len(sys.argv) >= 4:
        base_metrics = parse_report(sys.argv[2])
        target_metrics = parse_report(sys.argv[3])
        comparison = compare_reports(base_metrics, target_metrics)
        result = {
            'mode': 'compare',
            'base': base_metrics,
            'target': target_metrics,
            'comparison': comparison,
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        # Exit 0 if changed, 1 if identical (warning)
        sys.exit(0 if comparison['verdict'] == 'changed' else 1)


    # Validate mode
    if sys.argv[1] == '--validate' and len(sys.argv) >= 4:
        is_metrics = parse_report(sys.argv[2])
        oos_metrics = parse_report(sys.argv[3])
        judgment = judge_validate(is_metrics.get('profit_factor'), oos_metrics.get('profit_factor'))
        result = {
            'mode': 'validate',
            'in_sample': is_metrics,
            'out_of_sample': oos_metrics,
            'judgment': judgment,
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(0 if judgment['verdict'] == 'PASS' else 1)

    # Parity mode (default)
    report_path = sys.argv[1]
    if not os.path.exists(report_path):
        print(json.dumps({'error': f'Report not found: {report_path}'}, indent=2))
        sys.exit(1)

    metrics = parse_report(report_path)

    python_pf = None
    if '--python-pf' in sys.argv:
        idx = sys.argv.index('--python-pf')
        if idx + 1 < len(sys.argv):
            try:
                python_pf = float(sys.argv[idx + 1])
            except ValueError:
                pass

    result = {'mode': 'parity', 'metrics': metrics}
    if python_pf is not None:
        result['judgment'] = judge_parity(metrics.get('profit_factor'), python_pf)

    print(json.dumps(result, indent=2, ensure_ascii=False))

    if 'judgment' in result:
        sys.exit(0 if result['judgment']['verdict'] == 'PASS' else 1)
    sys.exit(0)


if __name__ == '__main__':
    main()
