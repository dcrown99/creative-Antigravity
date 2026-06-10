# Architecture Decision Records (ADR)

## ADR-001: モノレポの採用とUIの統一
* **日付:** 2025-11-30
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** プロジェクトは複数の独立したNext.jsアプリケーションで構成されており、UIコードの重複が発生していた。
* **決定:** **TurboRepo** を採用し、共有の **`packages/ui`** ライブラリ (Shadcn UI) を作成する。

## ADR-002: テスト戦略
* **日付:** 2025-11-30
* **ステータス:** 承認済み (Accepted)
* **決定:** ユニットテストには **Jest** を、E2Eテストには **Playwright** を使用する。

## ADR-003: レガシーの封じ込め
* **日付:** 2025-11-30
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `manga-downloader` はレガシーなWindowsバッチスクリプトに依存している。
* **決定:** これを厳密な近代化のスコープから除外する。

## ADR-004: インフラ戦略の調整 (ホストマウント)
* **日付:** 2025-11-30
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** 当初、Google DriveをマウントするためにDockerコンテナ内で `rclone` を実行しようとした。
* **問題:** Windows版Docker DesktopはFUSE/特権コンテナとの安定性が低く、マウントの失敗が多発した。
* **決定:**
    1.  Dockerからの `rclone` サービスを削除する。
    2.  ホストOS (Windows) 側でのGoogle Driveマウント (Google Drive Desktopなど) に依存する。
    3.  **Bind Mounts** を使用して、ホストのドライブパス (例: `G:/...`) をコンテナに直接渡す。
* **結果:**
    * (+) 安定性とIOパフォーマンスが劇的に向上した。
    * (-) `docker-compose.yml` が環境依存になる (ユーザーによる手動パス設定が必要)。

## ADR-005: Dockerマルチステージビルド
* **日付:** 2025-12-01
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** 変更のたびに依存関係を再インストールするため、Dockerビルドが遅かった。
* **決定:** すべてのNext.jsアプリケーション (`money-master`, `my-kindle`, `auto-clipper-web`) に **マルチステージビルド** (base, builder, runner) を実装する。
* **結果:**
    * (+) `node_modules` のキャッシュによりビルド時間が劇的に短縮された。
    * (+) 最終的なイメージサイズが縮小された (スタンドアロンモード)。

## ADR-006: Docker開発環境戦略
* **日付:** 2025-12-02
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** DockerでNext.jsアプリケーションを開発するにはホットリロード (HMR) とソースコードへのアクセスが必要だが、本番環境では最適化されたスタンドアロンビルドが必要である。
* **問題:** 本番用に最適化されたDockerfile (スタンドアロンモード) で開発用ボリュームをマウントすると、ボリュームマウントがビルド成果物を隠してしまい、`MODULE_NOT_FOUND` エラーが発生した。
* **決定:**
    1.  Dockerfileに `pnpm dev` を実行する特定の **`dev` ステージ** を追加する。
    2.  ローカル開発用サービスには `docker-compose.yml` で **`target: dev`** を使用する。
    3.  ソースコードのボリュームは `dev` ステージ/設定でのみマウントする。
* **結果:**
    * (+) Docker内でのホットリロード (HMR) が可能になった。
    * (+) ビルド成果物とソースマウントの競合を防止できた。
    * (+) 本番ビルドをクリーンかつ最適化された状態に保てる。

## ADR-007: AI Talkerアーキテクチャ刷新 (Project AETHER)
* **日付:** 2025-12-02
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `ai-talker` の初期プロトタイプは、エンゲージメントと堅牢なエラー処理が欠けていた。
* **決定:**
    1.  **状態管理:** **Zustand** ストア (`ConversationStore`) を採用し、UIとビジネスロジックを分離し、複雑な状態 (録音、処理、発話) をアトミックに管理する。
    2.  **空間UI (HUD):** 没入感を高めるため、従来のチャットリストから3Dアバターにオーバーレイするヘッドアップディスプレイ (HUD) に移行する。
    3.  **非同期分析パイプライン:** 会話AIの応答 (Gemini Pro) と文法分析 (Gemini Flash/Pro via JSON mode) を分離し、低遅延を確保しつつ教育的価値を提供する。
    4.  **防御的Hooks:** `useSpeechRecognition` に堅牢なクリーンアップとエラー処理を実装し、ゾンビプロセスを防止し、ブラウザの権限問題について明確なユーザーフィードバックを提供する。
* **結果:**
    * (+) ユーザー体験 (UX) と体感パフォーマンスが大幅に向上した。
    * (+) コードの保守性とテスト容易性が向上した。
    * (+) ネットワークやハードウェアの障害に対する堅牢性が向上した。

## ADR-008: 安定性のためのローカルデータマウント
* **日付:** 2025-12-02
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `ADR-004` ではGoogle Driveへのホストマウント (`G:/...`) を提案した。しかし、Docker Desktop (WSL2 backend) は、ディレクトリジャンクションを使用しても Google Drive File Stream のような仮想ドライブへのアクセスに失敗することがある。
* **決定:**
    1.  直接的な `G:` ドライブのマウントを断念する。
    2.  プロジェクトルート内の **ローカルデータディレクトリ** (`./data/manga`, `./data/clips`) を使用する。
    3.  ユーザーに必要なファイルをこれらのローカルディレクトリに同期/コピーすることを要求する。
* **結果:**
    * (+) コンテナからのファイルアクセスを保証できる (標準的なバインドマウント)。
    * (+) 仮想ドライブの切断による「ファイルが見つからない」エラーを排除できる。
    * (-) ユーザーによる手動のファイルコピー/同期が必要になる。

## ADR-009: 外部ドライブ (H:) の採用
* **日付:** 2025-12-02
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** ユーザーから、ローカルデータフォルダの代わりに `H:\Movie` と `H:\漫画` を使用したいという要望があった。`H:` は物理的な外部ドライブである。
* **問題:** Docker Desktop (WSL2) は外部ドライブを自動的にマウントしない。
* **決定:**
    1.  WSL内で `drvfs` を使用して `H:` ドライブを手動マウントする (`mount -t drvfs H: /mnt/h`)。
    2.  `docker-compose.yml` を更新し、`/mnt/h/Movie` と `/mnt/h/漫画` をバインドマウントする。
* **結果:**
    * (+) 外部ストレージ上の大規模なメディアライブラリに直接アクセス可能になる。
    * (-) WSLが再起動するたびに `H:` ドライブのマウントが必要になる (自動化しない限り)。

## ADR-010: ネットワーク統合 (App Network)
* **日付:** 2025-12-02
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `auto-clipper-worker` が `redis` に接続できず、`Name or service not known` エラーが発生していた。これは、一部のサービスがデフォルトネットワークに、他が `app-network` に配置されていたためである。
* **決定:**
    1.  すべてのアプリケーションサービス (`redis`, `auto-clipper`系, `money-master`, `market-watcher`, `my-kindle`, `ai-talker`, `voicevox`) を明示的に **`app-network`** に参加させる。
    2.  `docker-compose.yml` 内でネットワーク定義を統一する。
* **結果:**
    * (+) コンテナ間の名前解決と通信が正常化した。
    * (+) マイクロサービス間の接続トラブルを解消した。

## ADR-011: Node.jsサービスのOpenSSL 3.0標準化
* **日付:** 2025-12-03
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `money-master` (Prisma) で、OSのOpenSSLバージョンとPrismaが期待するバージョン (`debian-openssl-1.1.x`) の不整合により、`libssl.so.1.1` が見つからないエラーが発生した。
* **決定:**
    1.  すべてのNode.jsサービス (`money-master` 等) のベースイメージを **`node:20-slim` (Debian Bookworm)** に統一する。
    2.  Prismaの `binaryTargets` を **`debian-openssl-3.0.x`** に統一する。
    3.  レガシーな `openssl-1.1.x` への依存を排除する。
* **結果:**
    * (+) 最新のLTS OS (Debian 12) とセキュリティ標準 (OpenSSL 3.0) に準拠できた。
    * (+) Prismaのネイティブバイナリ互換性問題を恒久的に解決した。
    * (+) 将来的なメンテナンスコストを削減した。

## ADR-012: テスト基盤の標準化とカバレッジ要件
* **日付:** 2025-12-03
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** プロジェクトのテストカバレッジが0%であり、リグレッションバグのリスクが高かった。また、言語ごとにテストフレームワークが統一されていなかった。
* **決定:**
    1.  **フレームワークの統一:**
        *   TypeScript (Next.js): **Jest** + React Testing Library
        *   Python (FastAPI): **pytest** + pytest-cov
        *   E2E: **Playwright**
    2.  **カバレッジ要件:**
        *   全アプリケーションに対して **30%** の最低カバレッジ閾値を設定する。
        *   CIパイプラインで閾値未満の場合は警告または失敗とする。
    3.  **モック戦略:**
        *   外部依存（DB, API）は原則としてモック化し、ユニットテストの独立性と速度を確保する。
        *   Prismaは `jest-mock-extended` または手動モックを使用する。
    4.  **CI/CD統合:**
        *   GitHub Actions でプルリクエストごとに全テストを実行する。
        *   Codecov を使用してカバレッジレポートを可視化する。
* **結果:**
    *   (+) テスト実行時間が短縮され、開発サイクルが高速化した。
    *   (+) バグの早期発見が可能になった。
    *   (+) プロジェクトの品質スコアが向上した。

## ADR-013: Python Lintとコード品質の標準化
* **日付:** 2025-12-03
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** Pythonサービス（`auto-clipper-api`, `market-watcher`）で50以上のLintエラーがあり、コード品質と保守性に問題があった。
* **決定:**
    1.  **Lintツール:** すべてのPythonサービスに **Ruff** を採用する（高速かつ包括的）
    2.  **修正対象エラー:**
        *   E722: Bare `except` → `except Exception:` に統一
        *   E701: 単一行の複文を禁止し、複数行に分割
        *   B904: 例外の再raiseに `from e` を必須化（例外チェーン保持）
        *   F401/F841: 未使用のimport/変数を削除
        *   E402: importをファイル先頭に配置
        *   E501: 行長制限（120文字、プロンプト文字列は除外）
        *   W293: 空白行のホワイトスペースを禁止
    3.  **設定ファイル:** 各Pythonサービスに `pyproject.toml` または `ruff.toml` を配置
    4.  **CI統合:** `verify_gold_master.ps1` にRuff検証を追加し、全PRでLintチェックを必須化
* **結果:**
    *   (+) コードの可読性と保守性が大幅に向上
    *   (+) 例外ハンドリングが適切になり、デバッグが容易に
    *   (+) CI/CDパイプラインでコード品質を自動検証
    *   (+) 開発チーム全体でコーディング規約を統一


## ADR-014: Docker依存関係管理戦略 (Windows/WSL2)
* **日付:** 2025-12-04
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** Windows (NTFS) 上で Docker (Linux) コンテナを使用して開発を行っている。パッケージを追加するたびに `docker compose build --no-cache` (フルリビルド) が必要であり、開発効率を著しく低下させていた。
* **問題:**
    *   **Bind Mountの課題:** ホストの `node_modules` を直接コンテナにマウントすると、NTFSのI/Oパフォーマンス低下に加え、Windows用バイナリ (`.exe`等) がLinuxコンテナ内で実行できず (`Invalid Executable`)、アプリがクラッシュする。
    *   **Anonymous Volumeの課題:** コンテナ内の `node_modules` を永続化するために匿名ボリュームを使用しているが、これによりホスト側での `pnpm add` がコンテナに反映されず、リビルドが必要になる。
* **決定:**
    1.  **ハイブリッド・マウント戦略:**
        *   `node_modules` は引き続き **Anonymous Volume** として扱い、Linuxネイティブのパフォーマンスとバイナリ互換性を維持する。
        *   **`package.json`**, **`pnpm-lock.yaml`**, **`pnpm-workspace.yaml`** をホストからコンテナへ **Bind Mount** する。これにより、コンテナは常に最新の依存関係定義を参照できる。
    2.  **同期スクリプト (`repair_dependencies.ps1`):**
        *   コンテナをリビルドする代わりに、実行中のコンテナ内で `pnpm install` を実行するスクリプトを整備する。
        *   これにより、匿名ボリューム内の `node_modules` が、バインドマウントされた最新の `pnpm-lock.yaml` に同期される。
* **結果:**
    *   (+) パッケージ追加時のフルリビルドが不要になり、数分→数秒に短縮された。
    *   (+) Linuxネイティブのパフォーマンスとバイナリ互換性を維持できた。
    *   (+) `repair_dependencies.ps1` (または `sync_deps`) を実行するだけの「ワンクリック」体験を提供。

## ADR-015: CI E2Eテスト除外 (Standalone + SQLite)
* **日付:** 2025-12-04
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** GitHub Actions で Playwright E2E テストを実行しようとしたが、Next.js の `output: standalone` ビルドと SQLite (Prisma) の組み合わせで問題が発生した。
* **問題:**
    *   `next start` は `output: standalone` と互換性がない → `node .next/standalone/server.js` を使用する必要がある。
    *   standalone サーバーは `.next/standalone/apps/money-master/` から実行されるため、SQLite の相対パス (`file:./data/test.db`) が正しく解決されない。
    *   `Error code 14: Unable to open the database file` が発生。
* **決定:**
    1.  GitHub Actions から E2E テストを**除外**する。
    2.  E2E テストはローカル開発でのみ実行する (`pnpm test:e2e`)。
    3.  CI は Build → Lint → Type Check → Unit Tests → Python Tests の構成とする。
* **結果:**
    *   (+) CI パイプラインが安定して通過するようになった。
    *   (+) ユニットテスト（51%以上のカバレッジ）で品質を担保。
    *   (-) E2E テストの自動実行は手動またはローカルに依存する。
* **将来的な対応 (オプション):**
    *   PostgreSQL 等の外部 DB を使用した E2E 環境構築。
    *   Docker Compose で E2E テスト専用環境を構築。

## ADR-016: Docker Compose設定の分離 (base/dev/prod)
* **日付:** 2025-12-04
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** 単一の `docker-compose.yml` に全設定（開発用ボリューム、本番用設定、環境変数）が混在していた。環境切り替えが困難で、Windowsホスト固有のパス（`H:\漫画`等）がハードコードされていた。
* **決定:**
    1.  **Base設定 (`docker-compose.base.yml`):** 環境非依存の共通設定（サービス定義、ポート、ネットワーク）のみを記述。
    2.  **Dev設定 (`docker-compose.dev.yml`):** 開発環境固有のオーバーライド（`target: dev`、ホットリロード用ボリューム、Windows固有パス、`restart: always`）。
    3.  **Prod設定 (`docker-compose.prod.yml`):** 本番環境固有のオーバーライド（`target: prod`、永続化ボリューム、`restart: unless-stopped`）。
    4.  **スクリプト更新:** `redeploy_all.ps1`、`dev_manager.ps1` を複数ファイル対応に更新。
* **使用方法:**
    *   開発: `docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d`
    *   本番: `docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d`
* **結果:**
    *   (+) 環境別設定の明確な分離により保守性が向上。
    *   (+) 本番デプロイへの移行が容易になった。
    *   (+) 共通設定の一元管理が可能になった。
    *   (+) `dev_manager.ps1 -Prod` で本番モード切替が可能に。

## ADR-017: TimescaleDB と Quant Brain の導入
* **日付:** 2025-12-04
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** 金融市場分析機能を追加するため、時系列データを効率的に扱えるデータベースと分析エンジンが必要だった。
* **決定:**
    1.  **TimescaleDB:** PostgreSQL互換の時系列DBを新規インフラサービスとして追加。
        *   イメージ: `timescale/timescaledb:latest-pg14`
        *   ポート: `5432`
        *   ボリューム: `db_data` (永続化)
    2.  **Quant Brain サービス:** Python/FastAPI ベースの金融分析エンジンを新規作成。
        *   ポート: `8002` (`:8000` は `auto-clipper-api` が使用中)
        *   依存関係: `ccxt` (取引所API), `pandas`, `numpy`, `asyncpg`
        *   Poetry によるパッケージ管理
    3.  **アーキテクチャ更新:** 10コンテナ → 12コンテナ構成に拡張。
* **結果:**
    *   (+) 時系列データの効率的な格納・クエリが可能に。
    *   (+) 取引所APIとの連携基盤が整備された。
    *   (+) 既存サービスとのポート競合を回避。

## ADR-018: CI Python テストの簡素化
* **日付:** 2025-12-06
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** GitHub Actions で Python サービス (`auto-clipper-api`, `market-watcher`) のテストを実行しようとしたが、複数の問題が発生した。
* **問題:**
    1.  **ディスク容量不足:** `auto-clipper-api` の依存関係 (`torch`, `nvidia-cuda`, `pyannote.audio` 等) が合計 ~3GB 以上あり、GitHub Actions ランナーのディスク制限 (~14GB) を超過した。
    2.  **PYTHONPATH 問題:** `market-watcher` のテストで `src.analyst` モジュールが見つからないエラーが発生 (CI環境でのパス解決問題)。
    3.  **依存関係の連鎖:** テスト実行のために手動でパッケージを追加し続けるのは非効率的だった。
* **決定:**
    1.  **Python CI を簡素化:** `ruff check` (lint) のみを実行し、`pytest` は除外する。
    2.  **pytest はローカル実行:** 開発者は手元で `pytest` を実行してテストを検証する。
    3.  **`quant-brain` をフィルタ除外:** `turbo run lint/test` のフィルタに `--filter='!quant-brain'` を追加。
* **CIステップ (変更後):**
```yaml
- name: Lint Python Services
  run: |
    pip install ruff
    cd apps/auto-clipper-api && ruff check .
    cd ../market-watcher && ruff check .
```
* **結果:**
    *   (+) CIパイプラインがディスク容量制限内に収まるようになった。
    *   (+) Python コード品質は `ruff` による lint チェックで担保される。
    *   (-) Python テストの自動実行はローカルに依存する。
* **将来的な対応 (オプション):**
    *   Self-hosted runner (GPUあり) を導入し、フル依存関係でのテスト実行を可能にする。
    *   `requirements-ci.txt` を作成し、軽量な依存関係のみで実行可能なテストを分離する。

## ADR-019: auto-clipper-api 依存関係分離
* **日付:** 2025-12-06
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `auto-clipper-api` の依存関係に開発ツール (ruff, pytest) と本番依存が混在していた。また、`pyannote.audio` (~500MB) はすべての環境で必要ではない。
* **決定:**
    1.  **依存関係の分離:**
        *   `requirements.txt` から開発依存 (`ruff`, `pytest`, `pytest-cov`) を削除。
        *   `requirements-dev.txt` を新規作成し、開発依存を分離。
    2.  **pyannote.audio のオプション化:**
        *   `utils/transcriber.py` の `get_cached_pipeline()` に `ImportError` ハンドリングを追加。
        *   `pyannote.audio` がインストールされていない場合、話者分離をスキップし graceful degradation。
* **結果:**
    *   (+) Dockerイメージのビルド時間短縮（開発ツール除外）。
    *   (+) CI/軽量環境での依存関係問題を回避。
    *   (+) pyannote.audio 非依存の環境でもコア機能（文字起こし、動画処理）が動作。
    *   (-) 開発者は `pip install -r requirements-dev.txt` を使用する必要がある。

## ADR-020: AI開発プロセス改善 (TDD/Encoding)
* **日付:** 2025-12-29
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** AI (Antigravity) を使用した開発中に以下の問題が発生した。
    1.  **TDD不遵守:** テスト作成後、Red状態を確認せずに実装を進めてしまう。
    2.  **ファイル編集失敗:** CRLF/LF不一致で `replace_file_content` が失敗することがある。
* **決定:**
    1.  **TDD強化:** GEMINI.md に「MANDATORY: テストが失敗することを確認してから実装」ルールを追加。
    2.  **Encoding対処:** GEMINI.md に段階的対処手順を追加（範囲縮小→行単位確認→PowerShell直接編集）。
* **結果:**
    *   (+) TDDサイクルの遵守率が向上する。
    *   (+) ファイル編集失敗時の対処が明確になった。

## ADR-021: Funding Arbitrage 戦略の廃止
* **日付:** 2025-12-29
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** 低リスク収益源として Funding Rate アービトラージ (デルタニュートラル) を検討し、Phase 0 分析を行った。
* **分析結果:**
    *   Binance の直近1年の平均 Funding Rate から算出した期待年利は **約2.5%** (手数料控除後) であった。
    *   これはプロジェクトの目標基準 (最低 5%) を下回る。
    *   資金拘束とリスク (清算、API リスク) に対してリターンが見合わないと判断した。
* **決定:**
    1.  **Funding Arb 戦略を廃止する:** 関連するコード (`src/strategies/funding_arb.py`, `src/infrastructure/funding_client.py` 等) を削除する。
    2.  **Momentum 戦略にリソースを集中:** 期待年利 65% の Daily Momentum 戦略に資金と開発リソースを集中させる。
* **結果:**
    *   (+) コードベースが簡素化され、保守性が向上した。
    *   (+) より高収益な機会にリソースを配分できた。

## ADR-022: Node.js 22移行と価格取得フォールバック戦略
* **日付:** 2026-01-06
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** `yahoo-finance2` v3.11.x へのアップデート後、ライブラリが Node.js 22 を要求するようになった。また、Yahoo Finance API が IP 単位で積極的にレート制限 (429) を行うようになり、初回リクエストからブロックされるケースが増加した。
* **問題:**
    1.  Node.js 20 環境で `yahoo-finance2` v3.11.x を使用すると、crumb 認証が失敗し 429 エラーが発生する。
    2.  レートリミッターの 5 回リトライ (最大 ~5分) がページロードをブロックし、UX を著しく低下させた。
* **決定:**
    1.  **Dockerfile の Node.js を 20 → 22 にアップグレード:** `money-master` の Dockerfile で `node:22-slim` を使用する。
    2.  **レートリミッタの緩和:** `rate-limiter.ts` のデフォルト値を変更。
        *   `maxRetries`: 5 → 1
        *   `baseDelay`: 5000ms → 1000ms
        *   `maxDelay`: 60000ms → 3000ms
    3.  **フォールバック優先戦略:** API が失敗した場合は即座にキャッシュまたはデフォルト値にフォールバックし、ページロードをブロックしない。
* **結果:**
    *   (+) ページロード時間が ~5分 → ~1-2秒 に短縮された。
    *   (+) API エラーがあっても UI が正常に表示される。
    *   (-) Yahoo Finance API の制限が続く限り、価格データはキャッシュまたはデフォルト値に依存する。
* **将来的な対応:**
    *   代替 API (Alpha Vantage, Finnhub 等) への移行を検討。
    *   価格取得の成功/失敗を監視するアラートを追加。

## ADR-023: Python環境管理の `uv` への完全移行
* **日付:** 2026-02-20
* **ステータス:** 承認済み (Accepted)
* **コンテキスト:** プロジェクト内のPython環境で `Poetry` (`quant-brain`) と `pip + requirements.txt` (`market-watcher`, `auto-clipper`, `manga-downloader`) が混在しており、Dockerビルドの遅延や統一性の欠如が発生していた。
* **決定:**
    1.  **脱Poetry・脱pip:** 全Pythonプロジェクトに対して、Rust製の超高速パッケージマネージャ **`uv`** を採用する。
    2.  **PEP 621 (`pyproject.toml`) の標準化:** `requirements.txt` を廃止し、すべての依存定義を標準の `[project]` テーブルに集約する。
    3.  **Docker最適化:** 各コンテナへの `uv` キャッシュマウントと `uv sync --frozen` を用い、ビルド速度と再現性を極限まで高める。
* **結果:**
    *   (+) Dockerイメージのビルド時間とローカルのセットアップが劇的にローカル化/高速化された。
    *   (+) 開発チームにおける環境依存のトラブルが減少し、統一されたフロントエンドスクリプト (`uv run`) での一貫した実行が可能となった。
