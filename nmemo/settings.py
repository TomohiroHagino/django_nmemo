"""
nmemo プロジェクト用の Django 設定。

このファイルは 'django-admin startproject'（Django 5.2.7）で生成されました。

このファイルの詳細説明:
https://docs.djangoproject.com/en/5.2/topics/settings/

設定項目の完全な一覧と値:
https://docs.djangoproject.com/en/5.2/ref/settings/
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# プロジェクト内のパスを作成（例: BASE_DIR / 'subdir'）
BASE_DIR = Path(__file__).resolve().parent.parent

# .env ファイルから環境変数を読み込む
load_dotenv(BASE_DIR / '.env')

# Box のストレージパス（ローカルにマウントされた Box のディレクトリ）
# 環境変数があればそれを使用し、なければデフォルト（BASE_DIR/local_storage）を使う
BOX_PATH = os.getenv('BOX_PATH', str(BASE_DIR / 'local_storage'))


# 開発用クイックスタート設定（本番環境には不適切）
# 本番向けチェックリスト: https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# 【重要】本番環境では SECRET_KEY を外部に漏らさないこと
SECRET_KEY = os.getenv('SECRET_KEY', 'hoge')

# 【重要】本番で DEBUG=True のままにしないこと
DEBUG = True

# 許可するホスト名（本番では適切に設定すること）
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.100.3']


# アプリケーション定義
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'pages',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'nmemo.middleware.RequestLoggingMiddleware',  # カスタムミドルウェア
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ルート URL 設定モジュール
ROOT_URLCONF = 'nmemo.urls'

# テンプレート設定
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # 追加のテンプレートディレクトリ（必要に応じて設定）
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# WSGI アプリケーションエントリポイント
WSGI_APPLICATION = 'nmemo.wsgi.application'


# データベース
# ドキュメント: https://docs.djangoproject.com/en/5.2/ref/settings/#databases
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        # Box ストレージが存在する場合はその配下を使用し、なければローカルの db.sqlite3 を使用
        'NAME': Path(BOX_PATH) / 'django_nmemo_data' / 'db' / 'db.sqlite3' if os.path.exists(BOX_PATH) else BASE_DIR / 'db.sqlite3',
    }
}


# パスワードバリデーション
# ドキュメント: https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# 国際化（i18n）
# ドキュメント: https://docs.djangoproject.com/en/5.2/topics/i18n/
LANGUAGE_CODE = 'ja'

# タイムゾーン
TIME_ZONE = 'Asia/Tokyo'

USE_I18N = True

# タイムゾーン対応（True の場合はアウェアな日時を使用）
USE_TZ = True


# 静的ファイル（CSS, JavaScript, 画像など）
# ドキュメント: https://docs.djangoproject.com/en/5.2/howto/static-files/
STATIC_URL = 'static/'

# メディアファイル（ユーザーアップロード）
MEDIA_URL = '/media/'

# メディアファイルの保存先
# Box ストレージが使用可能ならそちらを、なければローカルの media ディレクトリを使用
if os.path.exists(BOX_PATH):
    MEDIA_ROOT = Path(BOX_PATH) / 'django_nmemo_data' / 'media'
else:
    MEDIA_ROOT = BASE_DIR / 'media'

# 既定の主キー型
# ドキュメント: https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ロギング設定（SQLクエリを標準出力に表示）
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '\033[1m\033[33m[SQL] %(message)s\033[0m',  # 太字、黄色
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
