"""
nmemo プロジェクトの WSGI 設定。

WSGI 呼び出し可能オブジェクトを、モジュールレベル変数 ``application`` として公開します。

このファイルの詳細は次を参照してください:
https://docs.djangoproject.com/ja/5.2/howto/deployment/wsgi/
"""

import os
from django.core.wsgi import get_wsgi_application

# 使用する設定モジュールを指定（未設定の場合のデフォルト）
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nmemo.settings')

# WSGI アプリケーションを取得（本番サーバー等から参照されるエントリポイント）
application = get_wsgi_application()