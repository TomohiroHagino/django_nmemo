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
        self.media_service = media_service or MediaService(repository)  # repositoryを渡す
        # html_generatorにmedia_serviceを渡す
        self.html_generator = html_generator or HtmlGenerator(media_service=self.media_service)
    
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
        
        # 一時フォルダからページ専用フォルダへ画像を移動（entityを渡す）
        saved_entity.content = self.media_service.move_temp_images_to_page_folder(
            saved_entity.id,
            saved_entity.content,
            entity=saved_entity
        )
        if saved_entity.content != dto.content:
            saved_entity = self.repository.save(saved_entity)
        
        # ページフォルダにHTMLファイルを保存
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
        old_title = entity.title  # 古いタイトルを保存
        
        aggregate = PageAggregate.from_entity_tree(entity)
        aggregate.update_title(dto.title)
        
        # 作成されたフォルダを追跡（エラー時のロールバック用）
        created_folders = []
        
        try:
            # タイトルを更新したentityを作成（move_temp_images_to_page_folderで使用）
            updated_entity = DtoConverter.aggregate_to_entity(aggregate)
            
            # 更新前に一時画像をページフォルダへ移動（タイトル更新後のentityを使用）
            updated_content = self.media_service.move_temp_images_to_page_folder(
                dto.page_id,
                dto.content,
                entity=updated_entity  # タイトル更新後のentityを使用
            )
            aggregate.update_content(updated_content)
            
            # フォルダが作成されたかチェック（move_temp_images_to_page_folder内で作成される）
            if updated_entity:
                # get_page_folder_pathを使わず、実際のフォルダパスを計算
                if updated_entity.parent_id:
                    parent_entity = self.repository.find_by_id(updated_entity.parent_id)
                    if parent_entity:
                        # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                        parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', updated_entity.title)
                        folder_name = f'{updated_entity.order}_page_{updated_entity.id}_{safe_title}'
                        page_folder = parent_folder / folder_name
                    else:
                        page_folder = None
                else:
                    # ルートページの場合
                    safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', updated_entity.title)
                    folder_name = f'{updated_entity.order}_page_{updated_entity.id}_{safe_title}'
                    page_folder = self.media_service.uploads_dir / folder_name
                
                if page_folder and page_folder.exists() and page_folder.is_dir():
                    # フォルダが空かどうかをチェック（新規作成の可能性がある）
                    if not any(page_folder.iterdir()):
                        created_folders.append(page_folder)
            
            # エンティティに変換して保存
            entity = DtoConverter.aggregate_to_entity(aggregate)
            saved_entity = self.repository.save(entity)
            
            # 画像削除処理
            self.media_service.delete_removed_media(dto.page_id, old_content, updated_content)
            self.media_service.delete_orphaned_media(dto.page_id, updated_content)
            
            # タイトルが変更された場合の処理（フォルダ操作は例外が発生しても続行）
            if old_title != saved_entity.title:
                try:
                    # 親フォルダを先に明示的に作成してから、子フォルダを作成
                    if saved_entity.parent_id:
                        parent_entity = self.repository.find_by_id(saved_entity.parent_id)
                        if parent_entity:
                            # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                            parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                            
                            # 親フォルダが存在しない場合はエラー（空フォルダを作成しない）
                            if not parent_folder.exists() or not parent_folder.is_dir():
                                raise ValueError(f'親ページ（ID: {saved_entity.parent_id}）のフォルダが存在しません。親ページを先に保存してください。')
                            
                            # 子フォルダ名を計算
                            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', saved_entity.title)
                            folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{safe_title}'
                            
                            # 正しい階層構造で子フォルダを作成（親フォルダの直下）
                            new_folder = parent_folder / folder_name
                            if not new_folder.exists():
                                new_folder.mkdir(parents=False, exist_ok=True)
                                created_folders.append(new_folder)
                        else:
                            # 親が見つからない場合（通常は発生しない）
                            # get_page_folder_pathを使わず、子フォルダ名を直接計算してエラーを発生させる
                            raise ValueError(f'親ページ（ID: {saved_entity.parent_id}）が見つかりません。')
                    else:
                        # ルートページの場合
                        # get_page_folder_pathを使わず、子フォルダ名を直接計算
                        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', saved_entity.title)
                        folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{safe_title}'
                        new_folder = self.media_service.uploads_dir / folder_name
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                            created_folders.append(new_folder)
                    
                    # 親フォルダの直下に誤作成フォルダを削除（事前に）
                    if saved_entity.parent_id:
                        parent_entity = self.repository.find_by_id(saved_entity.parent_id)
                        if parent_entity:
                            # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                            parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                            
                            if parent_folder.exists() and parent_folder.is_dir():
                                # 古いフォルダ名
                                old_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', old_title)
                                old_folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{old_safe_title}'
                                old_folder_in_parent = parent_folder / old_folder_name
                                
                                # 新しいフォルダ名
                                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', saved_entity.title)
                                new_folder_name = f'{saved_entity.order}_page_{saved_entity.id}_{safe_title}'
                                new_folder_in_parent = parent_folder / new_folder_name
                                
                                # 誤って作成された古いフォルダを削除
                                if old_folder_in_parent.exists() and old_folder_in_parent.is_dir():
                                    old_resolved = old_folder_in_parent.resolve()
                                    new_resolved = new_folder.resolve()
                                    if old_resolved != new_resolved:
                                        print(f"DEBUG: Removing old folder from parent: {old_folder_in_parent}")
                                        try:
                                            self._move_folder_contents(old_folder_in_parent, new_folder, old_title)
                                            self._remove_empty_folders(old_folder_in_parent)
                                        except Exception as e:
                                            print(f"Warning: Failed to move old folder: {e}")
                                
                                # 誤って作成された新しいフォルダを削除（正しい場所でない場合）
                                if new_folder_in_parent.exists() and new_folder_in_parent.is_dir():
                                    folder_resolved = new_folder_in_parent.resolve()
                                    correct_resolved = new_folder.resolve()
                                    if folder_resolved != correct_resolved:
                                        print(f"DEBUG: Removing misplaced new folder from parent: {new_folder_in_parent}")
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
                    
                    # 古いフォルダから新しいフォルダへ移動（階層構造全体を検索）
                    self._cleanup_old_folder(old_title, saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to handle folder rename for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
            
            # HTMLファイルを保存（例外が発生しても続行）
            try:
                self.html_generator.save_html_to_folder(saved_entity)
            except Exception as e:
                print(f"Warning: Failed to save HTML file for page {saved_entity.id}: {e}")
                import traceback
                traceback.print_exc()
            
            # タイトルが変更された場合、親階層に誤って作成されたフォルダを削除（例外が発生しても続行）
            if old_title != saved_entity.title:
                try:
                    self._cleanup_misplaced_folders_after_save(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to cleanup misplaced folders for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
            
            # 成功したら、作成したフォルダのリストをクリア
            created_folders.clear()
            
            return DtoConverter.entity_to_dto(saved_entity)
            
        except Exception as e:
            # エラーが発生した場合、作成した空フォルダを削除
            print(f"ERROR: Failed to update page {dto.page_id}: {e}")
            import traceback
            traceback.print_exc()
            
            # 作成したフォルダを削除（空のフォルダのみ）
            for folder in created_folders:
                try:
                    if folder.exists() and folder.is_dir():
                        # フォルダが空かどうかをチェック
                        items = list(folder.iterdir())
                        if not items:
                            folder.rmdir()
                            print(f"✓ Rolled back: Removed empty folder {folder}")
                        else:
                            # フォルダにファイルがある場合は、親階層のフォルダもチェック
                            # 親フォルダが空の場合のみ削除
                            parent_folder = folder.parent
                            if parent_folder.exists() and parent_folder.is_dir():
                                parent_items = list(parent_folder.iterdir())
                                if not parent_items or all(item == folder for item in parent_items):
                                    # 親フォルダが空、またはこのフォルダのみの場合
                                    if not items or all(f.is_file() and f.suffix.lower() == '.html' for f in items):
                                        # HTMLファイルのみの場合は削除を試みる
                                        for item in items:
                                            if item.is_file():
                                                os.remove(item)
                                        folder.rmdir()
                                        # 親フォルダも空の場合は削除
                                        if not list(parent_folder.iterdir()):
                                            parent_folder.rmdir()
                                        print(f"✓ Rolled back: Removed folder {folder} and empty parent")
                except Exception as cleanup_error:
                    print(f"Warning: Failed to rollback folder {folder}: {cleanup_error}")
            
            # エラーを再スロー
            raise

    def _cleanup_old_folder(self, old_title: str, entity: 'PageEntity') -> None:
        """タイトル変更時に古いフォルダをクリーンアップ"""
        try:
            import re
            import os
            import shutil
            from pathlib import Path
            
            # 古いフォルダ名を計算
            old_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', old_title)
            old_folder_name = f'{entity.order}_page_{entity.id}_{old_safe_title}'
            
            # 新しいフォルダパスを取得（repositoryが正しく設定されていることを確認）
            # 親ページのパスを明示的に取得して階層パスを構築
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    # 親フォルダが存在することを確認
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        print(f"ERROR: Parent folder does not exist for page {entity.id}")
                        return
                    
                    # 子フォルダ名を直接計算
                    safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
                    folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                    
                    # 親フォルダの直下の子フォルダパスを作成
                    new_folder = parent_folder / folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}, parent_id={entity.parent_id}")
                    return
            else:
                # ルートページの場合
                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
                folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                new_folder = self.media_service.uploads_dir / folder_name
            
            # 階層構造を考慮して古いフォルダパスを正確に計算
            old_folder = None
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    # 親フォルダが存在することを確認
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
                        # 親フォルダは既に存在することを確認済みなので、parents=Falseで子フォルダのみ作成
                        new_folder.mkdir(parents=False, exist_ok=True)
                    
                    self._move_folder_contents(old_folder, new_folder, old_title)
                    self._remove_empty_folders(old_folder)
            
            # 念のため、uploadsディレクトリ全体から誤って作成された可能性のある古いフォルダも検索
            if old_folder and old_folder.exists():
                try:
                    self._cleanup_orphaned_old_folders(entity.id, old_folder_name, old_folder.resolve())
                except Exception as e:
                    print(f"Warning: Failed to cleanup orphaned old folders: {e}")
                    
        except Exception as e:
            print(f"Warning: Failed to cleanup old folder: {e}")
            import traceback
            traceback.print_exc()
    
    def _cleanup_orphaned_old_folders(self, page_id: int, old_folder_name: str, exclude_folder: Path) -> None:
        """誤って作成された可能性のある古いフォルダをクリーンアップ"""
        import os
        import shutil
        from pathlib import Path
        
        try:
            # uploadsディレクトリ全体を検索
            for root, dirs, files in os.walk(self.media_service.uploads_dir):
                root_path = Path(root)
                
                for dir_name in dirs[:]:  # コピーを作成してイテレート中に変更可能に
                    # page_idを含むフォルダ名をチェック
                    if f'_page_{page_id}_' in dir_name or dir_name.endswith(f'_page_{page_id}'):
                        folder_path = root_path / dir_name
                        folder_resolved = folder_path.resolve()
                        
                        # 除外フォルダ（正しい場所の古いフォルダ）以外を処理
                        if folder_resolved != exclude_folder:
                            # 正確なフォルダ名に一致する場合のみ処理
                            if dir_name == old_folder_name:
                                # フォルダが空かチェック
                                try:
                                    items = list(folder_path.iterdir())
                                    if not items:
                                        # 空のフォルダは削除
                                        folder_path.rmdir()
                                        print(f"✓ Removed orphaned empty folder: {folder_path}")
                                except Exception as e:
                                    print(f"Warning: Failed to check/remove orphaned folder {folder_path}: {e}")
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned old folders: {e}")

    def _cleanup_misplaced_new_folder(self, entity: 'PageEntity', correct_new_folder: Path) -> None:
        """親階層に誤って作成された新しいフォルダ名のフォルダを削除"""
        import re
        import os
        from pathlib import Path
        
        try:
            # 新しいフォルダ名を計算
            new_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            new_folder_name = f'{entity.order}_page_{entity.id}_{new_safe_title}'
            
            # 親フォルダのパスを取得
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if not parent_entity:
                return
            
            # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
            parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
            
            # 正しい新しいフォルダのパス
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            new_folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            correct_new_folder_path = parent_folder / new_folder_name
            
            # uploadsディレクトリ全体から新しいフォルダ名を検索
            for root, dirs, files in os.walk(self.media_service.uploads_dir):
                root_path = Path(root)
                
                for dir_name in dirs:
                    # 新しいフォルダ名に一致するものを検索
                    if dir_name == new_folder_name:
                        folder_path = root_path / dir_name
                        folder_resolved = folder_path.resolve()
                        
                        # 正しい場所のフォルダ以外を処理（誤って作成されたフォルダ）
                        if folder_resolved != correct_new_folder.resolve() and folder_resolved != correct_new_folder_path.resolve():
                            try:
                                items = list(folder_path.iterdir())
                                if not items:
                                    # 空のフォルダは削除
                                    folder_path.rmdir()
                                    print(f"✓ Removed misplaced empty folder: {folder_path}")
                                else:
                                    # HTMLファイルのみの場合は削除を試みる
                                    html_files = [item for item in items if item.is_file() and item.suffix.lower() == '.html']
                                    other_items = [item for item in items if item not in html_files]
                                    
                                    if len(html_files) > 0 and len(other_items) == 0:
                                        # HTMLファイルのみの場合は削除
                                        for html_file in html_files:
                                            os.remove(html_file)
                                        folder_path.rmdir()
                                        print(f"✓ Removed misplaced folder with only HTML: {folder_path}")
                            except Exception as e:
                                print(f"Warning: Failed to check/remove misplaced folder {folder_path}: {e}")
        except Exception as e:
            print(f"Warning: Failed to cleanup misplaced new folder: {e}")
    
    def _move_folder_contents(self, old_folder: Path, new_folder: Path, old_title: str) -> None:
        """古いフォルダ内のすべてのコンテンツを新しいフォルダに移動"""
        import re
        import os
        import shutil
        
        try:
            if not new_folder.exists():
                # 親フォルダは既に存在しているはずなので、parents=Falseで子フォルダのみ作成
                new_folder.mkdir(parents=False, exist_ok=True)
            
            items_to_process = list(old_folder.iterdir())
            
            for item in items_to_process:
                if item.is_file():
                    if item.suffix.lower() == '.html':
                        # HTMLファイルは削除（新しいフォルダに既に作成されているため）
                        try:
                            os.remove(item)
                            print(f"✓ Deleted old HTML file: {item.name}")
                        except Exception as e:
                            print(f"✗ Warning: Failed to delete HTML file {item.name}: {e}")
                    else:
                        # メディアファイルを新しいフォルダに移動
                        try:
                            new_path = new_folder / item.name
                            if not new_path.exists():
                                shutil.move(str(item), str(new_path))
                                print(f"✓ Moved file: {item.name}")
                            else:
                                # 既に存在する場合は古いファイルを削除
                                os.remove(item)
                                print(f"✓ Removed duplicate file: {item.name}")
                        except Exception as e:
                            print(f"✗ Warning: Failed to move/delete file {item.name}: {e}")
                elif item.is_dir():
                    # サブディレクトリは新しいフォルダ内に移動（子ページのフォルダ）
                    try:
                        new_subfolder = new_folder / item.name
                        if not new_subfolder.exists():
                            shutil.move(str(item), str(new_subfolder))
                            print(f"✓ Moved subdirectory: {item.name}")
                        else:
                            # 既に存在する場合は、中身をマージ
                            print(f"DEBUG: Merging subdirectory: {item.name}")
                            self._merge_directories(item, new_subfolder)
                            # 空になったら削除
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
    
    def _merge_directories(self, src_dir: Path, dst_dir: Path) -> None:
        """ソースディレクトリの内容を宛先ディレクトリにマージ"""
        import os
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
                        self._merge_directories(item, dst_item)
                        try:
                            if not any(item.iterdir()):
                                item.rmdir()
                        except:
                            pass
        except Exception as e:
            print(f"Warning: Failed to merge directories: {e}")
    
    def _remove_empty_folders(self, folder: Path) -> None:
        """空になったフォルダを再帰的に削除"""
        import os
        
        try:
            if not folder.exists() or not folder.is_dir():
                return
            
            # サブディレクトリを再帰的に処理
            for item in list(folder.iterdir()):
                if item.is_dir():
                    self._remove_empty_folders(item)
            
            # 空になったら削除
            try:
                remaining_items = list(folder.iterdir())
                if not remaining_items:
                    folder.rmdir()
                    print(f"✓ Removed empty folder: {folder}")
                else:
                    print(f"DEBUG: Folder still contains items: {folder} - {[item.name for item in remaining_items]}")
            except Exception as e:
                # 削除できない場合は無視（まだファイルがある可能性）
                print(f"DEBUG: Could not remove folder {folder}: {e}")
        except Exception as e:
            print(f"Warning: Failed to remove empty folders: {e}")

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

    def _cleanup_misplaced_folders_after_save(self, entity: 'PageEntity') -> None:
        """保存後に親階層に誤って作成されたフォルダを削除"""
        try:
            import re
            import os
            from pathlib import Path
            
            # 新しいフォルダ名を計算
            new_safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            new_folder_name = f'{entity.order}_page_{entity.id}_{new_safe_title}'
            
            # 正しい新しいフォルダのパスを取得
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    correct_new_folder_path = parent_folder / new_folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}")
                    return
            else:
                correct_new_folder_path = Path(new_folder_name)
            
            correct_new_folder = self.media_service.uploads_dir / correct_new_folder_path
            correct_new_folder_resolved = correct_new_folder.resolve()
            
            print(f"DEBUG: Checking for misplaced folders after save")
            print(f"DEBUG: New folder name: {new_folder_name}")
            print(f"DEBUG: Correct new folder path: {correct_new_folder_path}")
            print(f"DEBUG: Correct new folder resolved: {correct_new_folder_resolved}")
            
            # uploads直下に誤って作成されたフォルダをチェック（最重要）
            wrong_folder_in_uploads = self.media_service.uploads_dir / new_folder_name
            if wrong_folder_in_uploads.exists() and wrong_folder_in_uploads.is_dir():
                wrong_resolved = wrong_folder_in_uploads.resolve()
                if wrong_resolved != correct_new_folder_resolved:
                    print(f"DEBUG: Found misplaced folder in uploads root: {wrong_folder_in_uploads}")
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
                    # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    if parent_folder.exists() and parent_folder.is_dir():
                        misplaced_in_parent = parent_folder / new_folder_name
                        if misplaced_in_parent.exists() and misplaced_in_parent.is_dir():
                            folder_resolved = misplaced_in_parent.resolve()
                            if folder_resolved != correct_new_folder_resolved:
                                print(f"DEBUG: Found misplaced folder in parent directory: {misplaced_in_parent}")
                                print(f"DEBUG: Misplaced resolved: {folder_resolved}")
                                print(f"DEBUG: Correct resolved: {correct_new_folder_resolved}")
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
                                print(f"DEBUG: Folder in parent is correct location, not removing")
            
            # 再帰的に検索（念のため）- ただし正しいフォルダは削除しない
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
                                    print(f"DEBUG: Found misplaced folder: {item} (should be at {correct_new_folder_resolved})")
                            
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
                            print(f"DEBUG: Misplaced folder contains non-HTML files, skipping: {folder}")
                except Exception as e:
                    print(f"Warning: Failed to remove misplaced folder {folder}: {e}")
                    
        except Exception as e:
            print(f"Warning: Failed to cleanup misplaced folders after save: {e}")
            import traceback
            traceback.print_exc()
