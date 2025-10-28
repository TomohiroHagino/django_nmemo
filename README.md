# Nmemo Notionライクなメモアプリ

Djangoで構築された一人用のNotionライクなSPAメモアプリケーションです。
クラウドストレージを保存先として利用でき、保存時に自動でHTMLページとメディアファイルが保存先にエクスポートされます。

<table>
  <tr>
    <td><img alt="スクリーンショット 2025-10-26 20:18:00" src="https://github.com/user-attachments/assets/5b6c3c67-07fa-4a2f-a7eb-3eb3f4c03e37" width="100%"></td>
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
django_nmemo_lite/
├── nmemo/                      # プロジェクト設定
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── pages/                      # ページアプリケーション
│   ├── domain/                 # Domain Layer（ドメイン層）
│   │   ├── entities.py         # PageEntity（ビジネスロジックを含む）
│   │   ├── repositories.py     # Repository Interface（抽象クラス）
│   │   └── services.py         # Domain Service（ドメインサービス）
│   ├── application/            # Application Layer（アプリケーション層）
│   │   ├── dto.py              # Data Transfer Objects
│   │   └── services.py         # Application Service（ユースケース）
│   ├── infrastructure/         # Infrastructure Layer（インフラ層）
│   │   └── repositories.py     # Repository実装（Django ORM）
│   ├── models.py               # Django Model（Page）
│   ├── views.py                # Presentation Layer（プレゼンテーション層）
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

### DDD レイヤー構造

#### 1. Domain Layer（ドメイン層）
- **PageEntity**: ビジネスロジックを含むエンティティ（バリデーション、階層構造の操作）
- **PageRepositoryInterface**: リポジトリのインターフェース定義
- **PageDomainService**: ドメインサービス（エンティティ横断的なロジック）

#### 2. Application Layer（アプリケーション層）
- **PageApplicationService**: ユースケースの実装
- **DTO**: データ転送オブジェクト（CreatePageDTO、UpdatePageDTO、PageDTO）

#### 3. Infrastructure Layer（インフラ層）
- **PageRepository**: リポジトリの実装（Django ORMを使用）
- ModelとEntityの変換を担当

#### 4. Presentation Layer（プレゼンテーション層）
- **Views**: アプリケーションサービスを呼び出すだけのシンプルなビュー
- テンプレートへのレンダリング

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
- 一時フォルダからの自動移動
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

### PageEntity（Domain Entity）
- ビジネスロジックを含むドメインエンティティ
- バリデーション機能（`validate()`）
- タイトル・コンテンツ更新ロジック
- 階層構造の操作（`add_child()`, `get_all_descendants()`）
- エクスポート用のディクショナリ変換（`to_dict()`）

### 依存関係の方向
```
Presentation Layer (views.py)
    ↓ 依存
Application Layer (services.py, dto.py)
    ↓ 依存
Domain Layer (entities.py, repositories.py, services.py)
    ↑ 実装
Infrastructure Layer (repositories.py)
```

Domain LayerはどのLayerにも依存せず、純粋なビジネスロジックのみを持ちます。

## ライセンス

このプロジェクトは個人用途で作成されています。

