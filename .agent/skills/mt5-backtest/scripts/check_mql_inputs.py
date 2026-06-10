"""
MQL5 Static Analysis: Unused Input Detector

Scans an .mq5 file for `input` variable definitions and checks if they are used
in the code body. Helps prevent "implemented parameter but forgot logic" bugs.

Usage:
    python check_mql_inputs.py <path_to_mq5>
"""
import re
import sys
import os

# Set output encoding to UTF-8 for Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def check_inputs(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Regex to find input definitions
    # Pattern: input <type> <Name> = <Value>; // Comment
    # We only care about <Name>
    # Note: 'input group' is not a variable.
    
    input_pattern = re.compile(r'input\s+(?!group\b)\w+\s+(\w+)\s*=')
    
    defined_inputs = input_pattern.findall(content)
    
    if not defined_inputs:
        print("No input parameters found.")
        sys.exit(0)

    unused_count = 0
    print(f"Checking {len(defined_inputs)} inputs in {os.path.basename(filepath)}...")

    # Remove comments to avoid false positives (simple approach)
    # Remove // comments
    code_no_comments = re.sub(r'//.*', '', content)
    # Remove /* */ comments (multiline)
    code_no_comments = re.sub(r'/\*.*?\*/', '', code_no_comments, flags=re.DOTALL)

    for name in defined_inputs:
        # Count occurrences of whole word in code (stripping comments helps)
        # We need to find usage OTHER than the definition.
        # Definition looks like "input type Name ="
        # Usage looks like "if (Name ...)" or "Function(Name)"
        
        # Simple heuristic: exact word match count
        matches = len(re.findall(r'\b' + re.escape(name) + r'\b', code_no_comments))
        
        # Count in original content to include definition line
        # If matches == 1, it's likely only the definition
        
        # Better approach: Find definition line index?
        # Just use the simple count. If it appears only once, it's definitely unused (only declaration).
        # But wait, declaration "input int Name = 1;" counts as 1.
        # So if count == 1, it is unused.
        
        if matches <= 1:
            print(f"⚠️  UNUSED INPUT: {name}")
            unused_count += 1

    if unused_count == 0:
        print("✅ All inputs are used.")
        sys.exit(0)
    else:
        print(f"❌ Found {unused_count} unused inputs!")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_mql_inputs.py <path_to_mq5>")
        sys.exit(1)
    
    check_inputs(sys.argv[1])
