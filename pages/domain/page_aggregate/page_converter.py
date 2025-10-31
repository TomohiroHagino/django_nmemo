"""ページの変換処理"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .aggregate import PageAggregate
    from .entities import PageEntity


class PageConverter:
    """ページ集約と他の形式との変換を担当"""
    
    @staticmethod
    def to_dict(page: 'PageAggregate') -> dict:
        """エクスポート用に辞書へ変換する"""
        return {
            'id': page.id,
            'title': page.title,
            'content': page.content,
            'icon': page.icon,
            'parent_id': page.parent_id,
            'order': page.order,
            'created_at': page.created_at.isoformat(),
            'updated_at': page.updated_at.isoformat(),
            'children': [PageConverter.to_dict(child) for child in page.children]
        }
    
    @staticmethod
    def from_entity_tree(entity: 'PageEntity') -> 'PageAggregate':
        """
        PageEntityのツリー構造からPageAggregateを構築する
        
        Note: 既存のPageEntityとの互換性のために用意
        """
        from .aggregate import PageAggregate
        
        aggregate = PageAggregate(
            id=entity.id,
            title=entity.title,
            content=entity.content,
            parent_id=entity.parent_id,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            icon=entity.icon,
            order=entity.order,
            children=[PageConverter.from_entity_tree(child) for child in entity.children]
        )
        return aggregate
    
    @staticmethod
    def to_entity(page: 'PageAggregate') -> 'PageEntity':
        """PageAggregateをPageEntityに変換する"""
        from .entities import PageEntity
        
        return PageEntity(
            id=page.id,
            title=page.title,
            content=page.content,
            parent_id=page.parent_id,
            created_at=page.created_at,
            updated_at=page.updated_at,
            icon=page.icon,
            order=page.order,
            children=[PageConverter.to_entity(child) for child in page.children]
        )