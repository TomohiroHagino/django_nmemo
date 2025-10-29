# メモの順序変更機能

## 概要

メモの並び順を自由に変更できる機能を追加しました。ドラッグ&ドロップで他のメモの上半分または下半分に移動すると、その位置に配置されます。

## 実装内容

### 1. データベースの変更

`Page`モデルに`order`フィールドを追加しました:
- `order`: 並び順を管理する整数フィールド（デフォルト値: 0）
- 並び順は `order`, `created_at` の順でソートされます

### 2. マイグレーション

以下のコマンドでデータベースをマイグレーションする必要があります:

```bash
cd /Users/tomohirohagino/python3/django_nmemo_data
python manage.py migrate
```

**注意**: マイグレーション実行前に、Box上のデータベースファイルとそのディレクトリに書き込み権限があることを確認してください。

エラーが発生した場合:
```bash
# データベースファイルの権限を確認
ls -la ~/Library/CloudStorage/Box-Box/000_メインアカ50GB\ marspeoplehg@gmail.com/django_nmemo_data/db/

# 必要に応じて権限を変更
chmod 644 ~/Library/CloudStorage/Box-Box/000_メインアカ50GB\ marspeoplehg@gmail.com/django_nmemo_data/db/db.sqlite3
chmod 755 ~/Library/CloudStorage/Box-Box/000_メインアカ50GB\ marspeoplehg@gmail.com/django_nmemo_data/db/
```

### 3. フロントエンドの機能

- **ドラッグ&ドロップで並び替え**:
  - メモをドラッグして他のメモの上半分にホバー → その前に配置
  - メモをドラッグして他のメモの下半分にホバー → その後ろに配置
  - 青い線（ドロップインジケーター）で配置位置を視覚的に表示
  
- **同じ親の配下でのみ並び替え可能**:
  - 並び替えは同じ階層（同じ親を持つメモ同士）でのみ可能
  - 異なる親に移動する場合は、自動的にその親の配下に配置

### 4. API

新しいエンドポイント:
- `POST /page/<page_id>/reorder/`
  - パラメータ:
    - `target_page_id`: 基準となるメモのID
    - `position`: `'before'` または `'after'`
  - 機能: 指定したメモを基準メモの前または後ろに移動

## 使い方

1. 左側のメニューでメモをドラッグ開始
2. 他のメモの上半分または下半分にホバー
3. 青い線が表示され、配置される位置が確認できる
4. ドロップすると並び順が更新される

## 技術詳細

- **pageTree.js**: ドラッグ&ドロップのロジックを実装
  - `handleDragOver`: マウス位置に基づいて配置位置（before/after）を計算
  - `reorderPage`: 並び替えAPIを呼び出し
  - ドロップインジケーター: 青い線で視覚的フィードバック

- **views.py**: `page_reorder`ビューで並び替え処理を実装
  - 同じ親を持つメモを取得
  - 指定位置にメモを挿入
  - すべてのメモの`order`フィールドを更新（10単位で採番）


