"""DTOとEntityの変換処理"""

from ...domain.page_aggregate import PageAggregate, PageConverter, PageEntity
from ..dto import PageDTO


class DtoConverter:
    """DTOとEntity/Aggregateの変換を担当"""
    
    @staticmethod
    def entity_to_dto(entity: PageEntity) -> PageDTO:
        """エンティティをDTOに変換する"""
        return PageDTO(
            id=entity.id,
            title=entity.title,
            content=entity.content,
            icon=entity.icon,
            parent_id=entity.parent_id,
            created_at=entity.created_at.isoformat(),
            updated_at=entity.updated_at.isoformat()
        )
    
    @staticmethod
    def aggregate_to_entity(aggregate: PageAggregate) -> PageEntity:
        """PageAggregateをPageEntityに変換する（リポジトリとの互換性）"""
        return PageConverter.to_entity(aggregate)
