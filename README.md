# Nmemo Notionライクなメモアプリ

Djangoで構築された一人用のNotionライクなSPAメモアプリケーションです。
クラウドストレージを保存先として利用でき、保存時に自動でHTMLページとメディアファイルが保存先にエクスポートされます。

<table>
  <tr>
    <td><img alt="スクリーンショット 2025-10-26 20:18:00" src="https://github.com/user-attachments/assets/736a8082-b08b-41b8-b307-8cd28f78584b" width="100%"></td>
  </tr>
</table>

<table>
  <tr>
    <td><img alt="スクリーンショット 2025-10-26 21:19:44" src="https://github.com/user-attachments/assets/958cea5f-0449-468f-a02c-db51d4aa7a7d" width="100%"></td>
    <td><img alt="スクリーンショット 2025-10-26 21:19:44" src="https://github.com/user-attachments/assets/21c07c0e-3bb1-43a9-876c-30f0f9afd532"></td>
  </tr>
</table>


## 特徴

- **階層構造を持つページ管理**
  - ドラッグ&ドロップでページの並び替え・親子関係の変更
  - ページアイコンのカスタマイズ（絵文字）
- 子ページの作成と表示
- **リッチテキストエディタ対応**（Quill.js）
  - テキスト装飾（太字、斜体、下線、取り消し線）
  - 見出し、リスト、配色
  - **画像の挿入とアップロード**
  - 画像のリサイズ機能
  - リンクの挿入
- **クラウドストレージ対応**
  - データベースと画像をBox等のクラウドストレージに保存可能
  - 環境変数で保存先を柔軟に設定
- **エクスポート機能**
  - JSON形式でページと子ページを一括エクスポート
  - HTML形式で画像を埋め込んだスタンドアロンファイルを自動生成
- **Notion風の直感的なUI**
  - リサイズ可能なサイドバー（ドラッグで幅を調整）
  - インライン編集機能
  - リサイズ可能なモーダル

## 技術スタック

### バックエンド
- **Python 3.x**
- **Django 5.x** - Webフレームワーク
- **SQLite** - データベース
- **python-dotenv** - 環境変数管理

### フロントエンド
- **HTML5/CSS3**
- **JavaScript (ES6 Modules)** - モジュール化されたコード構造
- **Quill.js 1.3.6** - リッチテキストエディタ
- **Quill Image Resize Module** - 画像リサイズ機能

### アーキテクチャ
- **Domain-Driven Design (DDD)** - レイヤードアーキテクチャ
  - Domain Layer（ドメイン層）
  - Application Layer（アプリケーション層）
  - Infrastructure Layer（インフラ層）
  - Presentation Layer（プレゼンテーション層）

### 主要機能の技術
- **Drag and Drop API** - ページの並び替え、画像のドラッグ&ドロップ
- **LocalStorage API** - サイドバー幅の永続化
- **Fetch API** - 非同期通信（AJAX）
- **FormData API** - 画像アップロード
- **Base64 encoding** - HTMLエクスポート時の画像埋め込み
- **CSS Flexbox** - レスポンシブレイアウト

## セットアップ

1. 依存関係のインストール:
```bash
pip3 install django python-dotenv
```

2. 環境変数の設定（オプション）:

プロジェクトルートに `.env` ファイルを作成し、クラウドストレージのパスを指定できます：
```bash
# Box クラウドストレージのパスを指定する例
BOX_PATH="/Users/yourname/Library/CloudStorage/Box-Box/your-folder"
```

指定しない場合、デフォルトでローカルの `~/cloud_storage/box` に保存されます。

3. データベースのマイグレーション:
```bash
python manage.py migrate
```

## 使用方法

1. 開発サーバーの起動:
```bash
python manage.py runserver
```

2. ブラウザでアクセス:
```
http://127.0.0.1:8000/
```

3. 管理画面にアクセス（オプション）:

まず管理者ユーザーを作成します：
```bash
python manage.py createsuperuser
```

その後、ブラウザでアクセス：
```
http://127.0.0.1:8000/admin/
```

## プロジェクト構造（DDD アーキテクチャ）

```
django_nmemo_data/
├── nmemo/                      # プロジェクト設定
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── pages/                      # ページアプリケーション
│   ├── domain/                 # Domain Layer（ドメイン層）
│   │   ├── page_aggregate/     # ページ集約パッケージ
│   │   │   ├── aggregate.py    # PageAggregate（集約ルート）
│   │   │   ├── entities.py     # PageEntity（エンティティ）
│   │   │   ├── page_validator.py      # バリデーション
│   │   │   ├── page_hierarchy.py      # 階層操作
│   │   │   ├── page_converter.py      # 変換処理
│   │   │   ├── page_tree_builder.py   # ツリー構築
│   │   │   └── page_domain_service.py # ドメインサービス
│   │   └── repositories.py     # Repository Interface（抽象クラス）
│   ├── application/            # Application Layer（アプリケーション層）
│   │   ├── dto.py              # Data Transfer Objects
│   │   └── page_service/       # ページアプリケーションサービスパッケージ
│   │       ├── service.py      # PageApplicationService（メイン）
│   │       ├── page_query.py   # クエリ操作
│   │       ├── page_command.py # コマンド操作（作成・更新・削除）
│   │       ├── page_export.py  # エクスポート操作
│   │       ├── media_service.py        # メディアファイル操作
│   │       ├── html_generator.py       # HTML生成
│   │       └── dto_converter.py        # DTO/Entity変換
│   ├── infrastructure/         # Infrastructure Layer（インフラ層）
│   │   └── repositories.py     # Repository実装（Django ORM）
│   ├── views/                  # Presentation Layer（プレゼンテーション層）
│   │   ├── page_views.py       # ページCRUD操作
│   │   ├── page_operations.py  # ページ操作（移動、並び替え、アイコン）
│   │   ├── export_views.py     # エクスポート
│   │   ├── api_views.py        # API
│   │   ├── upload_views.py     # ファイルアップロード
│   │   └── utils.py            # 共通ユーティリティ
│   ├── models.py               # Django Model（Page）
│   ├── urls.py                 # URL設定
│   ├── admin.py                # 管理画面設定
│   ├── static/pages/           # 静的ファイル
│   │   ├── css/
│   │   │   └── index.css
│   │   └── js/
│   │       ├── main.js
│   │       ├── pageTree.js
│   │       ├── iconModal.js
│   │       ├── pageModal.js
│   │       ├── pageOperations.js
│   │       ├── quillEditor.js
│   │       ├── sidebarResize.js
│   │       └── utils.js
│   └── templates/              # テンプレート
│       └── pages/
│           ├── index.html
│           └── patial_tree_item.html
├── db.sqlite3                  # SQLiteデータベース
└── manage.py
```

### フロントエンド

```
## プロジェクト構造（静的ファイル：フロントエンド）

pages/static/pages/js/
├── main.js
├── pageTree.js                      # 各種ラッパー
├── responsive.js                    # ...
├── sidebarResize.js                 # ...
├── iconModal.js                     # ...
├── quillEditor.js                   # ...
├── pageModal.js                     # ...
├── pageOperations.js                # ...
├── api/                             # API呼び出しを集約
│   ├── client.js
│   └── pages.js
├── features/
│   ├── page-tree/
│   │   ├── index.js                 # initPageTreeDragDrop, toggleChildren, addPageToTree
│   │   ├── dnd.js                   # D&D本体（DOM移動 + API呼び出し）
│   │   └── dom.js                   # DOMユーティリティ
│   ├── responsive/
│   │   └── index.js                 # initResponsive（多重初期化防止）
│   ├── sidebar-resize/
│   │   └── index.js                 # initSidebarResize（多重初期化防止）
│   ├── icon-modal/
│   │   └── index.js                 # open/close/confirm アイコンモーダル
│   └── quill-editor/
│       ├── index.js
│       ├── ...
│       ├── ...
│       └── ...
└── shared/
    └── quill/
        └── insert.js                # 共通Quillヘルパ
```

### DDD レイヤー構造

#### 1. Domain Layer（ドメイン層）

**`page_aggregate`パッケージ** - ページ集約に関連するドメインロジック

- **`PageAggregate`**: 集約ルート（不変条件の保証、階層構造の管理）
- **`PageEntity`**: エンティティ（ビジネスロジックを含む）
- **`PageValidator`**: バリデーションロジック
- **`PageHierarchy`**: 階層構造の操作（子孫取得、循環参照チェック等）
- **`PageConverter`**: Entity/Aggregateとの変換処理
- **`PageTreeBuilder`**: フラットリストからツリー構造を構築
- **`PageDomainService`**: ドメインサービス（エンティティ横断的なロジック）

**`repositories.py`**: リポジトリのインターフェース定義

#### 2. Application Layer（アプリケーション層）

**`page_service`パッケージ** - ページ関連のアプリケーションサービス

- **`PageApplicationService`**: メインのアプリケーションサービス（各サービスのオーケストレーション）
- **`PageQueryService`**: クエリ操作（取得系）
- **`PageCommandService`**: コマンド操作（作成・更新・削除）
- **`PageExportService`**: エクスポート操作
- **`MediaService`**: メディアファイル操作（移動、削除、URL抽出）
- **`HtmlGenerator`**: HTML生成（Base64埋め込み）
- **`DtoConverter`**: DTOとEntity/Aggregateの変換

**`dto.py`**: データ転送オブジェクト（CreatePageDTO、UpdatePageDTO、PageDTO）

#### 3. Infrastructure Layer（インフラ層）

- **`PageRepository`**: リポジトリの実装（Django ORMを使用）
  - ModelとEntityの変換を担当

#### 4. Presentation Layer（プレゼンテーション層）

**`views`パッケージ** - ビュー

- **`page_views.py`**: ページCRUD操作（index, page_create, page_update, page_delete）
- **`page_operations.py`**: ページ操作（page_move, page_update_icon, page_reorder）
- **`export_views.py`**: エクスポート（export_page, export_page_html）
- **`api_views.py`**: API（api_page_detail）
- **`upload_views.py`**: ファイルアップロード（画像、動画、Excel、ZIP、Sketch、ICO）
- **`utils.py`**: 共通ユーティリティ（_get_service）

## 主な機能

### ページ管理
- ページの作成・編集・削除
- 階層構造（親子関係）の管理
- 子ページの一覧表示

### エクスポート機能
- **JSON形式**: 任意のページとすべての子ページを階層構造を保持した状態でエクスポート
- **HTML形式**: 画像をBase64エンコードで埋め込んだスタンドアロンHTMLファイルを自動生成
  - 保存時に自動的にページフォルダ内に生成
  - 画像が含まれていても単一ファイルで完結

### リッチテキスト機能
- **Quill.js** ベースのリッチテキストエディタ
- テキストの装飾（太字、斜体、下線など）
- 見出し、箇条書き、番号付きリスト
- テキストカラーと背景色
- 画像のドラッグ&ドロップアップロード（最大5MB）
- **画像のリサイズ機能**（Quill Image Resize Module使用）
  - 画像をクリックして選択
  - ハンドルでドラッグしてサイズ変更
  - Delete/Backspaceキーで削除
- 画像はページごとに `/media/uploads/page_{id}/` に保存

### UI
- Notionライクなデザイン
- 2カラムレイアウト（左：ツリー、右：コンテンツ）
  - サイドバーの幅をドラッグでリサイズ可能（設定は自動保存）
- ページツリー
  - ドラッグ&ドロップでページの並び替え
  - ドラッグ&ドロップで親子関係の変更
  - ページアイコン（絵文字）のカスタマイズ
- インライン編集機能
- リサイズ可能なモーダル
- レスポンシブ対応

### 画像管理
- ページごとに専用フォルダで画像を管理
- 削除された画像は自動的にクリーンアップ
- 一時フォルダ（`page_temp`）からの自動移動
- 孤立した画像ファイルの自動削除

## モデル設計

### Page Model（Django Model）
- `title`: ページタイトル
- `content`: ページコンテンツ（HTML形式）
- `icon`: ページアイコン（絵文字）
- `parent`: 親ページ（Foreign Key）
- `order`: 表示順序（同じ親内での並び順）
- `created_at`: 作成日時
- `updated_at`: 更新日時

### PageAggregate（集約ルート）
- ページとその子孫を1つの集約として管理
- 不変条件の保証（バリデーション、循環参照の防止）
- 階層構造の操作（`get_all_descendants()`, `collect_all_page_ids()`等）

### PageEntity（Domain Entity）
- ビジネスロジックを含むドメインエンティティ
- バリデーション機能（`validate()`）
- タイトル・コンテンツ更新ロジック
- 階層構造の操作（`add_child()`, `get_all_descendants()`）
- エクスポート用のディクショナリ変換（`to_dict()`）

### 依存関係の方向
```
Presentation Layer (views/)
    ↓ 依存
Application Layer (page_service/)
    ↓ 依存
Domain Layer (page_aggregate/)
    ↑ 実装
Infrastructure Layer (repositories.py)
```

Domain LayerはどのLayerにも依存せず、純粋なビジネスロジックのみを持ちます。

## テスト

テストを実行するには：

```bash
# すべてのテストを実行
python manage.py test

# pagesアプリのテストのみ実行
python manage.py test pages

# 詳細な出力で実行
python manage.py test pages --verbosity=2
```

## ライセンス

このプロジェクトは個人用途で作成されています。

