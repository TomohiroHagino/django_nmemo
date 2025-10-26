"""
nmemo プロジェクトの URL 設定。

`urlpatterns` は URL をビューへルーティングします。詳細はこちら:
    https://docs.djangoproject.com/ja/5.2/topics/http/urls/

例:
関数ベースビュー
    1. インポートを追加:  from my_app import views
    2. urlpatterns に追加:  path('', views.home, name='home')
クラスベースビュー
    1. インポートを追加:  from other_app.views import Home
    2. urlpatterns に追加:  path('', Home.as_view(), name='home')
別の URLconf を取り込む
    1. include() をインポート: from django.urls import include, path
    2. urlpatterns に追加:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),   # 管理サイト
    path('', include('pages.urls')),   # pages アプリにルーティングを委譲
]

# 開発環境でメディアファイルを配信する
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
