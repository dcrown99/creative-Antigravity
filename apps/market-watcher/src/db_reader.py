import json
import os


class PortfolioReader:
    def __init__(self, file_path):
        self.file_path = file_path

    def read(self):
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Portfolio file not found at {self.file_path}")

        try:
            with open(self.file_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise Exception(f"Failed to read portfolio: {str(e)}") from e
