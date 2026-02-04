# OrderReport

> 受注入力 UI → FastAPI → Oracle DB → ReportLab で受注表 PDF を生成する PoC。（個人開発 / 転職活動向けポートフォリオ）

本リポジトリは **業務アプリの帳票出力パイプラインを検証するための途中成果物** です。2026年2月時点では個人開発としての検証フェーズで止まっており、実サービス化は未定です。

---

## 公開の目的（転職活動向け）
- エンドツーエンドの業務アプリ構成（UI → API → DB → PDF 出力）を一人でどこまで具体化できるかを示すため、選考中の企業さまにコード／設計を共有します。
- 設計判断や検証ログをそのまま残し、レビュー時に議論の材料となるようドキュメントを整備しています。
- プライベートリポジトリで開発していた内容を、機密情報を除いたうえでポートフォリオとして編集しました。動作よりも構成・実装の読みやすさを重視しています。

## 未完成であること / 利用上の注意
- Oracle の各種 View（需要先/商品マスタ等）は社内システム由来のため、スキーマやデータは同梱していません。`oracledb` 接続先を用意できないと実行できません。
- 認証・認可、入力バリデーション強化、エラーハンドリングは未着手です。PoC のため例外処理やテストコードも限定的です。
- 画面と API、PDF 出力の整合性確認を目的としており、パフォーマンス・可用性・セキュリティ要件は検討途中です。
- コード／ドキュメントは転職活動での閲覧を想定しており、商用利用や再配布はお控えください。

---

## このリポジトリで検証していること
- 受注入力 UI（静的 HTML/JS）から API へデータを受け渡し、PDF をレスポンスとして返す一連の流れ
- 需要先/得意先/商品/メーカといったマスタ検索 API の設計と Oracle ビューとの接続
- 単価決定ロジック（需商 → 得商 → 定価）を FastAPI から Oracle に渡して解決する方法
- ReportLab + 既存テンプレ PDF の合成による帳票レイアウト調整と JSON ベースの座標管理

---

## システム構成（現状）
```
[Browser (static/index.html)]
        │ fetch
        ▼
[FastAPI app.main]
        │ oracledb
        ▼
[Oracle Views (得意先/需要先/商品...)]
        │
        └─> reportlab + assets/{templates,layouts} → PDF Bytes
```
- API ルートは `/api` 配下に集約。`/` は静的 UI をそのまま返す。
- Oracle Instant Client 23c を Windows ローカルに配置済み（`C:\oracle\instantclient_23_8`）。

---

## 主なディレクトリ / ファイル
| パス | 役割 |
| --- | --- |
| `app/main.py` | FastAPI エントリ。静的ファイル公開、`/api/health`、`/api/orders/pdf_v2` を提供。 |
| `app/routes/*.py` | マスタ検索 (`customers`, `shipto`, `makers`, `products`)、単価解決 (`pricing`) の各エンドポイント。 |
| `app/pdf.py` | レイアウト JSON を読み、ReportLab でテキストレイヤーを描画後、テンプレ PDF と合成。 |
| `app/pricing.py` | Oracle ビューに対する SQL（需商→得商→定価）で売上／仕入単価を解決。 |
| `app/db.py` | Oracle 接続。環境変数 `ORACLE_USER/ORACLE_PASSWORD/ORACLE_DSN` を使用。 |
| `static/*` | ブラウザ UI（`index.html`、検索ポップアップ、`static/js/order/*.js` など）。 |
| `assets/fonts/IPAexGothic.ttf` | PDF 描画用フォント（IPAex）。未配置の場合は起動時に例外。 |
| `assets/layouts/default.jsonc` | 帳票レイアウト定義（座標/フォント/ページ設定）。 |
| `assets/templates/受注表レイアウト.pdf` | 既存帳票テンプレート。ReportLab の描画結果と合成する。 |
| `test.pdf` | サンプル出力イメージ。 |

---

## 実装済みフロー
- 得意先／需要先／メーカ／商品検索 UI。入力フィールドからポップアップを開き、検索結果を反映。
- 単価解決 API を各明細確定時に呼び出し、単価区分と単価を UI に表示。
- 行単位の数量・金額計算と、PDF 発行ボタン（`/api/orders/pdf_v2`）への POST。
- PDF 生成時に、欠損した仕入先名は Oracle から補完（`_fetch_supplier_names`）。

---

## セットアップ手順
### 1. Python 環境
```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```
- 想定バージョン: Python 3.11 以上。
- 主要ライブラリ: FastAPI, Uvicorn, Pydantic v2, oracledb, ReportLab, pypdf, python-dotenv。

### 2. Oracle Instant Client
- `app/db.py` が `oracledb.init_oracle_client(lib_dir=r"C:\\oracle\\instantclient_23_8")` を実行するため、該当パスに Instant Client を配置する。

### 3. 環境変数（`.env` 推奨）
| 変数 | 用途 | サンプル |
| --- | --- | --- |
| `ORACLE_USER` | Oracle 接続ユーザー | `BO_ITI` |
| `ORACLE_PASSWORD` | Oracle パスワード | `BO_ITI` |
| `ORACLE_DSN` | `host:port/service` 形式 | `192.168.14.172:1521/BO` |

`.env` をルートに置けば `python-dotenv` が自動で読み込む。

### 4. アプリ起動
```powershell
uvicorn app.main:app --reload --port 9000
```
- ブラウザで `http://localhost:9000/` を開くと受注入力 UI。
- `http://localhost:9000/static/index.html` も直接アクセス可。

---

## API エンドポイント一覧
| Method | Path | 概要 |
| --- | --- | --- |
| GET | `/api/health` | 疎通確認。`{"ok": true}` を返す。 |
| POST | `/api/orders/pdf_v2` | 受注ヘッダ + 明細リストを受け取り、PDF (application/pdf) を返却。`OrderRequestV2` でバリデーション。 |
| POST | `/api/pricing/resolve` | 単価決定。`tcode/jcode/scode/irank` を入力し、区分・売上単価・仕入単価・仕入先を返す。 |
| GET | `/api/customers/search?q=` | 得意先名の部分一致（100件まで）。 |
| GET | `/api/customers/{tcode}` | 得意先コードから名称取得。 |
| GET | `/api/shipto/search?q=` | 需要先名の部分一致（得意先ビューを再利用）。 |
| GET | `/api/shipto/{jcode}` | 需要先コード→名称。 |
| GET | `/api/makers/search?q=` | メーカ名（社内用）で部分一致。 |
| GET | `/api/makers/{maker_cd}` | コード→メーカ名。 |
| GET | `/api/products/search?...` | `maker_cd/maker_name/maker_part_no/product_name/spec` を組合せ検索。最大 2000 件。 |
| GET | `/api/products/units?product_cd=` | 単位・入数リスト。 |
| GET | `/api/products/{scode}` | 商品コードからメーカ／品番／仕入先等を取得。 |

- `app/schemas.py` に Pydantic モデル定義。v1/v2 の共存を意識した構成。
- マスタ系 API は Oracle の View (`*マスタV`) を参照する。`UTL_I18N.TRANSLITERATE` を利用して全角半角差を吸収。

---

## フロントエンド（static/）
- `static/index.html` がメイン画面。`static/js/ui_main.js` と `static/js/order/*.js` で状態管理を分割。
- モーダル検索画面（`customer_search.html` など）は `<iframe>` ではなく `window.open` で開く想定。
- `static/js/version.js` で `window.APP_VERSION` を設定し、キャッシュ対策として API URL にクエリを付与。
- CSS は `static/css/style.css`（縦長表 + グリッド UI）。

---

## PDF レイアウトとテンプレート
1. レイアウト定義 (`assets/layouts/default.jsonc`)
   - `template_pdf_name`: `assets/templates` 内の PDF ファイル名。
   - `header`, `item_fields`: `pos: [x_mm, y_mm]` とオプション `font_size`。
   - `items_per_page`, `block_top_y_mm`, `block_pitch_mm`, `item_name_max_width_mm` でページング・行送りを制御。
   - JSONC 形式で // コメント可。読み込み時に `_strip_jsonc_comments` で正規化。
2. フォント (`assets/fonts/IPAexGothic.ttf`)
   - 日本語描画のために必須。未配置だと `build_order_pdf_bytes` が `FileNotFoundError` を投げる。
3. テンプレート (`assets/templates/受注表レイアウト.pdf`)
   - 背景として使用。ReportLab で描画したテキストレイヤーを `pypdf` で合成。

サンプル出力は `test.pdf` に保存済み。`/api/orders/pdf_v2` のレスポンスをダウンロードすると同等の PDF が得られる。

---

## レイアウト設計ツール（β / 別ワークスペース予定）
ブラウザで背景画像の上にフィールドを配置して JSON を書き出す簡易ツールを試作中 (`layout_tool_app`).
1. テンプレ PDF を画像化して読み込み。
2. グリッド上をクリックして座標取得 → JSON へ反映。
3. 生成した JSON を `assets/layouts/<template_id>.jsonc` として保存し `template_id` を API から指定する構成を想定。
※ ツール本体はまだ本リポジトリに含めていません（別ワークスペースで管理中）。

---

## 価格決定ロジックのメモ
- `decide_pricing` は 1 クエリで需商・得商・定価を優先順位付きで取得。
- 優先順位: 需商 (`prio=1`) → 得商 (`prio=2`) → 定価 (`prio=3`)。
- いずれもヒットしない場合は `source="未設定"`、単価は 0 で返す。
- ログにはリクエストパラメータと結果を INFO で記録し、レスポンス分析をしやすくしている。

---

## 今後の課題 / TODO
- [ ] PDF 出力のテンプレート拡張（複数帳票・多段ヘッダ対応）。
- [ ] 画面入力のバリデーション・エラーメッセージ整備。
- [ ] 認証・認可（画面/ API 共通）と操作ログの設計。
- [ ] 非同期での PDF 生成や S3 保存等のサーバー側アーキテクチャ検討。
- [ ] レイアウト設計ツールの整備とバンドル。

---

## 補足
完成度よりも **「どのような構成を想定し、どこまで検証したか」** を残すことを目的としています。設計メモやラフなコードも含まれているため、利用時は必ず内容を確認してください。
