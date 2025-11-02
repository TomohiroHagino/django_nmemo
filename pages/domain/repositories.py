"""リポジトリインターフェース（抽象クラス）"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict
from .page_aggregate import PageEntity


class PageRepositoryInterface(ABC):
    """ページ用リポジトリのインターフェース"""
    
    @abstractmethod
    def find_by_id(self, page_id: int) -> Optional[PageEntity]:
        """ID でページを検索する"""
        pass
    
    @abstractmethod
    def find_all_root_pages(self) -> List[PageEntity]:
        """ルートページ（親を持たないページ）をすべて取得する"""
        pass
    
    @abstractmethod
    def find_all_pages(self) -> List[PageEntity]:
        """すべてのページを取得する"""
        pass
    
    @abstractmethod
    def find_children(self, page_id: int) -> List[PageEntity]:
        """指定ページのすべての子ページを取得する"""
        pass
    
    @abstractmethod
    def save(self, entity: PageEntity) -> PageEntity:
        """ページエンティティを保存する"""
        pass
    
    @abstractmethod
    def delete(self, page_id: int) -> None:
        """ID でページを削除する"""
        pass
    
    @abstractmethod
    def find_with_all_descendants(self, page_id: int) -> Optional[PageEntity]:
        """子孫をすべて読み込んだ状態でページを取得する"""
        pass
    
    @abstractmethod
    def bulk_update(self, entities: List[PageEntity], existing_pages: Optional[Dict[int, 'Page']] = None) -> List[PageEntity]:
        """複数のページエンティティを一括更新する
        
        Args:
            entities: 更新するエンティティのリスト
            existing_pages: 既存のDjangoモデルオブジェクトの辞書（IDをキーとする）
                          渡された場合、この辞書を使用して重複クエリを避ける
        """
        pass
    
    @abstractmethod
    def find_by_ids(self, page_ids: List[int]) -> List[PageEntity]:
        """複数のIDでページを一括検索する"""
        pass