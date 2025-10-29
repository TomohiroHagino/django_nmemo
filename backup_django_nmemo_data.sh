#!/bin/bash
# django_nmemo_dataディレクトリを圧縮してタイムスタンプ付きzipファイルを作成するスクリプト

# スクリプトのディレクトリ（プロジェクトルート）を取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ソースディレクトリ
SOURCE_DIR="django_nmemo_data"

# ディレクトリの存在確認
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ エラー: $SOURCE_DIR ディレクトリが見つかりません"
    exit 1
fi

# タイムスタンプ生成（YYYYMMDD_HHMMSS形式）
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# zipファイル名（プロジェクトルートに作成）
ZIP_FILE="django_nmemo_data_backup_${TIMESTAMP}.zip"

# 圧縮実行
echo "📦 $SOURCE_DIR を圧縮中..."
zip -r "$ZIP_FILE" "$SOURCE_DIR" -x "*.DS_Store" -x "*__pycache__/*" -x "*.pyc"

# 結果確認
if [ $? -eq 0 ]; then
    # ファイルサイズを取得（MB単位）
    FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo "✅ 圧縮完了: $ZIP_FILE"
    echo "   サイズ: $FILE_SIZE"
    echo "   保存先: $SCRIPT_DIR/$ZIP_FILE"
else
    echo "❌ 圧縮に失敗しました"
    exit 1
fi
