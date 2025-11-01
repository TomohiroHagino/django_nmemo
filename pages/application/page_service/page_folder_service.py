"""ページフォルダ管理サービス"""

from typing import Optional
from pathlib import Path

from ...domain.repositories import PageRepositoryInterface
from .media_service import MediaService


class PageFolderService:
    """ページフォルダの管理を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService
    ):
        self.repository = repository
        self.media_service = media_service
    
    def cleanup_old_folder(self, old_title: str, entity: 'PageEntity') -> None:
        """タイトル変更時に古いフォルダをクリーンアップ"""
        try:
            import re
            import os
            import shutil
            
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
                    
                    self.move_folder_contents(old_folder, new_folder, old_title)
                    self.remove_empty_folders(old_folder)
            
            # 念のため、uploadsディレクトリ全体から誤って作成された可能性のある古いフォルダも検索
            if old_folder and old_folder.exists():
                try:
                    self.cleanup_orphaned_old_folders(entity.id, old_folder_name, old_folder.resolve())
                except Exception as e:
                    print(f"Warning: Failed to cleanup orphaned old folders: {e}")
                    
        except Exception as e:
            print(f"Warning: Failed to cleanup old folder: {e}")
            import traceback
            traceback.print_exc()
    
    def cleanup_orphaned_old_folders(self, page_id: int, old_folder_name: str, exclude_folder: Path) -> None:
        """誤って作成された可能性のある古いフォルダをクリーンアップ"""
        import os
        import shutil
        
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
            import re
            import os
            
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
            import traceback
            traceback.print_exc()
    
    def move_folder_contents(self, old_folder: Path, new_folder: Path, old_title: str) -> None:
        """古いフォルダ内のすべてのコンテンツを新しいフォルダに移動"""
        import os
        import shutil
        
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
                            print(f"DEBUG _move_folder_contents: file={item.name}, new_path={new_path}, new_path.exists()={new_path.exists()}")
                            if not new_path.exists():
                                shutil.move(str(item), str(new_path))
                                print(f"✓ Moved file: {item.name}")
                            else:
                                print(f"⚠️ DELETE DUPLICATE IN _move_folder_contents: About to delete duplicate file {item.name} at {item}")
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
            import traceback
            traceback.print_exc()
    
    def merge_directories(self, src_dir: Path, dst_dir: Path) -> None:
        """ソースディレクトリの内容を宛先ディレクトリにマージ"""
        import shutil
        
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
    
    def rename_folder_on_order_change(self, entity: 'PageEntity', old_order: int) -> None:
        """order変更時にフォルダをリネームする"""
        try:
            import re
            
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
                            return
                    
                    parent_folder_path = self.media_service.get_page_folder_path(parent_entity)
                    old_folder_path_str = str(parent_folder_path / old_folder_name).replace('\\', '/')
                    new_folder_path_str = str(parent_folder_path / new_folder_name).replace('\\', '/')
                    
                    old_folder = parent_folder / old_folder_name
                    new_folder = parent_folder / new_folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}")
                    return
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
            import traceback
            traceback.print_exc()
            return None, None
    
    def move_folder_to_new_parent(self, entity: 'PageEntity', old_parent_id: Optional[int]) -> None:
        """親が変わった場合にフォルダを古い親から新しい親に移動する"""
        try:
            import re
            
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            
            old_parent_folder = None
            old_folder = None
            if old_parent_id:
                old_parent_entity = self.repository.find_by_id(old_parent_id)
                if old_parent_entity:
                    old_parent_folder = self.media_service._get_page_folder_absolute_path(old_parent_entity)
                    if not old_parent_folder.exists() or not old_parent_folder.is_dir():
                        old_parent_folder = self.media_service._find_existing_parent_folder(old_parent_entity)
                
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
                new_parent_entity = self.repository.find_by_id(entity.parent_id)
                if new_parent_entity:
                    new_parent_folder = self.media_service._get_page_folder_absolute_path(new_parent_entity)
                    if not new_parent_folder.exists() or not new_parent_folder.is_dir():
                        new_parent_folder = self.media_service._find_existing_parent_folder(new_parent_entity)
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
            import traceback
            traceback.print_exc()
    
    def cleanup_orphaned_folders_in_parent(self, parent_id: Optional[int]) -> None:
        """親フォルダ内のDBに存在しない孤立フォルダを削除する"""
        try:
            import re
            import shutil
            
            all_pages = self.repository.find_all_pages()
            existing_page_ids = {page.id for page in all_pages}
            
            parent_folder = None
            if parent_id:
                parent_entity = self.repository.find_by_id(parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        parent_folder = self.media_service._find_existing_parent_folder(parent_entity)
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
            import traceback
            traceback.print_exc()
