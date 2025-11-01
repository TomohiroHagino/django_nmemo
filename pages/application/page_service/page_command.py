"""ページコマンド操作（ファサード）"""

from typing import Optional
from ...domain.repositories import PageRepositoryInterface
from ..dto import CreatePageDTO, UpdatePageDTO, PageDTO
from .media_service import MediaService
from .html_generator import HtmlGenerator
from .page_folder_service import PageFolderService
from .page_url_service import PageUrlService
from .page_create_service import PageCreateService
from .page_update_service import PageUpdateService
from .page_delete_service import PageDeleteService
from .page_move_service import PageMoveService
from .page_icon_service import PageIconService
from .page_reorder_service import PageReorderService


class PageCommandService:
    """ページのコマンド操作を担当するサービス（ファサード）"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: Optional[MediaService] = None,
        html_generator: Optional[HtmlGenerator] = None,
        folder_service: Optional[PageFolderService] = None,
        url_service: Optional[PageUrlService] = None
    ):
        self.repository = repository
        self.media_service = media_service or MediaService(repository)
        self.html_generator = html_generator or HtmlGenerator(media_service=self.media_service)
        
        # フォルダサービスとURLサービスを初期化
        self.folder_service = folder_service or PageFolderService(repository, self.media_service)
        self.url_service = url_service or PageUrlService(repository, self.media_service)
        
        # 各コマンドサービスの初期化
        self.create_service = PageCreateService(repository, self.media_service, self.html_generator)
        self.update_service = PageUpdateService(repository, self.media_service, self.html_generator, self.folder_service)
        self.delete_service = PageDeleteService(repository, self.media_service)
        self.move_service = PageMoveService(repository, self.html_generator, self.folder_service)
        self.icon_service = PageIconService(repository, self.html_generator)
        self.reorder_service = PageReorderService(repository, self.html_generator, self.folder_service, self.url_service)
    
    def create_page(self, dto: CreatePageDTO) -> PageDTO:
        """新規ページを作成する"""
        return self.create_service.create_page(dto)
    
    def update_page(self, dto: UpdatePageDTO) -> Optional[PageDTO]:
        """ページを更新する"""
        return self.update_service.update_page(dto)
    
    def delete_page(self, page_id: int) -> bool:
        """ページとその子孫、関連画像を削除する"""
        return self.delete_service.delete_page(page_id)
    
    def move_page(self, page_id: int, new_parent_id: Optional[int]) -> Optional[PageDTO]:
        """ページを別の親の配下へ移動する"""
        return self.move_service.move_page(page_id, new_parent_id)
    
    def update_page_icon(self, page_id: int, icon: str) -> Optional[PageDTO]:
        """ページのアイコンを更新する"""
        return self.icon_service.update_page_icon(page_id, icon)
    
    def reorder_page(self, page_id: int, target_page_id: int, position: str) -> Optional[PageDTO]:
        """ページの並び替え：ターゲットの前後に挿入"""
        return self.reorder_service.reorder_page(page_id, target_page_id, position)
