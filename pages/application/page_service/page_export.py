"""ページエクスポート操作"""

import json
from typing import Optional

from ...domain.page_aggregate import PageAggregate, PageEntity
from ...domain.repositories import PageRepositoryInterface
from .html_generator import HtmlGenerator


class PageExportService:
    """ページのエクスポート操作を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        html_generator: Optional[HtmlGenerator] = None
    ):
        self.repository = repository
        self.html_generator = html_generator or HtmlGenerator()
    
    def export_page(self, page_id: int) -> Optional[str]:
        """ページとその子孫をJSONとしてエクスポートする"""
        entity = self.repository.find_with_all_descendants(page_id)
        if entity is None:
            return None
        
        aggregate = PageAggregate.from_entity_tree(entity)
        data = aggregate.to_dict()
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def export_page_as_html(self, page_id: int) -> Optional[str]:
        """ページを画像埋め込み済み単一HTMLとしてエクスポートする"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        return self.html_generator.generate_html_content(entity)
