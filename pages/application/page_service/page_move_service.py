"""ページ移動サービス"""

from typing import Optional
from datetime import datetime

from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from ..dto import PageDTO
from .dto_converter import DtoConverter
from .html_generator import HtmlGenerator
from .page_folder_service import PageFolderService


class PageMoveService:
    """ページ移動を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        html_generator: HtmlGenerator,
        folder_service: PageFolderService
    ):
        self.repository = repository
        self.html_generator = html_generator
        self.folder_service = folder_service
    
    def move_page(self, page_id: int, new_parent_id: Optional[int]) -> Optional[PageDTO]:
        """ページを別の親の配下へ移動する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        if entity.parent_id == new_parent_id:
            aggregate = PageAggregate.from_entity_tree(entity)
            return DtoConverter.entity_to_dto(entity)
        
        if new_parent_id is not None:
            new_parent = self.repository.find_by_id(new_parent_id)
            if new_parent is None:
                raise ValueError('新しい親ページが見つかりません')
        
        old_parent_id = entity.parent_id
        parent_changed = entity.parent_id != new_parent_id
        
        if parent_changed:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
            if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
                raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.parent_id = new_parent_id
        
        max_order = self._calculate_max_order(new_parent_id, exclude_page_id=page_id)
        aggregate.order = max_order + 10
        aggregate.updated_at = datetime.now()
        
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        if parent_changed:
            try:
                self.folder_service.move_folder_to_new_parent(saved_entity, old_parent_id)
            except Exception as e:
                print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                import traceback
                traceback.print_exc()
        
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    def _calculate_max_order(self, parent_id: Optional[int], exclude_page_id: Optional[int] = None) -> int:
        """親の子ページの中で最大のorderを取得する"""
        if parent_id:
            siblings = self.repository.find_children(parent_id)
        else:
            siblings = self.repository.find_all_root_pages()
        
        if siblings:
            if exclude_page_id is not None:
                filtered_siblings = [s for s in siblings if s.id != exclude_page_id]
                return max((child.order for child in filtered_siblings), default=0)
            return max((child.order for child in siblings), default=0)
        return 0
