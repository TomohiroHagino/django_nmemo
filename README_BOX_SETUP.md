# Box ストレージの設定方法

Boxクラウドストレージをデータベースとメディアファイルの保存先として使用する方法

## 📦 前提条件

- Boxのデスクトップアプリがインストールされている
- Boxフォルダがローカルにマウントされている

## 🔧 設定手順

### 1. Boxのパスを確認

まず、あなたのBoxフォルダのパスを確認してください：

**macOS の場合:**
```bash
# 通常は以下のパスのいずれか
~/Box
~/Library/CloudStorage/Box-Box
```

**Windows の場合:**
```
C:\Users\[ユーザー名]\Box
```

### 2. 環境変数を設定（オプション）

デフォルトのパス (`~/Box`) と異なる場合、環境変数を設定：

**macOS/Linux:**
```bash
export BOX_PATH="/path/to/your/Box"
```

**Windows:**
```cmd
set BOX_PATH=C:\Users\YourName\Box
```

または `.bashrc` / `.zshrc` に追加：
```bash
echo 'export BOX_PATH="/path/to/your/Box"' >> ~/.zshrc
source ~/.zshrc
```

### 3. セットアップスクリプトを実行

```bash
python setup_box_storage.py
```

これにより以下のディレクトリが作成されます：
```
~/Box/django_nmemo_lite/
├── db.sqlite3          # データベース（マイグレーション後）
└── media/
    └── uploads/        # アップロードされた画像
```

### 4. マイグレーションを実行

```bash
python manage.py migrate
```

## 📁 現在の設定

`nmemo/settings.py` で以下のように設定されています：

```python
# Box ストレージのパス
BOX_PATH = os.getenv('BOX_PATH', os.path.expanduser('~/Box'))

# データベース
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': Path(BOX_PATH) / 'django_nmemo_lite' / 'db.sqlite3' 
               if os.path.exists(BOX_PATH) 
               else BASE_DIR / 'db.sqlite3',
    }
}

# メディアファイル
if os.path.exists(BOX_PATH):
    MEDIA_ROOT = Path(BOX_PATH) / 'django_nmemo_lite' / 'media'
else:
    MEDIA_ROOT = BASE_DIR / 'media'
```

## ✅ メリット

- **自動バックアップ**: データがBoxに保存されるため自動的にクラウド同期
- **複数デバイス**: 複数のPCからアクセス可能
- **安全性**: Boxのバージョン管理機能でデータ復元可能

## ⚠️ 注意事項

1. **同期の待機**: ファイルが完全に同期されるまで待つ
2. **同時アクセス禁止**: 複数デバイスから同時にアクセスしない
3. **ネットワーク**: オフライン時はアクセスできない場合がある

## 🔄 ローカルストレージに戻す

Boxを使わない場合、環境変数を削除するか、`settings.py`を編集：

```bash
unset BOX_PATH
```

## 📋 確認コマンド

現在の設定を確認：

```bash
python manage.py shell
>>> from django.conf import settings
>>> print("Database:", settings.DATABASES['default']['NAME'])
>>> print("Media:", settings.MEDIA_ROOT)
```

## 🆘 トラブルシューティング

### Boxディレクトリが見つからない

```bash
# Boxの場所を探す
find ~ -name "Box" -type d 2>/dev/null | head -5

# または
ls -la ~/Library/CloudStorage/ | grep Box
```

### データベースファイルが作成されない

1. Boxフォルダの書き込み権限を確認
2. `setup_box_storage.py` を実行
3. マイグレーションを再実行

### 既存データの移行

```bash
# 既存のデータベースをBoxにコピー
cp db.sqlite3 ~/Box/django_nmemo_lite/

# 既存のメディアファイルをBoxにコピー
cp -r media ~/Box/django_nmemo_lite/
```


