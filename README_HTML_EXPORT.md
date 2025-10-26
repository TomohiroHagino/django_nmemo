# HTMLエクスポート機能

## 概要

メモをスタンドアロンのHTMLファイルとしてエクスポートできる機能を追加しました。画像はBase64形式で埋め込まれるため、HTMLファイル1つで完結します。

## 機能

### 1. HTMLエクスポート

- **単一ファイル**: 画像を含むすべてのコンテンツが1つのHTMLファイルに含まれます
- **スタンドアロン**: インターネット接続不要で、ブラウザで開くだけで閲覧可能
- **画像埋め込み**: すべての画像がBase64形式でHTMLに埋め込まれます
- **美しいスタイル**: レスポンシブデザインで読みやすいレイアウト

### 2. エクスポート方法

#### 方法1: 右側のコンテンツエリアから

1. ページを開く
2. 「📄 HTML」ボタンをクリック
3. `{ページタイトル}.html` がダウンロードされる

#### 方法2: 左側のツリーから

1. ページにマウスオーバー
2. 「📄」ボタンをクリック（青いボタン）
3. `{ページタイトル}.html` がダウンロードされる

### 3. 従来のJSONエクスポート

- **📥 JSON** ボタン: 親階層から一括でのエクスポート（子ページを含む）
- JSON形式でページツリー全体を保存
- 再インポート機能の実装に使用可能

## 技術詳細

### HTMLファイルの構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>ページタイトル</title>
    <style>
        /* レスポンシブデザインのCSS */
    </style>
</head>
<body>
    <h1>ページタイトル</h1>
    <div class="meta">
        <p>作成日時: YYYY年MM月DD日 HH:MM</p>
        <p>更新日時: YYYY年MM月DD日 HH:MM</p>
    </div>
    <div class="content">
        <!-- ページコンテンツ（画像はBase64埋め込み） -->
    </div>
</body>
</html>
```

### 画像のBase64変換

1. コンテンツ内の全`<img>`タグを検出
2. ローカルメディアURL（`/media/uploads/...`）を特定
3. 画像ファイルを読み込み
4. Base64エンコード
5. Data URLに変換（`data:image/png;base64,...`）
6. HTMLに埋め込み

### 対応画像形式

- JPEG/JPG
- PNG
- GIF
- WebP
- SVG

### ファイル名のサニタイズ

以下の文字は自動的にアンダースコア（`_`）に置き換えられます：
- `< > : " / \ | ? *`

## 使用例

### エクスポートされたHTMLファイル

```
議事録_2025年10月.html
```

このファイルをダブルクリックするだけで、ブラウザで開いて閲覧できます。

### 共有

- メールに添付して送信
- クラウドストレージにアップロード
- USBメモリで持ち運び
- バックアップとしてアーカイブ

## エンドポイント

- **HTMLエクスポート**: `GET /page/<page_id>/export/html/`
- **JSONエクスポート**: `GET /page/<page_id>/export/`

## 実装ファイル

- `pages/application/services.py`: `export_page_as_html()` メソッド
- `pages/views.py`: `export_page_html()` ビュー
- `pages/urls.py`: URL設定
- `pages/templates/pages/patial_tree_item.html`: ツリーアイテムのボタン
- `pages/static/pages/js/pageOperations.js`: コンテンツエリアのボタン

## 今後の改善案

- [ ] 複数ページを1つのHTMLにまとめてエクスポート
- [ ] PDFエクスポート機能
- [ ] Markdownエクスポート
- [ ] カスタムCSSテンプレート
- [ ] 目次の自動生成
- [ ] 印刷用スタイル


