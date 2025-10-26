"""
nmemo プロジェクトの ASGI 設定。

モジュールレベルの変数 ``application`` として ASGI 呼び出し可能オブジェクトを公開します。

このファイルの詳細は以下を参照してください:
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nmemo.settings')

application = get_asgi_application()
