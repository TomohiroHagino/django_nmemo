"""ビューの共通ユーティリティ"""

from ..application.page_service import PageApplicationService
from ..infrastructure.repositories import PageRepository


def _get_service() -> PageApplicationService:
    """アプリケーションサービスのインスタンスを取得"""
    repository = PageRepository()
    return PageApplicationService(repository)
