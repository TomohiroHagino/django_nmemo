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
from .page_folder_service import PageFolderService
from .page_url_service import PageUrlService


class PageCommandService:
    """ページのコマンド操作を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: Optional[MediaService] = None,
        html_generator: Optional[HtmlGenerator] = None,
        folder_service: Optional[PageFolderService] = None,
        url_service: Optional[PageUrlService] = None
    ):
        self.repository = repository
        self.media_service = media_service or MediaService(repository)
        self.html_generator = html_generator or HtmlGenerator(media_service=self.media_service)
        
        # フォルダサービスとURLサービスを初期化
        self.folder_service = folder_service or PageFolderService(repository, self.media_service)
        self.url_service = url_service or PageUrlService(repository, self.media_service)
    
    def create_page(self, dto: CreatePageDTO) -> PageDTO:
        """新規ページを作成する"""
        max_order = self._calculate_max_order(dto.parent_id)
        
        aggregate = PageAggregate.create(
            title=dto.title,
            content=dto.content,
            parent_id=dto.parent_id,
            order=max_order + 10
        )
        
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        saved_entity.content = self.media_service.move_temp_images_to_page_folder(
            saved_entity.id,
            saved_entity.content,
            entity=saved_entity
        )
        if saved_entity.content != dto.content:
            saved_entity = self.repository.save(saved_entity)
        
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    def update_page(self, dto: UpdatePageDTO) -> Optional[PageDTO]:
        """ページを更新する"""
        import os
        import re
        
        entity = self.repository.find_by_id(dto.page_id)
        if entity is None:
            return None
        
        old_content = entity.content
        old_title = entity.title
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.update_title(dto.title)
        
        created_folders = []
        
        try:
            updated_entity = DtoConverter.aggregate_to_entity(aggregate)
            
            updated_content = self.media_service.move_temp_images_to_page_folder(
                dto.page_id,
                dto.content,
                entity=updated_entity
            )
            aggregate.update_content(updated_content)
            
            if updated_entity:
                if updated_entity.parent_id:
                    parent_entity = self.repository.find_by_id(updated_entity.parent_id)
                    if parent_entity:
                        parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', updated_entity.title)
                        folder_name = f'{updated_entity.order}_page_{updated_entity.id}_{safe_title}'
                        page_folder = parent_folder / folder_name
                    else:
                        page_folder = None
                else:
                    safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', updated_entity.title)
                    folder_name = f'{updated_entity.order}_page_{updated_entity.id}_{safe_title}'
                    page_folder = self.media_service.uploads_dir / folder_name
                
                if page_folder and page_folder.exists() and page_folder.is_dir():
                    if not any(page_folder.iterdir()):
                        created_folders.append(page_folder)
            
            entity = DtoConverter.aggregate_to_entity(aggregate)
            saved_entity = self.repository.save(entity)
            
            # 画像削除処理
            self.media_service.delete_removed_media(dto.page_id, old_content, updated_content)
            self.media_service.delete_orphaned_media(dto.page_id, updated_content)
            
            # タイトルが変更された場合の処理
            if old_title != saved_entity.title:
                try:
                    if saved_entity.parent_id:
                        parent_entity = self.repository.find_by_id(saved_entity.parent_id)
                        if parent_entity:
                            parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                            
                            if not parent_folder.exists() or not parent_folder.is_dir():
                                raise ValueError(f'親ページ（ID: {saved_entity.parent_id}）のフォルダが存在しません。親ページを先に保存してください。')
                            
                            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', saved_entity.title)
                            folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{safe_title}'
                            
                            new_folder = parent_folder / folder_name
                            if not new_folder.exists():
                                new_folder.mkdir(parents=False, exist_ok=True)
                                created_folders.append(new_folder)
                        else:
                            raise ValueError(f'親ページ（ID: {saved_entity.parent_id}）が見つかりません。')
                    else:
                        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', saved_entity.title)
                        folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{safe_title}'
                        new_folder = self.media_service.uploads_dir / folder_name
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                            created_folders.append(new_folder)
                    
                    # 親フォルダの直下に誤作成フォルダを削除
                    if saved_entity.parent_id:
                        parent_entity = self.repository.find_by_id(saved_entity.parent_id)
                        if parent_entity:
                            parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                            
                            if parent_folder.exists() and parent_folder.is_dir():
                                old_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', old_title)
                                old_folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{old_safe_title}'
                                old_folder_in_parent = parent_folder / old_folder_name
                                
                                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', saved_entity.title)
                                new_folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{safe_title}'
                                new_folder_in_parent = parent_folder / new_folder_name
                                
                                if old_folder_in_parent.exists() and old_folder_in_parent.is_dir():
                                    old_resolved = old_folder_in_parent.resolve()
                                    new_resolved = new_folder.resolve()
                                    if old_resolved != new_resolved:
                                        try:
                                            self.folder_service.move_folder_contents(old_folder_in_parent, new_folder, old_title)
                                            self.folder_service.remove_empty_folders(old_folder_in_parent)
                                        except Exception as e:
                                            print(f"Warning: Failed to move old folder: {e}")
                                
                                if new_folder_in_parent.exists() and new_folder_in_parent.is_dir():
                                    folder_resolved = new_folder_in_parent.resolve()
                                    correct_resolved = new_folder.resolve()
                                    if folder_resolved != correct_resolved:
                                        try:
                                            items = list(new_folder_in_parent.iterdir())
                                            if not items or all(f.is_file() and f.suffix.lower() == '.html' for f in items):
                                                for item in items:
                                                    if item.is_file():
                                                        os.remove(item)
                                                new_folder_in_parent.rmdir()
                                                print(f"✓ Removed misplaced folder from parent")
                                        except Exception as e:
                                            print(f"Warning: Failed to remove misplaced folder: {e}")
                    
                    # 古いフォルダから新しいフォルダへ移動
                    self.folder_service.cleanup_old_folder(old_title, saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to handle folder rename for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
            
            try:
                self.html_generator.save_html_to_folder(saved_entity)
            except Exception as e:
                error_msg = f"Warning: Failed to save HTML file for page {saved_entity.id}: {e}"
                print(error_msg)
                import traceback
                traceback.print_exc()
            
            if old_title != saved_entity.title:
                try:
                    self.folder_service.cleanup_misplaced_folders_after_save(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to cleanup misplaced folders for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
            
            created_folders.clear()
            
            return DtoConverter.entity_to_dto(saved_entity)
            
        except Exception as e:
            print(f"ERROR: Failed to update page {dto.page_id}: {e}")
            import traceback
            traceback.print_exc()
            
            for folder in created_folders:
                try:
                    if folder.exists() and folder.is_dir():
                        items = list(folder.iterdir())
                        if not items:
                            folder.rmdir()
                            print(f"✓ Rolled back: Removed empty folder {folder}")
                        else:
                            parent_folder = folder.parent
                            if parent_folder.exists() and parent_folder.is_dir():
                                parent_items = list(parent_folder.iterdir())
                                if not parent_items or all(item == folder for item in parent_items):
                                    if not items or all(f.is_file() and f.suffix.lower() == '.html' for f in items):
                                        for item in items:
                                            if item.is_file():
                                                os.remove(item)
                                        folder.rmdir()
                                        if not list(parent_folder.iterdir()):
                                            parent_folder.rmdir()
                                        print(f"✓ Rolled back: Removed folder {folder} and empty parent")
                except Exception as cleanup_error:
                    print(f"Warning: Failed to rollback folder {folder}: {cleanup_error}")
            
            raise
    
    def delete_page(self, page_id: int) -> bool:
        """ページとその子孫、関連画像を削除する"""
        entity = self.repository.find_with_all_descendants(page_id)
        if entity is None:
            return False
        
        aggregate = PageAggregate.from_entity_tree(entity)
        page_ids_to_delete = aggregate.collect_all_page_ids()
        
        self.repository.delete(page_id)
        self.media_service.delete_page_media_folders(page_ids_to_delete)
        
        return True
    
    def move_page(self, page_id: int, new_parent_id: Optional[int]) -> Optional[PageDTO]:
        """ページを別の親の配下へ移動する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        if entity.parent_id == new_parent_id:
            aggregate = PageAggregate.from_entity_tree(entity)
            return DtoConverter.entity_to_dto(entity)
        
        if new_parent_id is not None:
            new_parent = self.repository.find_by_id(new_parent_id)
            if new_parent is None:
                raise ValueError('新しい親ページが見つかりません')
        
        old_parent_id = entity.parent_id
        parent_changed = entity.parent_id != new_parent_id
        
        if parent_changed:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
            if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
                raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.parent_id = new_parent_id
        
        max_order = self._calculate_max_order(new_parent_id, exclude_page_id=page_id)
        aggregate.order = max_order + 10
        aggregate.updated_at = datetime.now()
        
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        if parent_changed:
            try:
                self.folder_service.move_folder_to_new_parent(saved_entity, old_parent_id)
            except Exception as e:
                print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                import traceback
                traceback.print_exc()
        
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
        
        entity = DtoConverter.aggregate_to_entity(aggregate)
        saved_entity = self.repository.save(entity)
        
        self.html_generator.save_html_to_folder(saved_entity)
        
        return DtoConverter.entity_to_dto(saved_entity)
    
    @transaction.atomic
    def reorder_page(self, page_id: int, target_page_id: int, position: str) -> Optional[PageDTO]:
        """ページの並び替え：ターゲットの前後に挿入（親が異なる場合は親も変更）"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        target_entity = self.repository.find_by_id(target_page_id)
        if target_entity is None:
            raise ValueError('ターゲットページが見つかりません')
        
        new_parent_id = target_entity.parent_id
        old_parent_id = entity.parent_id
        parent_changed = entity.parent_id != new_parent_id
        
        if parent_changed:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
            if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
                raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        target_parent_id = target_entity.parent_id
        
        if target_parent_id:
            siblings_entities = self.repository.find_children(target_parent_id)
        else:
            siblings_entities = self.repository.find_all_root_pages()
        
        siblings_entities = [s for s in siblings_entities if s.id != page_id]
        
        target_in_siblings = any(s.id == target_page_id for s in siblings_entities)
        if not target_in_siblings:
            siblings_entities.append(target_entity)
        
        old_orders = {}
        all_pages_to_check = [entity] + siblings_entities
        for page_entity in all_pages_to_check:
            old_orders[page_entity.id] = page_entity.order
        
        aggregate = PageAggregate.from_entity_tree(entity)
        siblings = [PageAggregate.from_entity_tree(s) for s in siblings_entities]
        
        aggregate.parent_id = target_parent_id
        aggregate.updated_at = datetime.now()
        
        updated_siblings = aggregate.reorder(target_page_id, position, siblings)
        
        for sibling in updated_siblings:
            if sibling.id == page_id:
                sibling.parent_id = target_parent_id
        
        aggregate.parent_id = target_parent_id
        
        for sibling in updated_siblings:
            if sibling.id not in old_orders:
                current_entity = self.repository.find_by_id(sibling.id)
                if current_entity:
                    old_orders[sibling.id] = current_entity.order
                else:
                    for s in siblings_entities:
                        if s.id == sibling.id:
                            old_orders[sibling.id] = s.order
                            break
        
        if page_id not in old_orders:
            old_orders[page_id] = entity.order
        
        for sibling in updated_siblings:
            if sibling.id == page_id:
                sibling.parent_id = target_parent_id
            
            sibling_entity = DtoConverter.aggregate_to_entity(sibling)
            self.repository.save(sibling_entity)
        
        if not any(s.id == page_id for s in updated_siblings):
            updated_siblings.append(aggregate)
            saved_entity = DtoConverter.aggregate_to_entity(aggregate)
            self.repository.save(saved_entity)
        
        if parent_changed:
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity:
                try:
                    self.folder_service.move_folder_to_new_parent(saved_entity, old_parent_id)
                except Exception as e:
                    print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        # すべての影響を受けたページのフォルダをリネーム（orderが変更された場合）
        for sibling in updated_siblings:
            saved_entity = self.repository.find_by_id(sibling.id)
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    try:
                        old_folder_path_str, new_folder_path_str = self.folder_service.rename_folder_on_order_change(saved_entity, old_order)
                        if old_folder_path_str and new_folder_path_str:
                            self.url_service.update_content_urls_after_rename(saved_entity.id, old_folder_path_str, new_folder_path_str)
                        else:
                            self.url_service.update_content_urls_for_page(saved_entity.id)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for page {saved_entity.id} during reorder: {e}")
                        import traceback
                        traceback.print_exc()
        
        if not any(s.id == page_id for s in updated_siblings):
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    try:
                        old_folder_path_str, new_folder_path_str = self.folder_service.rename_folder_on_order_change(saved_entity, old_order)
                        if old_folder_path_str and new_folder_path_str:
                            self.url_service.update_content_urls_after_rename(saved_entity.id, old_folder_path_str, new_folder_path_str)
                        else:
                            self.url_service.update_content_urls_for_page(saved_entity.id)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for moved page {saved_entity.id}: {e}")
                        import traceback
                        traceback.print_exc()
        
        affected_page_ids = set()
        for sibling in updated_siblings:
            if sibling.id in old_orders and old_orders[sibling.id] != sibling.order:
                affected_page_ids.add(sibling.id)
        if page_id in old_orders:
            old_order = old_orders[page_id]
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity and old_order != saved_entity.order:
                affected_page_ids.add(page_id)
        
        if affected_page_ids:
            self.url_service.update_all_pages_content_urls(affected_page_ids)
        
        for sibling in updated_siblings:
            saved_entity = self.repository.find_by_id(sibling.id)
            if saved_entity:
                try:
                    self.html_generator.save_html_to_folder(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for page {saved_entity.id} during reorder: {e}")
                    import traceback
                    traceback.print_exc()
        
        if not any(s.id == page_id for s in updated_siblings):
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity:
                try:
                    self.html_generator.save_html_to_folder(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for moved page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        try:
            self.folder_service.cleanup_orphaned_folders_in_parent(target_parent_id)
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned folders: {e}")
            import traceback
            traceback.print_exc()
        
        return DtoConverter.entity_to_dto(aggregate) if aggregate.id else None
    
    def _calculate_max_order(self, parent_id: Optional[int], exclude_page_id: Optional[int] = None) -> int:
        """親の子ページの中で最大のorderを取得する"""
        if parent_id:
            siblings = self.repository.find_children(parent_id)
        else:
            siblings = self.repository.find_all_root_pages()
        
        if siblings:
            if exclude_page_id is not None:
                filtered_siblings = [s for s in siblings if s.id != exclude_page_id]
                return max((child.order for child in filtered_siblings), default=0)
            return max((child.order for child in siblings), default=0)
        return 0
