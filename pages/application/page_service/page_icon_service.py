"""ページアイコン更新サービス"""

from typing import Optional
from datetime import datetime

from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from ..dto import PageDTO
from .dto_converter import DtoConverter
from .html_generator import HtmlGenerator


class PageIconService:
    """ページアイコン更新を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        html_generator: HtmlGenerator
    ):
        self.repository = repository
        self.html_generator = html_generator
    
    def update_page_icon(self, page_id: int, icon: str) -> Optional[PageDTO]:
        """ページのアイコンを更新する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.icon = icon
        aggregate.updated_at = datetime.now()
        
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
