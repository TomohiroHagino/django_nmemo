"""ページ集約（Aggregate Root）"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List

from .page_validator import PageValidator
from .page_hierarchy import PageHierarchy
from .page_converter import PageConverter


@dataclass
class PageAggregate:
    """
    ページ集約のルート
    
    ページとその子孫ページを1つの集約として管理し、
    不変条件を保証する。
    """
    id: Optional[int]
    title: str
    content: str
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    icon: str = '📄'
    order: int = 0
    children: List['PageAggregate'] = field(default_factory=list)
    
    def validate(self) -> None:
        """集約の不変条件を検証する"""
        PageValidator.validate_title(self.title)
    
    def update_title(self, title: str) -> None:
        """バリデーションを行いタイトルを更新する"""
        PageValidator.validate_title(title)
        self.title = PageValidator.normalize_title(title)
        self.updated_at = datetime.now()
    
    def update_content(self, content: str) -> None:
        """コンテンツを更新する"""
        self.content = content
        self.updated_at = datetime.now()
    
    def add_child(self, child: 'PageAggregate') -> None:
        """子ページを追加する（不変条件をチェック）"""
        if child.parent_id != self.id:
            raise ValueError('親ページIDが一致しません')
        
        # 循環参照の防止
        if PageHierarchy.would_create_cycle(self, child.id):
            raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        self.children.append(child)
    
    def get_all_descendants(self) -> List['PageAggregate']:
        """すべての子孫ページを再帰的に取得する"""
        return PageHierarchy.get_all_descendants(self)
    
    def collect_all_page_ids(self) -> List[int]:
        """自分自身とすべての子孫のページIDを収集する"""
        return PageHierarchy.collect_all_page_ids(self)
    
    def find_descendant_by_id(self, page_id: int) -> Optional['PageAggregate']:
        """指定IDの子孫ページを検索する"""
        return PageHierarchy.find_descendant_by_id(self, page_id)
    
    def to_flat_list(self) -> List['PageAggregate']:
        """集約内のすべてのページをフラットなリストで返す"""
        return PageHierarchy.to_flat_list(self)
    
    def to_dict(self) -> dict:
        """エクスポート用に辞書へ変換する"""
        return PageConverter.to_dict(self)
    
    @classmethod
    def create(
        cls,
        title: str,
        content: str,
        parent_id: Optional[int] = None,
        order: int = 0
    ) -> 'PageAggregate':
        """新しいページ集約を作成する（ファクトリメソッド）"""
        now = datetime.now()
        aggregate = cls(
            id=None,
            title=PageValidator.normalize_title(title),
            content=content,
            parent_id=parent_id,
            created_at=now,
            updated_at=now,
            order=order,
            children=[]
        )
        aggregate.validate()
        return aggregate
    
    @classmethod
    def from_entity_tree(cls, entity) -> 'PageAggregate':
        """
        PageEntityのツリー構造からPageAggregateを構築する
        
        Note: 既存のPageEntityとの互換性のために用意
        """
        return PageConverter.from_entity_tree(entity)