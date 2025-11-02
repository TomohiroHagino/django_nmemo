"""フォルダ移動・リネーム操作を担当するサービス"""

import os
import re
import shutil
import traceback
from pathlib import Path
from typing import Optional, Dict
from ...domain.repositories import PageRepositoryInterface
from .media_service import MediaService


class FolderMoveService:
    """フォルダ移動・リネーム操作を担当するサービス"""
    
    def __init__(self, repository: PageRepositoryInterface, media_service: MediaService):
        self.repository = repository
        self.media_service = media_service
    
    def move_folder_contents(self, old_folder: Path, new_folder: Path, old_title: str) -> None:
        """古いフォルダ内のすべてのコンテンツを新しいフォルダに移動"""
        try:
            if not new_folder.exists():
                new_folder.mkdir(parents=False, exist_ok=True)
            
            items_to_process = list(old_folder.iterdir())
            
            for item in items_to_process:
                if item.is_file():
                    if item.suffix.lower() == '.html':
                        try:
                            new_path = new_folder / item.name
                            if new_path.exists():
                                os.remove(new_path)
                            shutil.move(str(item), str(new_path))
                            print(f"✓ Moved HTML file: {item.name}")
                        except Exception as e:
                            print(f"✗ Warning: Failed to move HTML file {item.name}: {e}")
                    else:
                        try:
                            new_path = new_folder / item.name
                            if not new_path.exists():
                                shutil.move(str(item), str(new_path))
                                print(f"✓ Moved file: {item.name}")
                            else:
                                os.remove(item)
                                print(f"✓ Removed duplicate file: {item.name}")
                        except Exception as e:
                            print(f"✗ Warning: Failed to move/delete file {item.name}: {e}")
                elif item.is_dir():
                    try:
                        new_subfolder = new_folder / item.name
                        if not new_subfolder.exists():
                            shutil.move(str(item), str(new_subfolder))
                            print(f"✓ Moved subdirectory: {item.name}")
                        else:
                            self.merge_directories(item, new_subfolder)
                            try:
                                if not any(item.iterdir()):
                                    item.rmdir()
                                    print(f"✓ Removed empty subdirectory after merge: {item.name}")
                            except:
                                pass
                    except Exception as e:
                        print(f"✗ Warning: Failed to move subdirectory {item.name}: {e}")
        except Exception as e:
            print(f"✗ Warning: Failed to move folder contents: {e}")
            traceback.print_exc()
    
    def merge_directories(self, src_dir: Path, dst_dir: Path) -> None:
        """ソースディレクトリの内容を宛先ディレクトリにマージ"""
        try:
            for item in src_dir.iterdir():
                dst_item = dst_dir / item.name
                if item.is_file():
                    if not dst_item.exists():
                        shutil.move(str(item), str(dst_item))
                elif item.is_dir():
                    if not dst_item.exists():
                        shutil.move(str(item), str(dst_item))
                    else:
                        self.merge_directories(item, dst_item)
                        try:
                            if not any(item.iterdir()):
                                item.rmdir()
                        except:
                            pass
        except Exception as e:
            print(f"Warning: Failed to merge directories: {e}")
    
    def remove_empty_folders(self, folder: Path) -> None:
        """空になったフォルダを再帰的に削除"""
        try:
            if not folder.exists() or not folder.is_dir():
                return
            
            for item in list(folder.iterdir()):
                if item.is_dir():
                    self.remove_empty_folders(item)
            
            try:
                remaining_items = list(folder.iterdir())
                if not remaining_items:
                    folder.rmdir()
                    print(f"✓ Removed empty folder: {folder}")
            except Exception as e:
                pass
        except Exception as e:
            print(f"Warning: Failed to remove empty folders: {e}")
    
    def rename_folder_on_order_change(self, entity: 'PageEntity', old_order: int) -> tuple:
        """order変更時にフォルダをリネームする"""
        try:
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            old_folder_name = f'{old_order}_page_{entity.id}_{safe_title}'
            new_folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            
            old_folder_path_str = None
            new_folder_path_str = None
            
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        existing_parent_folder = self.media_service._find_existing_parent_folder(parent_entity)
                        if existing_parent_folder:
                            parent_folder = existing_parent_folder
                        else:
                            print(f"ERROR: Parent folder does not exist for page {entity.id}")
                            return None, None
                    
                    parent_folder_path = self.media_service.get_page_folder_path(parent_entity)
                    old_folder_path_str = str(parent_folder_path / old_folder_name).replace('\\', '/')
                    new_folder_path_str = str(parent_folder_path / new_folder_name).replace('\\', '/')
                    
                    old_folder = parent_folder / old_folder_name
                    new_folder = parent_folder / new_folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}")
                    return None, None
            else:
                old_folder_path_str = old_folder_name
                new_folder_path_str = new_folder_name
                
                old_folder = self.media_service.uploads_dir / old_folder_name
                new_folder = self.media_service.uploads_dir / new_folder_name
            
            if old_folder.exists() and old_folder.is_dir():
                old_folder_resolved = old_folder.resolve()
                new_folder_resolved = new_folder.resolve()
                
                if old_folder_resolved != new_folder_resolved:
                    existing_folder = self.media_service._find_existing_page_folder(entity)
                    if existing_folder:
                        existing_resolved = existing_folder.resolve()
                        if existing_resolved == old_folder_resolved:
                            if not new_folder.exists():
                                new_folder.mkdir(parents=False, exist_ok=True)
                            
                            self.move_folder_contents(old_folder, new_folder, entity.title)
                            self.remove_empty_folders(old_folder)
                            
                            return old_folder_path_str, new_folder_path_str
                        elif existing_resolved != new_folder_resolved:
                            if not new_folder.exists():
                                new_folder.mkdir(parents=False, exist_ok=True)
                            self.move_folder_contents(existing_folder, new_folder, entity.title)
                            self.remove_empty_folders(existing_folder)
                            
                            existing_folder_relative = existing_folder.relative_to(self.media_service.uploads_dir)
                            existing_folder_path_str = str(existing_folder_relative).replace('\\', '/')
                            return existing_folder_path_str, new_folder_path_str
                    else:
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                        self.move_folder_contents(old_folder, new_folder, entity.title)
                        self.remove_empty_folders(old_folder)
                        
                        return old_folder_path_str, new_folder_path_str
            else:
                existing_folder = self.media_service._find_existing_page_folder(entity)
                if existing_folder:
                    existing_resolved = existing_folder.resolve()
                    new_folder_resolved = new_folder.resolve()
                    
                    if existing_resolved != new_folder_resolved:
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                        self.move_folder_contents(existing_folder, new_folder, entity.title)
                        self.remove_empty_folders(existing_folder)
                        
                        existing_folder_relative = existing_folder.relative_to(self.media_service.uploads_dir)
                        existing_folder_path_str = str(existing_folder_relative).replace('\\', '/')
                        return existing_folder_path_str, new_folder_path_str
            
            return None, None
            
        except Exception as e:
            print(f"Warning: Failed to rename folder on order change: {e}")
            traceback.print_exc()
            return None, None
    
    def move_folder_to_new_parent(self, entity: 'PageEntity', old_parent_id: Optional[int], entity_cache: Optional[Dict[int, PageEntity]] = None) -> None:
        """親が変わった場合にフォルダを古い親から新しい親に移動する"""
        try:
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            
            old_parent_folder = None
            old_folder = None
            if old_parent_id:
                # キャッシュから古い親エンティティを取得、なければDBから取得
                old_parent_entity = None
                if entity_cache:
                    old_parent_entity = entity_cache.get(old_parent_id)
                
                if old_parent_entity is None:
                    old_parent_entity = self.repository.find_by_id(old_parent_id)
                    if old_parent_entity and entity_cache is not None:
                        entity_cache[old_parent_id] = old_parent_entity
                
                if old_parent_entity:
                    old_parent_folder = self.media_service._get_page_folder_absolute_path(old_parent_entity, entity_cache)
                    if not old_parent_folder.exists() or not old_parent_folder.is_dir():
                        old_parent_folder = self.media_service._find_existing_parent_folder(old_parent_entity, entity_cache)
                
                if old_parent_folder and old_parent_folder.exists() and old_parent_folder.is_dir():
                    for item in old_parent_folder.iterdir():
                        if item.is_dir() and f'_page_{entity.id}_' in item.name and safe_title in item.name:
                            old_folder = item
                            break
                else:
                    print(f"Warning: Old parent folder not found for page {entity.id}")
            else:
                for item in self.media_service.uploads_dir.iterdir():
                    if item.is_dir() and f'_page_{entity.id}_' in item.name and safe_title in item.name:
                        old_folder = item
                        break
            
            new_parent_folder = None
            if entity.parent_id:
                # キャッシュから新しい親エンティティを取得、なければDBから取得
                new_parent_entity = None
                if entity_cache:
                    new_parent_entity = entity_cache.get(entity.parent_id)
                
                if new_parent_entity is None:
                    new_parent_entity = self.repository.find_by_id(entity.parent_id)
                    if new_parent_entity and entity_cache is not None:
                        entity_cache[entity.parent_id] = new_parent_entity
                
                if new_parent_entity:
                    new_parent_folder = self.media_service._get_page_folder_absolute_path(new_parent_entity, entity_cache)
                    if not new_parent_folder.exists() or not new_parent_folder.is_dir():
                        new_parent_folder = self.media_service._find_existing_parent_folder(new_parent_entity, entity_cache)
                    if not new_parent_folder or not new_parent_folder.exists():
                        print(f"Warning: New parent folder not found for page {entity.id}, parent_id={entity.parent_id}")
                        return
                else:
                    print(f"ERROR: New parent entity not found for page {entity.id}")
                    return
                new_folder = new_parent_folder / folder_name
            else:
                new_folder = self.media_service.uploads_dir / folder_name
            
            if old_folder and old_folder.exists() and old_folder.is_dir():
                old_folder_resolved = old_folder.resolve()
                new_folder_resolved = new_folder.resolve()
                
                if old_folder_resolved != new_folder_resolved:
                    if not new_folder.exists():
                        new_folder.mkdir(parents=False, exist_ok=True)
                    
                    self.move_folder_contents(old_folder, new_folder, entity.title)
                    self.remove_empty_folders(old_folder)
            else:
                print(f"Warning: Old folder not found for page {entity.id} (old_parent_id={old_parent_id})")
                existing_folder = self.media_service._find_existing_page_folder(entity)
                if existing_folder:
                    existing_resolved = existing_folder.resolve()
                    new_folder_resolved = new_folder.resolve()
                    
                    if existing_resolved != new_folder_resolved:
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                        self.move_folder_contents(existing_folder, new_folder, entity.title)
                        self.remove_empty_folders(existing_folder)
            
        except Exception as e:
            print(f"Warning: Failed to move folder to new parent: {e}")
            traceback.print_exc()
