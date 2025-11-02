"""フォルダクリーンアップを担当するサービス"""

import os
import re
import shutil
import traceback
from pathlib import Path
from typing import Optional, Dict
from ...domain.repositories import PageRepositoryInterface
from .media_service import MediaService
from .folder_move_service import FolderMoveService


class FolderCleanupService:
    """フォルダクリーンアップを担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService,
        move_service: FolderMoveService
    ):
        self.repository = repository
        self.media_service = media_service
        self.move_service = move_service  # FolderMoveServiceを使用
    
    def cleanup_old_folder(self, old_title: str, entity: 'PageEntity') -> None:
        """タイトル変更時に古いフォルダをクリーンアップ"""
        try:
            # 古いフォルダ名を計算
            old_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', old_title)
            old_folder_name = f'{entity.order}_page_{entity.id}_{old_safe_title}'
            
            # 新しいフォルダパスを取得
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        print(f"ERROR: Parent folder does not exist for page {entity.id}")
                        return
                    
                    safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
                    folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                    new_folder = parent_folder / folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}, parent_id={entity.parent_id}")
                    return
            else:
                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
                folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                new_folder = self.media_service.uploads_dir / folder_name
            
            # 古いフォルダパスを計算
            old_folder = None
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        print(f"ERROR: Parent folder does not exist for old folder calculation")
                        return
                    
                    old_folder = parent_folder / old_folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}")
                    return
            else:
                old_folder = self.media_service.uploads_dir / old_folder_name
            
            # 古いフォルダが存在し、新しいフォルダと異なる場合
            if old_folder and old_folder.exists() and old_folder.is_dir():
                old_folder_resolved = old_folder.resolve()
                new_folder_resolved = new_folder.resolve()
                
                if old_folder_resolved != new_folder_resolved:
                    if not new_folder.exists():
                        new_folder.mkdir(parents=False, exist_ok=True)
                    
                    self.move_service.move_folder_contents(old_folder, new_folder, old_title)
                    self.move_service.remove_empty_folders(old_folder)
            
            # 念のため、uploadsディレクトリ全体から誤って作成された可能性のある古いフォルダも検索
            if old_folder and old_folder.exists():
                try:
                    self.cleanup_orphaned_old_folders(entity.id, old_folder_name, old_folder.resolve())
                except Exception as e:
                    print(f"Warning: Failed to cleanup orphaned old folders: {e}")
                    
        except Exception as e:
            print(f"Warning: Failed to cleanup old folder: {e}")
            traceback.print_exc()
    
    def cleanup_orphaned_old_folders(self, page_id: int, old_folder_name: str, exclude_folder: Path) -> None:
        """誤って作成された可能性のある古いフォルダをクリーンアップ"""
        try:
            for root, dirs, files in os.walk(self.media_service.uploads_dir):
                root_path = Path(root)
                
                for dir_name in dirs[:]:
                    if f'_page_{page_id}_' in dir_name or dir_name.endswith(f'_page_{page_id}'):
                        folder_path = root_path / dir_name
                        folder_resolved = folder_path.resolve()
                        
                        if folder_resolved != exclude_folder:
                            if dir_name == old_folder_name:
                                try:
                                    items = list(folder_path.iterdir())
                                    if not items:
                                        folder_path.rmdir()
                                        print(f"✓ Removed orphaned empty folder: {folder_path}")
                                except Exception as e:
                                    print(f"Warning: Failed to check/remove orphaned folder {folder_path}: {e}")
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned old folders: {e}")
    
    def cleanup_misplaced_folders_after_save(self, entity: 'PageEntity') -> None:
        """保存後に親階層に誤って作成されたフォルダを削除"""
        try:
            new_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            new_folder_name = f'{entity.order}_page_{entity.id}_{new_safe_title}'
            
            # 正しい新しいフォルダのパスを取得
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    correct_new_folder_path = parent_folder / new_folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}")
                    return
            else:
                correct_new_folder_path = Path(new_folder_name)
            
            correct_new_folder = self.media_service.uploads_dir / correct_new_folder_path
            correct_new_folder_resolved = correct_new_folder.resolve()
            
            # uploads直下に誤って作成されたフォルダをチェック
            wrong_folder_in_uploads = self.media_service.uploads_dir / new_folder_name
            if wrong_folder_in_uploads.exists() and wrong_folder_in_uploads.is_dir():
                wrong_resolved = wrong_folder_in_uploads.resolve()
                if wrong_resolved != correct_new_folder_resolved:
                    try:
                        items = list(wrong_folder_in_uploads.iterdir())
                        if not items:
                            wrong_folder_in_uploads.rmdir()
                            print(f"✓ Removed misplaced empty folder from uploads root")
                        else:
                            html_files = [f for f in items if f.is_file() and f.suffix.lower() == '.html']
                            other_items = [f for f in items if f not in html_files]
                            
                            if len(html_files) > 0 and len(other_items) == 0:
                                for html_file in html_files:
                                    os.remove(html_file)
                                wrong_folder_in_uploads.rmdir()
                                print(f"✓ Removed misplaced folder with only HTML from uploads root")
                            else:
                                print(f"WARNING: Misplaced folder contains files, cannot remove: {wrong_folder_in_uploads}")
                    except Exception as e:
                        print(f"Warning: Failed to remove misplaced folder: {e}")
            
            # 親フォルダの直下を明示的にチェック
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    if parent_folder.exists() and parent_folder.is_dir():
                        misplaced_in_parent = parent_folder / new_folder_name
                        if misplaced_in_parent.exists() and misplaced_in_parent.is_dir():
                            folder_resolved = misplaced_in_parent.resolve()
                            if folder_resolved != correct_new_folder_resolved:
                                try:
                                    items = list(misplaced_in_parent.iterdir())
                                    if not items:
                                        misplaced_in_parent.rmdir()
                                        print(f"✓ Removed misplaced empty folder from parent")
                                    else:
                                        html_files = [f for f in items if f.is_file() and f.suffix.lower() == '.html']
                                        other_items = [f for f in items if f not in html_files]
                                        
                                        if len(html_files) > 0 and len(other_items) == 0:
                                            for html_file in html_files:
                                                os.remove(html_file)
                                            misplaced_in_parent.rmdir()
                                            print(f"✓ Removed misplaced folder with only HTML from parent")
                                        else:
                                            print(f"WARNING: Misplaced folder contains files, cannot remove: {misplaced_in_parent}")
                                except Exception as e:
                                    print(f"Warning: Failed to remove misplaced folder: {e}")
                            else:
                                print(f"Folder in parent is correct location, not removing")
            
            # 再帰的に検索
            misplaced_folders = []
            
            def find_misplaced_folders(base_dir: Path, depth: int = 0):
                """再帰的に誤配置されたフォルダを検索"""
                if depth > 10:
                    return
                
                try:
                    for item in base_dir.iterdir():
                        if item.is_dir():
                            if item.name == new_folder_name:
                                item_resolved = item.resolve()
                                if item_resolved != correct_new_folder_resolved:
                                    misplaced_folders.append(item)
                            
                            if item.resolve() != correct_new_folder_resolved:
                                find_misplaced_folders(item, depth + 1)
                except Exception as e:
                    print(f"Warning: Error searching for misplaced folders: {e}")
            
            find_misplaced_folders(self.media_service.uploads_dir)
            
            # 誤配置されたフォルダを削除
            for folder in misplaced_folders:
                try:
                    items = list(folder.iterdir())
                    if not items:
                        folder.rmdir()
                        print(f"✓ Removed misplaced empty folder: {folder}")
                    else:
                        html_files = [item for item in items if item.is_file() and item.suffix.lower() == '.html']
                        other_items = [item for item in items if item not in html_files]
                        
                        if len(html_files) > 0 and len(other_items) == 0:
                            for html_file in html_files:
                                os.remove(html_file)
                            folder.rmdir()
                            print(f"✓ Removed misplaced folder with only HTML: {folder}")
                        else:
                            print(f"Misplaced folder contains non-HTML files, skipping: {folder}")
                except Exception as e:
                    print(f"Warning: Failed to remove misplaced folder {folder}: {e}")
                    
        except Exception as e:
            print(f"Warning: Failed to cleanup misplaced folders after save: {e}")
            traceback.print_exc()
    
    def cleanup_orphaned_folders_in_parent(self, parent_id: Optional[int], entity_cache: Optional[Dict[int, 'PageEntity']] = None) -> None:
        """親フォルダ内のDBに存在しない孤立フォルダを削除する"""
        try:
            # 全ページを取得する代わりに、親フォルダ内のページIDだけを取得
            if parent_id:
                # 親の子ページだけを取得
                child_pages = self.repository.find_children(parent_id)
                existing_page_ids = {page.id for page in child_pages}
                # 親自身も含める
                if entity_cache and parent_id in entity_cache:
                    existing_page_ids.add(parent_id)
                elif parent_id:
                    parent_entity = self.repository.find_by_id(parent_id)
                    if parent_entity:
                        existing_page_ids.add(parent_id)
                        if entity_cache is not None:
                            entity_cache[parent_id] = parent_entity
            else:
                # ルートページをentity_cacheから取得、なければ取得
                if entity_cache:
                    root_page_ids = {eid for eid, e in entity_cache.items() if e.parent_id is None}
                    if root_page_ids:
                        existing_page_ids = root_page_ids
                    else:
                        root_pages = self.repository.find_all_root_pages()
                        existing_page_ids = {page.id for page in root_pages}
            
            parent_folder = None
            if parent_id:
                # キャッシュから親エンティティを取得、なければDBから取得
                parent_entity = None
                if entity_cache:
                    parent_entity = entity_cache.get(parent_id)
                
                if parent_entity is None:
                    parent_entity = self.repository.find_by_id(parent_id)
                    if parent_entity and entity_cache is not None:
                        entity_cache[parent_id] = parent_entity
                
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity, entity_cache)
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        parent_folder = self.media_service._find_existing_parent_folder(parent_entity, entity_cache)
            else:
                parent_folder = self.media_service.uploads_dir
            
            if not parent_folder or not parent_folder.exists() or not parent_folder.is_dir():
                return
            
            folders_to_check = list(parent_folder.iterdir())
            
            for folder_path in folders_to_check:
                if not folder_path.is_dir():
                    continue
                
                match = re.match(r'\d+_page_(\d+)_', folder_path.name)
                
                if match:
                    page_id = int(match.group(1))
                    
                    if page_id not in existing_page_ids:
                        try:
                            shutil.rmtree(folder_path)
                            print(f"✓ Cleaned up orphaned folder: {folder_path.name} (page_id={page_id} does not exist in DB)")
                        except Exception as e:
                            print(f"Warning: Failed to remove orphaned folder {folder_path.name}: {e}")
            
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned folders: {e}")
            traceback.print_exc()
