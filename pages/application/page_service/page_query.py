"""ページクエリ操作"""

from typing import Optional, List
from ...domain.repositories import PageRepositoryInterface
from ...domain.page_aggregate import PageDomainService, PageEntity
from ..dto import PageDTO
from .dto_converter import DtoConverter


class PageQueryService:
    """ページのクエリ操作を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        domain_service: PageDomainService
    ):
        self.repository = repository
        self.domain_service = domain_service
    
    def get_all_root_pages(self) -> List[PageDTO]:
        """ルートページをすべて取得する"""
        entities = self.repository.find_all_root_pages()
        return [DtoConverter.entity_to_dto(entity) for entity in entities]
    
    def get_page_tree(self) -> dict:
        """すべてのページをツリー構造として取得する"""
        all_pages = self.repository.find_all_pages()
        root_pages = self.domain_service.build_page_tree(all_pages)
        
        def entity_to_tree_dict(entity: PageEntity) -> dict:
            return {
                'id': entity.id,
                'title': entity.title,
                'content': entity.content,
                'icon': entity.icon,
                'parent_id': entity.parent_id,
                'created_at': entity.created_at.isoformat(),
                'updated_at': entity.updated_at.isoformat(),
                'children': [entity_to_tree_dict(child) for child in entity.children]
            }
        
        return {
            'pages': [entity_to_tree_dict(page) for page in root_pages]
        }
    
    def get_page_detail(self, page_id: int) -> Optional[PageDTO]:
        """ページ詳細を取得する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        return DtoConverter.entity_to_dto(entity)
    
    def get_page_with_children(self, page_id: int) -> Optional[tuple[PageDTO, List[PageDTO]]]:
        """ページとその子ページ一覧を取得する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        children_entities = self.repository.find_children(page_id)
        page_dto = DtoConverter.entity_to_dto(entity)
        children_dtos = [DtoConverter.entity_to_dto(child) for child in children_entities]
        
        return page_dto, children_dtos
