#!/usr/bin/env python3
"""
SSOT vs ドキュメント整合性チェッカー

source_of_truth.yaml の情報と各ドキュメントの整合性を検証する。
不一致があればエラーコード1で終了。
"""

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("[ERROR] PyYAML is not installed. Run: pip install pyyaml")
    sys.exit(1)


def load_ssot() -> dict:
    """SSOTファイルを読み込む"""
    ssot_path = Path(__file__).parent.parent / "docs" / "source_of_truth.yaml"
    if not ssot_path.exists():
        print(f"[ERROR] SSOT file not found: {ssot_path}")
        sys.exit(1)
    return yaml.safe_load(ssot_path.read_text(encoding="utf-8"))


def check_container_count(ssot: dict) -> list[str]:
    """コンテナ数の整合性チェック"""
    errors = []
    expected = ssot["containers"]["total"]
    target_docs = ["ARCHITECTURE.md"]
    
    for doc_name in target_docs:
        doc_path = Path(__file__).parent.parent / doc_name
        if not doc_path.exists():
            errors.append(f"{doc_name}: File not found")
            continue
        
        content = doc_path.read_text(encoding="utf-8")
        # "13個" のパターンをチェック
        if f"{expected}" not in content:
            errors.append(f"{doc_name}: Container count '{expected}' not found")
    
    return errors


def check_port_numbers(ssot: dict) -> list[str]:
    """ポート番号の整合性チェック"""
    errors = []
    
    # 全ポート検証対象 (ARCHITECTURE.md)
    full_check_docs = ["ARCHITECTURE.md"]
    # フロントエンドのみ検証対象 (README.md)
    frontend_only_docs = ["README.md"]
    
    # 全サービスのポート番号を収集
    all_ports = []
    frontend_ports = []
    for group_name, group in ssot["services"].items():
        for svc in group:
            if svc.get("port"):
                all_ports.append((svc["name"], svc["port"]))
                if group_name == "frontend":
                    frontend_ports.append((svc["name"], svc["port"]))
    
    # 全ポートチェック
    for doc_name in full_check_docs:
        doc_path = Path(__file__).parent.parent / doc_name
        if not doc_path.exists():
            continue
        content = doc_path.read_text(encoding="utf-8")
        for name, port in all_ports:
            if str(port) not in content:
                errors.append(f"{doc_name}: Port {port} ({name}) not found")
    
    # フロントエンドのみチェック
    for doc_name in frontend_only_docs:
        doc_path = Path(__file__).parent.parent / doc_name
        if not doc_path.exists():
            continue
        content = doc_path.read_text(encoding="utf-8")
        for name, port in frontend_ports:
            if str(port) not in content:
                errors.append(f"{doc_name}: Port {port} ({name}) not found")
    
    return errors


def main() -> int:
    """メイン処理"""
    print("[INFO] Starting document consistency check...")
    
    ssot = load_ssot()
    all_errors = []
    
    # コンテナ数チェック
    print("  - Checking container count...")
    all_errors.extend(check_container_count(ssot))
    
    # ポート番号チェック
    print("  - Checking port numbers...")
    all_errors.extend(check_port_numbers(ssot))
    
    if all_errors:
        print("\n[FAIL] Consistency errors found:")
        for err in all_errors:
            print(f"   - {err}")
        return 1
    
    print("\n[PASS] All checks passed!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
