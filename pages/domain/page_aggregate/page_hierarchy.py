"""ページ階層構造の操作"""

from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .page_aggregate import PageAggregate


class PageHierarchy:
    """ページの階層構造に関する操作を担当"""
    
    @staticmethod
    def get_all_descendants(page: 'PageAggregate') -> List['PageAggregate']:
        """すべての子孫ページを再帰的に取得する"""
        descendants = []
        for child in page.children:
            descendants.append(child)
            descendants.extend(PageHierarchy.get_all_descendants(child))
        return descendants
    
    @staticmethod
    def collect_all_page_ids(page: 'PageAggregate') -> List[int]:
        """自分自身とすべての子孫のページIDを収集する"""
        ids = [page.id]
        for child in page.children:
            ids.extend(PageHierarchy.collect_all_page_ids(child))
        return ids
    
    @staticmethod
    def find_descendant_by_id(page: 'PageAggregate', page_id: int) -> Optional['PageAggregate']:
        """指定IDの子孫ページを検索する"""
        if page.id == page_id:
            return page
        
        for child in page.children:
            result = PageHierarchy.find_descendant_by_id(child, page_id)
            if result:
                return result
        
        return None
    
    @staticmethod
    def to_flat_list(page: 'PageAggregate') -> List['PageAggregate']:
        """集約内のすべてのページをフラットなリストで返す"""
        result = [page]
        for child in page.children:
            result.extend(PageHierarchy.to_flat_list(child))
        return result
    
    @staticmethod
    def would_create_cycle(page: 'PageAggregate', child_id: Optional[int]) -> bool:
        """子を追加することで循環参照が発生するかをチェック"""
        if child_id is None or page.id is None:
            return False
        
        if child_id == page.id:
            return True
        
        # 子孫の中に自分自身が含まれていないか確認
        descendants = PageHierarchy.get_all_descendants(page)
        for descendant in descendants:
            if descendant.id == page.id:
                return True
        
        return False