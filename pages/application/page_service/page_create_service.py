"""ページ作成サービス"""

from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from ..dto import CreatePageDTO, PageDTO
from .dto_converter import DtoConverter
from .media_service import MediaService
from .html_generator import HtmlGenerator


class PageCreateService:
    """ページ作成を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService,
        html_generator: HtmlGenerator
    ):
        self.repository = repository
        self.media_service = media_service
        self.html_generator = html_generator
    
    def create_page(self, dto: CreatePageDTO) -> PageDTO:
        """新規ページを作成する"""
        max_order = self._calculate_max_order(dto.parent_id)
        
        aggregate = PageAggregate.create(
            title=dto.title,
            content=dto.content,
            parent_id=dto.parent_id,
            order=max_order + 10
        )
        
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        saved_entity.content = self.media_service.move_temp_images_to_page_folder(
            saved_entity.id,
            saved_entity.content,
            entity=saved_entity
        )
        if saved_entity.content != dto.content:
            saved_entity = self.repository.save(saved_entity)
        
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    def _calculate_max_order(self, parent_id) -> int:
        """親の子ページの中で最大のorderを取得する"""
        if parent_id:
            siblings = self.repository.find_children(parent_id)
        else:
            siblings = self.repository.find_all_root_pages()
        
        if siblings:
            return max((child.order for child in siblings), default=0)
        return 0
