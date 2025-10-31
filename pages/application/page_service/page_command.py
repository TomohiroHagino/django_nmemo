"""ページコマンド操作（作成・更新・削除）"""

from typing import Optional

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
    
    def _calculate_max_order(self, parent_id: Optional[int]) -> int:
        """親の子ページの中で最大のorderを取得する"""
        if parent_id:
            siblings = self.repository.find_children(parent_id)
        else:
            siblings = self.repository.find_all_root_pages()
        
        if siblings:
            return max((child.order for child in siblings), default=0)
        return 0
