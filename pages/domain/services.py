"""ドメインサービス"""

from typing import List
from .entities import PageEntity


class PageDomainService:
    """ページに関するビジネスロジックを担うドメインサービス"""
    
    @staticmethod
    def build_page_tree(pages: List[PageEntity]) -> List[PageEntity]:
        """フラットなページ一覧から階層ツリーを構築する"""
        page_map = {page.id: page for page in pages if page.id is not None}
        root_pages = []
        
        for page in pages:
            if page.parent_id is None:
                root_pages.append(page)
            elif page.parent_id in page_map:
                parent = page_map[page.parent_id]
                parent.add_child(page)
        
        return root_pages
    
    @staticmethod
    def validate_hierarchy(parent_id: Optional[int], page_id: Optional[int], all_pages: List[PageEntity]) -> bool:
        """親子関係を設定しても循環参照が発生しないことを検証する"""
        if parent_id is None:
            return True
        
        if parent_id == page_id:
            return False
        
        # 循環参照をチェック
        page_map = {page.id: page for page in all_pages if page.id is not None}
        current_id = parent_id
        
        while current_id is not None:
            if current_id == page_id:
                return False
            
            current_page = page_map.get(current_id)
            if current_page is None:
                break
            
            current_id = current_page.parent_id
        
        return True
