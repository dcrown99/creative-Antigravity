import os
import shutil
from config import FINAL_OUTPUT_DIR

def save_to_storage(source_path: str, target_filename: str) -> str:
    """
    config.py で定義された FINAL_OUTPUT_DIR にファイルをコピーする。
    target_filename が指定された場合、その名前で保存する。
    成功したら保存先のパスを返し、設定がない/失敗した場合は None を返す。
    """
    final_output_dir = FINAL_OUTPUT_DIR
    
    # ディレクトリが存在しない場合は作成を試みる
    if final_output_dir and not os.path.exists(final_output_dir):
        try:
            os.makedirs(final_output_dir, exist_ok=True)
        except Exception as e:
            print(f"Warning: Could not create output directory {final_output_dir}: {e}")
            return None

    if not final_output_dir:
        print("Error: FINAL_OUTPUT_DIR is not set.")
        return None

    target_path = os.path.join(final_output_dir, target_filename)
    
    try:
        shutil.copy2(source_path, target_path)
        print(f"✅ Saved to storage: {target_path}")
        return target_path
    except Exception as e:
        print(f"❌ Failed to save to storage: {e}")
        return None