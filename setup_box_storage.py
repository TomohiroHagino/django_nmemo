#!/usr/bin/env python
"""
Box ストレージのセットアップスクリプト
必要なディレクトリを作成します
"""
import os
from pathlib import Path

# Boxのパスを取得
BOX_PATH = os.getenv('BOX_PATH', os.path.expanduser('~/Box'))

# プロジェクトディレクトリ
PROJECT_DIR = Path(BOX_PATH) / 'django_nmemo_lite'

def setup_box_storage():
    """Boxストレージにプロジェクトディレクトリを作成"""
    
    print(f"Box ストレージパス: {BOX_PATH}")
    
    # Boxディレクトリの存在確認
    if not os.path.exists(BOX_PATH):
        print(f"❌ Boxディレクトリが見つかりません: {BOX_PATH}")
        print("\n以下のいずれかの方法で設定してください:")
        print("1. 環境変数を設定: export BOX_PATH=/path/to/your/Box")
        print("2. スクリプト内のパスを変更")
        return False
    
    print(f"✓ Boxディレクトリが見つかりました")
    
    # プロジェクトディレクトリを作成
    PROJECT_DIR.mkdir(exist_ok=True)
    print(f"✓ プロジェクトディレクトリ作成: {PROJECT_DIR}")
    
    # mediaディレクトリを作成
    media_dir = PROJECT_DIR / 'media' / 'uploads'
    media_dir.mkdir(parents=True, exist_ok=True)
    print(f"✓ メディアディレクトリ作成: {media_dir}")
    
    # データベースファイルのパスを表示
    db_path = PROJECT_DIR / 'db.sqlite3'
    print(f"\nデータベースの保存先: {db_path}")
    print(f"メディアファイルの保存先: {media_dir}")
    
    print("\n✅ セットアップ完了!")
    print("\n次のコマンドでマイグレーションを実行してください:")
    print("python manage.py migrate")
    
    return True

if __name__ == '__main__':
    setup_box_storage()


