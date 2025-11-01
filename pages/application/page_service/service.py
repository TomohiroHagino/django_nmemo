"""ページアプリケーションサービス（メイン）"""

from typing import Optional, List

from ...domain.repositories import PageRepositoryInterface
from ...domain.page_aggregate import PageDomainService
from ..dto import CreatePageDTO, UpdatePageDTO, PageDTO
from .page_query import PageQueryService
from .page_command import PageCommandService
from .page_export import PageExportService
from .media_service import MediaService
from .html_generator import HtmlGenerator


class PageApplicationService:
    """ページ関連ユースケースのためのアプリケーションサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        domain_service: Optional[PageDomainService] = None,
        media_service: Optional[MediaService] = None,
        html_generator: Optional[HtmlGenerator] = None
    ):
        self.domain_service = domain_service or PageDomainService()
        self.media_service = media_service or MediaService(repository)
        self.html_generator = html_generator or HtmlGenerator(media_service=self.media_service)
        
        # 各サービスの初期化
        self.query_service = PageQueryService(repository, self.domain_service)
        self.command_service = PageCommandService(
            repository,
            self.media_service,
            self.html_generator
        )
        self.export_service = PageExportService(repository, self.html_generator)
    
    # クエリ操作の委譲
    def get_all_root_pages(self) -> List[PageDTO]:
        """ルートページをすべて取得する"""
        return self.query_service.get_all_root_pages()
    
    def get_page_tree(self) -> dict:
        """すべてのページをツリー構造として取得する"""
        return self.query_service.get_page_tree()
    
    def get_page_detail(self, page_id: int) -> Optional[PageDTO]:
        """ページ詳細を取得する"""
        return self.query_service.get_page_detail(page_id)
    
    def get_page_with_children(self, page_id: int) -> Optional[tuple[PageDTO, List[PageDTO]]]:
        """ページとその子ページ一覧を取得する"""
        return self.query_service.get_page_with_children(page_id)
    
    # コマンド操作の委譲
    def create_page(self, dto: CreatePageDTO) -> PageDTO:
        """新規ページを作成する"""
        return self.command_service.create_page(dto)
    
    def update_page(self, dto: UpdatePageDTO) -> Optional[PageDTO]:
        """ページを更新する"""
        return self.command_service.update_page(dto)
    
    def delete_page(self, page_id: int) -> bool:
        """ページとその子孫、関連画像を削除する"""
        return self.command_service.delete_page(page_id)
    
    def move_page(self, page_id: int, new_parent_id: Optional[int]) -> Optional[PageDTO]:
        """ページを別の親の配下へ移動する"""
        return self.command_service.move_page(page_id, new_parent_id)
    
    def update_page_icon(self, page_id: int, icon: str) -> Optional[PageDTO]:
        """ページのアイコンを更新する"""
        return self.command_service.update_page_icon(page_id, icon)
    
    def reorder_page(self, page_id: int, target_page_id: int, position: str) -> Optional[PageDTO]:
        """ページの並び替え：ターゲットの前後に挿入"""
        return self.command_service.reorder_page(page_id, target_page_id, position)
    
    def export_page_as_html(self, page_id: int) -> Optional[str]:
        """ページを画像埋め込み済み単一HTMLとしてエクスポートする"""
        return self.export_service.export_page_as_html(page_id)
