"""ページコマンド操作（作成・更新・削除）"""

from typing import Optional
from datetime import datetime
from django.db import transaction

from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from ..dto import CreatePageDTO, UpdatePageDTO, PageDTO
from .dto_converter import DtoConverter
from .media_service import MediaService
from .html_generator import HtmlGenerator


class PageCommandService:
    """ページのコマンド操作を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: Optional[MediaService] = None,
        html_generator: Optional[HtmlGenerator] = None
    ):
        self.repository = repository
        self.media_service = media_service or MediaService()
        self.html_generator = html_generator or HtmlGenerator()
    
    def create_page(self, dto: CreatePageDTO) -> PageDTO:
        """新規ページを作成する"""
        # 親の子ページの中で最大の order を取得して +10
        max_order = self._calculate_max_order(dto.parent_id)
        
        # PageAggregateを使用してページを作成
        aggregate = PageAggregate.create(
            title=dto.title,
            content=dto.content,
            parent_id=dto.parent_id,
            order=max_order + 10
        )
        
        # エンティティに変換してリポジトリに保存
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        # 一時フォルダからページ専用フォルダへ画像を移動
        saved_entity.content = self.media_service.move_temp_images_to_page_folder(
            saved_entity.id,
            saved_entity.content
        )
        if saved_entity.content != dto.content:
            saved_entity = self.repository.save(saved_entity)
        
        # ページフォルダにHTMLファイルを保存
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    def update_page(self, dto: UpdatePageDTO) -> Optional[PageDTO]:
        """ページを更新する"""
        entity = self.repository.find_by_id(dto.page_id)
        if entity is None:
            return None
        
        old_content = entity.content
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.update_title(dto.title)
        
        # 更新前に一時画像をページフォルダへ移動
        updated_content = self.media_service.move_temp_images_to_page_folder(
            dto.page_id,
            dto.content
        )
        aggregate.update_content(updated_content)
        
        # エンティティに変換して保存
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        # 画像削除処理
        self.media_service.delete_removed_media(dto.page_id, old_content, updated_content)
        self.media_service.delete_orphaned_media(dto.page_id, updated_content)
        
        self.html_generator.save_html_to_folder(saved_entity)
        return DtoConverter.entity_to_dto(saved_entity)

    def delete_page(self, page_id: int) -> bool:
        """ページとその子孫、関連画像を削除する"""
        entity = self.repository.find_with_all_descendants(page_id)
        if entity is None:
            return False
        
        aggregate = PageAggregate.from_entity_tree(entity)
        page_ids_to_delete = aggregate.collect_all_page_ids()
        
        # DBからページと子ページを削除
        self.repository.delete(page_id)
        
        # 関連する画像フォルダを削除
        self.media_service.delete_page_media_folders(page_ids_to_delete)
        
        return True

    def move_page(self, page_id: int, new_parent_id: Optional[int]) -> Optional[PageDTO]:
        """ページを別の親の配下へ移動する"""
        # 移動対象のページを取得
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        # 既に同じ親の場合は何もしない（ルートへの移動でも同様）
        if entity.parent_id == new_parent_id:
            # 既に正しい位置にある場合はそのまま返す
            aggregate = PageAggregate.from_entity_tree(entity)
            return DtoConverter.entity_to_dto(entity)
        
        # 新しい親が存在するか確認（Noneの場合はルートに移動）
        if new_parent_id is not None:
            new_parent = self.repository.find_by_id(new_parent_id)
            if new_parent is None:
                raise ValueError('新しい親ページが見つかりません')
        
        # 循環参照をチェック
        from ...domain.page_aggregate import PageDomainService
        all_pages = self.repository.find_all_pages()  # find_all() → find_all_pages() に修正
        if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
            raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        # PageAggregateに変換して移動
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.parent_id = new_parent_id
        
        # 新しい親の子ページの中で最大のorderを取得して設定
        # ただし、移動先が移動元の兄弟の場合は自分自身を除外する必要がある
        max_order = self._calculate_max_order(new_parent_id, exclude_page_id=page_id)
        aggregate.order = max_order + 10
        aggregate.updated_at = datetime.now()
        
        # エンティティに変換して保存
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        # HTMLファイルを更新
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    def update_page_icon(self, page_id: int, icon: str) -> Optional[PageDTO]:
        """ページのアイコンを更新する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.icon = icon
        aggregate.updated_at = datetime.now()
        
        # エンティティに変換して保存
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        # HTMLファイルを更新
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    @transaction.atomic
    def reorder_page(self, page_id: int, target_page_id: int, position: str) -> Optional[PageDTO]:
        """ページの並び替え：ターゲットの前後に挿入（親が異なる場合は親も変更）"""
        # 移動対象のページを取得
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        # ターゲットページを取得
        target_entity = self.repository.find_by_id(target_page_id)
        if target_entity is None:
            raise ValueError('ターゲットページが見つかりません')
        
        # 循環参照をチェック（親が変わる場合）
        new_parent_id = target_entity.parent_id
        if entity.parent_id != new_parent_id:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
            if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
                raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        # ターゲットページの親（移動先の親）を取得
        target_parent_id = target_entity.parent_id
        
        # 移動先の親の兄弟ページを取得（移動対象を含まない）
        if target_parent_id:
            siblings_entities = self.repository.find_children(target_parent_id)
        else:
            siblings_entities = self.repository.find_all_root_pages()
        
        # 移動対象のページを除外（まだ移動前なので、元の親の下にある）
        siblings_entities = [s for s in siblings_entities if s.id != page_id]
        
        # PageAggregateに変換
        aggregate = PageAggregate.from_entity_tree(entity)
        siblings = [PageAggregate.from_entity_tree(s) for s in siblings_entities]
        
        # 移動対象のページの親を変更
        aggregate.parent_id = target_parent_id
        aggregate.updated_at = datetime.now()
        
        # 並び順を変更（ターゲットページの前後に挿入）
        # まず、移動対象のページもsiblingsに追加する必要がある
        # aggregate.reorderは自分自身をsiblingsから除外するので、ここではsiblingsに自分自身は含めない
        updated_siblings = aggregate.reorder(target_page_id, position, siblings)
        
        # すべての兄弟ページを保存（順序が更新されたものすべて）
        for sibling in updated_siblings:
            sibling_entity = DtoConverter.aggregate_to_entity(sibling)
            self.repository.save(sibling_entity)
        
        # HTMLファイルを更新
        saved_entity = self.repository.find_by_id(page_id)
        if saved_entity:
            self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(aggregate) if aggregate.id else None

    def _calculate_max_order(self, parent_id: Optional[int], exclude_page_id: Optional[int] = None) -> int:
        """親の子ページの中で最大のorderを取得する"""
        if parent_id:
            siblings = self.repository.find_children(parent_id)
        else:
            siblings = self.repository.find_all_root_pages()
        
        if siblings:
            # 移動対象のページが含まれている場合は、そのページを除外して最大値を計算
            if exclude_page_id is not None:
                filtered_siblings = [s for s in siblings if s.id != exclude_page_id]
                return max((child.order for child in filtered_siblings), default=0)
            return max((child.order for child in siblings), default=0)
        return 0
