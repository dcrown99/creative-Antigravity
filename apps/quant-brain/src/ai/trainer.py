import os
import logging
import glob
import pickle
import polars as pl
import lightgbm as lgb
import orjson
from datetime import datetime
from src.domain.features import FeatureFactory

logger = logging.getLogger("trainer")

class ModelTrainer:
    def __init__(self, data_dir="/app/data/raw", model_dir="/app/models"):
        self.data_dir = data_dir
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)

    def load_and_prep_data(self) -> pl.DataFrame:
        """Parquetファイルを読み込み、特徴量生成とラベル付けを行う"""
        files = glob.glob(f"{self.data_dir}/*.parquet")
        if not files:
            raise FileNotFoundError("No training data found! Run backfill first.")
        
        logger.info(f"📚 Found {len(files)} files. Loading safely...")
        
        dfs = []
        for f in files:
            try:
                # 個別に読み込んで検証
                d = pl.read_parquet(f)
                # 必須カラムのみに絞る (OHLCV + ts)
                required_cols = ["ts", "open", "high", "low", "close", "volume"]
                if len(d) > 0 and all(c in d.columns for c in required_cols):
                    # 型を統一 (Float64)
                    d = d.select([
                        pl.col("ts").cast(pl.Int64),
                        pl.col("open").cast(pl.Float64),
                        pl.col("high").cast(pl.Float64),
                        pl.col("low").cast(pl.Float64),
                        pl.col("close").cast(pl.Float64),
                        pl.col("volume").cast(pl.Float64)
                    ])
                    dfs.append(d)
            except Exception as e:
                logger.warning(f"⚠️ Skipping bad file {f}: {e}")
                
        if not dfs:
            raise ValueError("No valid data loaded!")
            
        df = pl.concat(dfs)
        
        # 1. 特徴量生成 (FeatureFactory利用)
        df = FeatureFactory.add_technical_indicators(df)
        
        # 2. ターゲット生成 (1分後の価格が今より高いか？ 1=Up, 0=Down)
        # shift(-1) は「1行未来」を見る
        df = df.with_columns([
            (pl.col("close").shift(-1) > pl.col("close")).cast(pl.Int8).alias("target")
        ]).drop_nulls()
        
        return df

    def _load_best_params(self) -> dict:
        """最適化されたパラメータがあれば読み込む"""
        config_path = "/app/config/best_params.json"
        default_params = {
            'objective': 'binary',
            'metric': 'auc',
            'boosting_type': 'gbdt',
            'learning_rate': 0.05,
            'verbose': -1
        }
        
        if os.path.exists(config_path):
            try:
                with open(config_path, "rb") as f:
                    optimized = orjson.loads(f.read())
                    # LightGBMに関係ないパラメータ(threshold等)を除外
                    lgb_params = {k: v for k, v in optimized.items() if not k.startswith("threshold")}
                    logger.info("🧬 Loaded optimized hyperparameters")
                    return {**default_params, **lgb_params}
            except Exception as e:
                logger.warning(f"⚠️ Failed to load config: {e}")
        
        return default_params

    def train(self):
        """学習実行パイプライン"""
        df = self.load_and_prep_data()
        logger.info(f"🧠 Training with {len(df)} samples...")
        
        # 時系列スプリット (最後の20%をテスト用にする)
        split_idx = int(len(df) * 0.8)
        
        # Polars -> Pandas/Numpy (LightGBM用)
        # 特徴量カラムの選定 (targetやtimestamp以外)
        feature_cols = [c for c in df.columns if c not in ["ts", "target", "datetime"]]
        
        X_train = df[:split_idx].select(feature_cols).to_numpy()
        y_train = df[:split_idx].select("target").to_numpy().flatten()
        
        X_test = df[split_idx:].select(feature_cols).to_numpy()
        y_test = df[split_idx:].select("target").to_numpy().flatten()
        
        # LightGBM データセット
        train_data = lgb.Dataset(X_train, label=y_train, feature_name=feature_cols)
        test_data = lgb.Dataset(X_test, label=y_test, reference=train_data)
        
        # パラメータロード
        params = self._load_best_params()
        
        # 学習
        model = lgb.train(
            params,
            train_data,
            num_boost_round=1000,
            valid_sets=[test_data],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50),
                lgb.log_evaluation(100)
            ]
        )
        
        # 保存
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        model_path = f"{self.model_dir}/lgbm_{timestamp}.pkl"
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
            
        # 最新モデルへのシンボリックリンク的なコピー
        with open(f"{self.model_dir}/lgbm_latest.pkl", 'wb') as f:
            pickle.dump(model, f)
            
        logger.info(f"✅ Model saved to {model_path}")
        return model
