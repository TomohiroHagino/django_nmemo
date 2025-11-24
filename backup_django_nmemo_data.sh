#!/bin/bash
# django_nmemo_dataディレクトリをGPG公開鍵暗号化で圧縮してタイムスタンプ付きファイルを作成するスクリプト
# 238MBごとに分割して保存

# スクリプトのディレクトリ（プロジェクトルート）を取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ソースディレクトリ
SOURCE_DIR="django_nmemo_data"

# GPG鍵IDを設定（自分のメールアドレスまたは鍵ID）
# スクリプト上部で変更してください
GPG_KEY_ID="${GPG_KEY_ID}"

# 分割サイズ（MB単位）
SPLIT_SIZE="238m"

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

# 一時zipファイルのベース名（分割される）
TEMP_ZIP_BASE="django_nmemo_data_backup_${TIMESTAMP}.zip"

# まずzipで分割圧縮（1.99GBごと）
echo "📦 $SOURCE_DIR を分割圧縮中（${SPLIT_SIZE}ごと）..."
zip -r -s "$SPLIT_SIZE" "$TEMP_ZIP_BASE" "$SOURCE_DIR" -x "*.DS_Store" -x "*__pycache__/*" -x "*.pyc"

if [ $? -ne 0 ]; then
    echo "❌ 圧縮に失敗しました"
    exit 1
fi

# 分割されたzipファイルを検出
ZIP_FILES=("$TEMP_ZIP_BASE"*)
TOTAL_FILES=${#ZIP_FILES[@]}

if [ $TOTAL_FILES -eq 0 ]; then
    echo "❌ 圧縮ファイルが見つかりません"
    exit 1
fi

echo "📦 分割ファイル数: $TOTAL_FILES"

# 各分割ファイルをGPG暗号化
ENCRYPTED_COUNT=0
for ZIP_FILE in "${ZIP_FILES[@]}"; do
    if [ -f "$ZIP_FILE" ]; then
        GPG_FILE="${ZIP_FILE}.gpg"
        echo "🔒 暗号化中: $(basename "$ZIP_FILE") -> $(basename "$GPG_FILE")"
        
        gpg --encrypt --recipient "$GPG_KEY_ID" --cipher-algo AES256 --compress-algo 1 "$ZIP_FILE"
        
        if [ $? -eq 0 ]; then
            # 暗号化成功後、元のzipファイルを削除
            rm "$ZIP_FILE"
            ENCRYPTED_COUNT=$((ENCRYPTED_COUNT + 1))
            
            # ファイルサイズを取得
            FILE_SIZE=$(du -h "$GPG_FILE" | cut -f1)
            echo "   ✅ 完了: $(basename "$GPG_FILE") (サイズ: $FILE_SIZE)"
        else
            echo "   ❌ 暗号化に失敗: $ZIP_FILE"
        fi
    fi
done

if [ $ENCRYPTED_COUNT -eq $TOTAL_FILES ]; then
    echo ""
    echo "✅ すべての分割ファイルの暗号化が完了しました"
    echo "   分割数: $ENCRYPTED_COUNT"
    echo "   保存先: $SCRIPT_DIR/${TEMP_ZIP_BASE}*.gpg"
    echo "   暗号化方式: AES-256 (GPG公開鍵暗号)"
    echo "   復号化: 秘密鍵でのみ可能"
    echo ""
    echo "📝 復号化方法:"
    echo "   # すべての分割ファイルを復号化"
    echo "   for file in ${TEMP_ZIP_BASE}*.gpg; do gpg -d \"\$file\" > \"\${file%.gpg}\"; done"
    echo "   # 分割zipを結合して展開"
    echo "   zip -F ${TEMP_ZIP_BASE} --out restored_backup.zip"
    echo "   unzip restored_backup.zip"
else
    echo "❌ 一部のファイルの暗号化に失敗しました（成功: $ENCRYPTED_COUNT / 合計: $TOTAL_FILES）"
    exit 1
fi