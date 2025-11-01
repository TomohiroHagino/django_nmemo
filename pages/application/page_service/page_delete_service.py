"""ページ削除サービス"""

from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from .media_service import MediaService


class PageDeleteService:
    """ページ削除を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService
    ):
        self.repository = repository
        self.media_service = media_service
    
    def delete_page(self, page_id: int) -> bool:
        """ページとその子孫、関連画像を削除する"""
        entity = self.repository.find_with_all_descendants(page_id)
        if entity is None:
            return False
        
        aggregate = PageAggregate.from_entity_tree(entity)
        page_ids_to_delete = aggregate.collect_all_page_ids()
        
        self.repository.delete(page_id)
        self.media_service.delete_page_media_folders(page_ids_to_delete)
        
        return True
