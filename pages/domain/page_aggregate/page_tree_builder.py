"""ページツリー構築サービス"""

from typing import List
from .entities import PageEntity


class PageTreeBuilder:
    """フラットなページ一覧から階層ツリーを構築するドメインサービス"""
    
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
