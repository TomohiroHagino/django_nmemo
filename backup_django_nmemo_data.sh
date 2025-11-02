#!/bin/bash
# django_nmemo_dataディレクトリをGPG公開鍵暗号化で圧縮してタイムスタンプ付きファイルを作成するスクリプト

# スクリプトのディレクトリ（プロジェクトルート）を取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ソースディレクトリ
SOURCE_DIR="django_nmemo_data"

# GPG鍵IDを設定（自分のメールアドレスまたは鍵ID）
# スクリプト上部で変更してください
GPG_KEY_ID="A63CDAB3FA3F1FE60A77CFE683E6730CD08D273A"

# ディレクトリの存在確認
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ エラー: $SOURCE_DIR ディレクトリが見つかりません"
    exit 1
fi

# gpgコマンドの存在確認
if ! command -v gpg &> /dev/null; then
    echo "❌ エラー: gpgコマンドが見つかりません"
    echo "   Homebrewでインストール: brew install gnupg"
    exit 1
fi

# GPG鍵の存在確認
if ! gpg --list-keys "$GPG_KEY_ID" &> /dev/null; then
    echo "❌ エラー: GPG鍵が見つかりません: $GPG_KEY_ID"
    echo ""
    echo "📝 設定方法:"
    echo "   1. このスクリプトの GPG_KEY_ID を自分のメールアドレスまたは鍵IDに変更"
    echo "   2. GPG鍵が存在することを確認: gpg --list-keys"
    echo "   3. 鍵がない場合は作成: gpg --full-generate-key"
    echo ""
    echo "   利用可能な鍵一覧:"
    gpg --list-keys 2>/dev/null | grep -E "^(pub|uid)" || echo "   鍵が見つかりません"
    exit 1
fi

# タイムスタンプ生成（YYYYMMDD_HHMMSS形式）
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 一時zipファイルと最終GPGファイル
TEMP_ZIP="django_nmemo_data_backup_${TIMESTAMP}.zip"
GPG_FILE="${TEMP_ZIP}.gpg"

# まずzipで圧縮
echo "📦 $SOURCE_DIR を圧縮中..."
zip -r "$TEMP_ZIP" "$SOURCE_DIR" -x "*.DS_Store" -x "*__pycache__/*" -x "*.pyc"

if [ $? -ne 0 ]; then
    echo "❌ 圧縮に失敗しました"
    exit 1
fi

# GPG公開鍵で暗号化（パスワード入力不要、秘密鍵でのみ復号化可能）
echo "🔒 公開鍵 ($GPG_KEY_ID) で暗号化中..."
gpg --encrypt --recipient "$GPG_KEY_ID" --cipher-algo AES256 --compress-algo 1 "$TEMP_ZIP"

if [ $? -eq 0 ]; then
    # 一時zipファイルを削除
    rm "$TEMP_ZIP"
    
    # ファイルサイズを取得
    FILE_SIZE=$(du -h "$GPG_FILE" | cut -f1)
    echo "✅ 暗号化完了: $GPG_FILE"
    echo "   サイズ: $FILE_SIZE"
    echo "   保存先: $SCRIPT_DIR/$GPG_FILE"
    echo "   暗号化方式: AES-256 (GPG公開鍵暗号)"
    echo "   復号化: 秘密鍵でのみ可能"
    echo ""
    echo "📝 復号化方法:"
    echo "   gpg -d $GPG_FILE > restored_backup.zip"
    echo "   unzip restored_backup.zip"
else
    echo "❌ 暗号化に失敗しました"
    rm -f "$TEMP_ZIP"
    exit 1
fi