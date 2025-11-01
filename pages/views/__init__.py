"""ページ用ビュー（プレゼンテーション層）"""

# ページCRUD
from .page_views import index, page_create, page_update, page_delete

# ページ操作
from .page_operations import page_move, page_update_icon, page_reorder

# エクスポート
from .export_views import export_page_html

# API
from .api_views import api_page_detail

# ファイルアップロード
from .upload_views import (
    upload_image,
    upload_video,
    upload_excel,
    upload_zip,
    upload_sketch,
    upload_ico
)

__all__ = [
    # ページCRUD
    'index',
    'page_create',
    'page_update',
    'page_delete',
    # ページ操作
    'page_move',
    'page_update_icon',
    'page_reorder',
    # エクスポート
    'export_page_html',
    # API
    'api_page_detail',
    # ファイルアップロード
    'upload_image',
    'upload_video',
    'upload_excel',
    'upload_zip',
    'upload_sketch',
    'upload_ico',
]
