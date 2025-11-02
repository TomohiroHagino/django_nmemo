"""ページ更新サービス"""

import os
import re
import traceback
from typing import Optional, List, Dict
from pathlib import Path

from ...domain.page_aggregate import PageAggregate, PageEntity
from ...domain.repositories import PageRepositoryInterface
from ..dto import UpdatePageDTO, PageDTO
from .dto_converter import DtoConverter
from .media_service import MediaService
from .html_generator import HtmlGenerator
from .page_folder_service import PageFolderService


class PageUpdateService:
    """ページ更新を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService,
        html_generator: HtmlGenerator,
        folder_service: PageFolderService
    ):
        self.repository = repository
        self.media_service = media_service
        self.html_generator = html_generator
        self.folder_service = folder_service
    
    def update_page(self, dto: UpdatePageDTO) -> Optional[PageDTO]:
        """ページを更新する"""
        entity = self.repository.find_by_id(dto.page_id)
        if entity is None:
            return None
        
        old_content = entity.content
        old_title = entity.title
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.update_title(dto.title)
        
        created_folders = []
        
        # entity_cacheを作成
        entity_cache: Dict[int, PageEntity] = {}
        entity_cache[entity.id] = entity
        
        # 親エンティティを事前に取得してキャッシュに追加
        if entity.parent_id:
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                entity_cache[entity.parent_id] = parent_entity
        
        try:
            updated_entity = DtoConverter.aggregate_to_entity(aggregate)
            entity_cache[updated_entity.id] = updated_entity
            
            updated_content = self.media_service.move_temp_images_to_page_folder(
                dto.page_id,
                dto.content,
                entity=updated_entity,
                entity_cache=entity_cache
            )
            aggregate.update_content(updated_content)
            
            if updated_entity:
                if updated_entity.parent_id:
                    # キャッシュから親エンティティを取得
                    parent_entity = entity_cache.get(updated_entity.parent_id)
                    if not parent_entity and self.repository:
                        parent_entity = self.repository.find_by_id(updated_entity.parent_id)
                        if parent_entity:
                            entity_cache[updated_entity.parent_id] = parent_entity
                    
                    if parent_entity:
                        parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity, entity_cache)
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
            entity_cache[saved_entity.id] = saved_entity
            
            # 画像削除処理
            self.media_service.delete_removed_media(dto.page_id, old_content, updated_content)
            self.media_service.delete_orphaned_media(dto.page_id, updated_content)
            
            # タイトルが変更された場合の処理
            if old_title != saved_entity.title:
                self._handle_title_change(saved_entity, old_title, created_folders, entity_cache)
            
            try:
                self.html_generator.save_html_to_folder(saved_entity, entity_cache)
            except Exception as e:
                error_msg = f"Warning: Failed to save HTML file for page {saved_entity.id}: {e}"
                print(error_msg)
                traceback.print_exc()
            
            if old_title != saved_entity.title:
                try:
                    self.folder_service.cleanup_misplaced_folders_after_save(saved_entity, entity_cache)
                except Exception as e:
                    print(f"Warning: Failed to cleanup misplaced folders for page {saved_entity.id}: {e}")
                    traceback.print_exc()
            
            created_folders.clear()
            
            return DtoConverter.entity_to_dto(saved_entity)
            
        except Exception as e:
            print(f"ERROR: Failed to update page {dto.page_id}: {e}")
            traceback.print_exc()
            self._rollback_on_error(created_folders)
            raise
    
    def _handle_title_change(self, saved_entity: PageEntity, old_title: str, created_folders: List[Path], entity_cache: Dict[int, PageEntity]) -> None:
        """タイトル変更時の処理"""
        try:
            if saved_entity.parent_id:
                # キャッシュから親エンティティを取得
                parent_entity = entity_cache.get(saved_entity.parent_id)
                if not parent_entity and self.repository:
                    parent_entity = self.repository.find_by_id(saved_entity.parent_id)
                    if parent_entity:
                        entity_cache[saved_entity.parent_id] = parent_entity
                
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity, entity_cache)
                    
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
                # キャッシュから親エンティティを取得（既に取得済み）
                parent_entity = entity_cache.get(saved_entity.parent_id)
                if not parent_entity and self.repository:
                    parent_entity = self.repository.find_by_id(saved_entity.parent_id)
                    if parent_entity:
                        entity_cache[saved_entity.parent_id] = parent_entity
                
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity, entity_cache)
                    
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
            self.folder_service.cleanup_old_folder(old_title, saved_entity, entity_cache)
        except Exception as e:
            print(f"Warning: Failed to handle folder rename for page {saved_entity.id}: {e}")
            traceback.print_exc()
    
    def _rollback_on_error(self, created_folders: List[Path]) -> None:
        """エラー時に作成されたフォルダをロールバックする"""
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
