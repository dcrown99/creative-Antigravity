import time
import MetaTrader5 as mt5

def initialize_mt5(max_retries: int = 3, retry_delay: int = 5) -> bool:
    """
    Initialize MetaTrader5 connection with retry logic.
    Ensures that the terminal is connected to the broker.
    
    Args:
        max_retries (int): Maximum number of initialization attempts.
        retry_delay (int): Seconds to wait between attempts if disconnected.
        
    Returns:
        bool: True if MT5 is successfully initialized and connected to a broker.
    """
    for attempt in range(1, max_retries + 1):
        if not mt5.initialize():
            print(f"[MT5] Initialization failed (Attempt {attempt}/{max_retries}). Error: {mt5.last_error()}")
        else:
            # Check terminal connection status to broker
            terminal_info = mt5.terminal_info()
            if terminal_info is None:
                print(f"[MT5] Failed to get terminal info (Attempt {attempt}/{max_retries}).")
            elif not terminal_info.connected:
                print(f"[MT5] Terminal is running but NOT connected to the broker (Attempt {attempt}/{max_retries}).")
            else:
                # Successfully initialized AND connected
                return True
                
        if attempt < max_retries:
            print(f"[MT5] Retrying in {retry_delay} seconds...")
            mt5.shutdown()
            time.sleep(retry_delay)
            
    # Final failure
    print("[ERROR] Failed to establish a connected MetaTrader5 session after multiple attempts.")
    mt5.shutdown()
def resolve_symbol_name(base_symbol: str) -> str | None:
    """
    MT5ブローカー固有のサフィックスを含む正確なシンボル名を動的に解決する。
    例: 'EURJPY' -> 'EURJPY#' など
    
    Args:
        base_symbol (str): ベースとなるシンボル名 (例: 'EURJPY')
        
    Returns:
        str | None: MT5上で見つかった完全なシンボル名。見つからない場合は None。
    """
    # 完全に一致するものがあれば優先（サフィックスなし環境）
    symbol_info = mt5.symbol_info(base_symbol)
    if symbol_info is not None:
        return base_symbol
        
    # 前方一致で検索
    symbols = mt5.symbols_get()
    if symbols is None:
        print("[MT5] Error: Could not retrieve symbols list.")
        return None
        
    for s in symbols:
        if s.name.startswith(base_symbol):
            # 一般的に末尾に記号がつくパターンが多い ('#', '.a', '-x'など)
            # 完全に別の通貨ペア（例: EURJPY と EURJPY_micro 等）を誤判定しないよう、
            # ベース名との長さの差が小さいもの、または非アルファベットが続くものを優先したいが、
            # シンプルに最初に見つけた前方一致シンボルを返す。（必要に応じてロジックは強化する）
            print(f"[MT5] Resolved '{base_symbol}' -> '{s.name}'")
            return s.name
            
    print(f"[MT5] Warning: No symbol found matching '{base_symbol}'.")
    return None

def ensure_symbol_data_sync(symbol: str, timeout_sec: int = 5) -> str | None:
    """
    Ensure symbol is selected in Market Watch and wait for recent data to synchronize.
    This prevents the terminal from returning stale/cached prices for newly added symbols.
    
    Args:
        symbol (str): The MT5 base symbol name (e.g. 'EURJPY'). Will be automatically resolved.
        timeout_sec (int): Maximum seconds to wait for synchronization.
        
    Returns:
        str | None: The resolved exact symbol name if successfully synced, else None.
    """
    resolved_symbol = resolve_symbol_name(symbol)
    if resolved_symbol is None:
        return None
        
    symbol_info = mt5.symbol_info(resolved_symbol)
    if symbol_info is None:
        return None
        
    if not symbol_info.visible:
        if not mt5.symbol_select(resolved_symbol, True):
            return None
            
    start_time = time.time()
    while time.time() - start_time < timeout_sec:
        # Check if we have a valid recent tick
        tick = mt5.symbol_info_tick(resolved_symbol)
        if tick is not None and tick.time > 0:
            # Check if we can fetch at least 1 recent candle to ensure history pipeline is ready
            rates = mt5.copy_rates_from_pos(resolved_symbol, mt5.TIMEFRAME_M1, 0, 1)
            if rates is not None and len(rates) > 0:
                return resolved_symbol
                
        time.sleep(0.5)
        
    return None

