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
            
            try:
                self.html_generator.save_html_to_folder(saved_entity)
            except Exception as e:
                error_msg = f"Warning: Failed to save HTML file for page {saved_entity.id}: {e}"
                print(error_msg)
                import traceback
                traceback.print_exc()  # スタックトレースを出力
                # エラーを記録するが、処理は続行（データベースの保存は成功しているため）
            
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
                        # HTMLファイルも移動する（後でsave_html_to_folderが呼ばれて更新されるが、
                        # 移動時にファイルが存在しないと不整合が生じる可能性があるため）
                        try:
                            new_path = new_folder / item.name
                            # 移動先に既に同じ名前のHTMLファイルがある場合は上書き
                            if new_path.exists():
                                os.remove(new_path)
                            shutil.move(str(item), str(new_path))
                            print(f"✓ Moved HTML file: {item.name}")
                        except Exception as e:
                            print(f"✗ Warning: Failed to move HTML file {item.name}: {e}")
                    else:
                        # メディアファイルを新しいフォルダに移動
                        try:
                            new_path = new_folder / item.name
                            print(f"DEBUG _move_folder_contents: file={item.name}, new_path={new_path}, new_path.exists()={new_path.exists()}")
                            if not new_path.exists():
                                shutil.move(str(item), str(new_path))
                                print(f"✓ Moved file: {item.name}")
                            else:
                                # 既に存在する場合は古いファイルを削除
                                print(f"⚠️ DELETE DUPLICATE IN _move_folder_contents: About to delete duplicate file {item.name} at {item}")
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
            import traceback
            traceback.print_exc()
    
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
            except Exception as e:
                # 削除できない場合は無視（まだファイルがある可能性）
                pass
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
        old_parent_id = entity.parent_id  # 古い親IDを保存
        parent_changed = entity.parent_id != new_parent_id
        
        if parent_changed:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
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
        
        # 親が変わった場合、フォルダを古い親から新しい親に移動
        if parent_changed:
            try:
                self._move_folder_to_new_parent(saved_entity, old_parent_id)
            except Exception as e:
                print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                import traceback
                traceback.print_exc()
        
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
        old_parent_id = entity.parent_id  # 古い親IDを保存
        parent_changed = entity.parent_id != new_parent_id
        
        if parent_changed:
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
        
        # ターゲットページをsiblings_entitiesに確実に含める
        # （ターゲットページが既に移動先の親の下にある場合）
        target_in_siblings = any(s.id == target_page_id for s in siblings_entities)
        if not target_in_siblings:
            # ターゲットページがsiblingsに含まれていない場合は追加
            siblings_entities.append(target_entity)
        
        # 古いorder値を保存（フォルダリネーム用）
        # 移動先の親の兄弟ページと移動対象のページのorderを保存
        # これらは順序変更で影響を受ける可能性があるすべてのページ
        old_orders = {}
        all_pages_to_check = [entity] + siblings_entities
        for page_entity in all_pages_to_check:
            old_orders[page_entity.id] = page_entity.order
        
        # PageAggregateに変換
        aggregate = PageAggregate.from_entity_tree(entity)
        siblings = [PageAggregate.from_entity_tree(s) for s in siblings_entities]
        
        # 移動対象のページの親を変更
        aggregate.parent_id = target_parent_id
        aggregate.updated_at = datetime.now()
        
        # 並び順を変更（ターゲットページの前後に挿入）
        # aggregate.reorderは自分自身をsiblingsから除外するので、ここではsiblingsに自分自身は含めない
        updated_siblings = aggregate.reorder(target_page_id, position, siblings)
        
        # 移動対象のページのparent_idを確実に更新（aggregate.reorder()の後で再設定）
        # updated_siblingsに含まれる移動対象のページのparent_idを更新
        for sibling in updated_siblings:
            if sibling.id == page_id:
                sibling.parent_id = target_parent_id
        
        # aggregateのparent_idも確実に更新（updated_siblingsに含まれていない場合に備えて）
        aggregate.parent_id = target_parent_id
        
        # updated_siblingsに含まれるすべてのページの古いorderを確実に保存
        # aggregate.reorderによって順序が変更される可能性があるすべてのページのorderを保存する
        for sibling in updated_siblings:
            if sibling.id not in old_orders:
                # データベースから現在のorderを取得（保存前の状態）
                current_entity = self.repository.find_by_id(sibling.id)
                if current_entity:
                    old_orders[sibling.id] = current_entity.order
                else:
                    # siblings_entitiesから探す（まだ保存されていない状態のエンティティ）
                    for s in siblings_entities:
                        if s.id == sibling.id:
                            old_orders[sibling.id] = s.order
                            break
        
        # 移動対象のページも確実にold_ordersに含める
        if page_id not in old_orders:
            old_orders[page_id] = entity.order
        
        # すべての兄弟ページを保存（順序が更新されたものすべて）
        for sibling in updated_siblings:
            # 移動対象のページの場合、parent_idを確実に更新（念のため再度確認）
            if sibling.id == page_id:
                sibling.parent_id = target_parent_id
            
            sibling_entity = DtoConverter.aggregate_to_entity(sibling)
            self.repository.save(sibling_entity)
        
        # 移動したページも追加（updated_siblingsに含まれていない場合）
        if not any(s.id == page_id for s in updated_siblings):
            updated_siblings.append(aggregate)
            saved_entity = DtoConverter.aggregate_to_entity(aggregate)
            self.repository.save(saved_entity)
        
        # 親が変わった場合、移動対象のページのフォルダを古い親から新しい親に移動
        if parent_changed:
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity:
                try:
                    self._move_folder_to_new_parent(saved_entity, old_parent_id)
                except Exception as e:
                    print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        # すべての影響を受けたページのフォルダをリネーム（orderが変更された場合）
        # updated_siblingsに含まれるすべてのページについて、orderが変更されていればフォルダをリネーム
        for sibling in updated_siblings:
            # データベースから最新の状態を取得
            saved_entity = self.repository.find_by_id(sibling.id)
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                # orderが変更された場合、フォルダをリネーム
                if old_order != saved_entity.order:
                    try:
                        self._rename_folder_on_order_change(saved_entity, old_order)
                        # このページのコンテンツ内のURLを更新
                        self._update_content_urls_for_page(saved_entity.id)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for page {saved_entity.id} during reorder: {e}")
                        import traceback
                        traceback.print_exc()
        
        # 移動したページがupdated_siblingsに含まれていない場合も処理
        if not any(s.id == page_id for s in updated_siblings):
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    try:
                        self._rename_folder_on_order_change(saved_entity, old_order)
                        # このページのコンテンツ内のURLを更新
                        self._update_content_urls_for_page(saved_entity.id)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for moved page {saved_entity.id}: {e}")
                        import traceback
                        traceback.print_exc()
        
        # orderが変更されたページを参照している他のページのコンテンツも更新
        # （子ページが親ページのフォルダパスを含む場合に対応）
        affected_page_ids = set()
        for sibling in updated_siblings:
            if sibling.id in old_orders and old_orders[sibling.id] != sibling.order:
                affected_page_ids.add(sibling.id)
        if page_id in old_orders:
            old_order = old_orders[page_id]
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity and old_order != saved_entity.order:
                affected_page_ids.add(page_id)
        
        # 影響を受けたページのIDを含むURLを持つすべてのページのコンテンツを更新
        if affected_page_ids:
            self._update_all_pages_content_urls(affected_page_ids)
        
        # すべての影響を受けたページのHTMLファイルを更新
        # updated_siblingsに含まれるすべてのページを処理
        for sibling in updated_siblings:
            saved_entity = self.repository.find_by_id(sibling.id)
            if saved_entity:
                try:
                    self.html_generator.save_html_to_folder(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for page {saved_entity.id} during reorder: {e}")
                    import traceback
                    traceback.print_exc()
        
        # 移動したページがupdated_siblingsに含まれていない場合もHTMLファイルを更新
        if not any(s.id == page_id for s in updated_siblings):
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity:
                try:
                    self.html_generator.save_html_to_folder(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for moved page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        # DBに存在しない孤立フォルダをクリーンアップ（影響を受けた親フォルダ内）
        try:
            self._cleanup_orphaned_folders_in_parent(target_parent_id)
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
            # 移動対象のページが含まれている場合は、そのページを除外して最大値を計算
            if exclude_page_id is not None:
                filtered_siblings = [s for s in siblings if s.id != exclude_page_id]
                return max((child.order for child in filtered_siblings), default=0)
            return max((child.order for child in siblings), default=0)
        return 0

    def _rename_folder_on_order_change(self, entity: 'PageEntity', old_order: int) -> None:
        """order変更時にフォルダをリネームする"""
        try:
            import re
            import os
            import shutil
            from pathlib import Path
            from pages.models import Page
            
            # 古いフォルダ名と新しいフォルダ名を計算（タイトルは変更されていない）
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            old_folder_name = f'{old_order}_page_{entity.id}_{safe_title}'
            new_folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            
            # 古いフォルダパスと新しいフォルダパスを計算（URL更新用）
            old_folder_path = None
            new_folder_path = None
            
            # 新しいフォルダパスを取得
            if entity.parent_id:
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    
                    # 親フォルダが存在しない場合は、既存のフォルダを検索
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        existing_parent_folder = self.media_service._find_existing_parent_folder(parent_entity)
                        if existing_parent_folder:
                            parent_folder = existing_parent_folder
                        else:
                            print(f"ERROR: Parent folder does not exist for page {entity.id}")
                            return
                    
                    # 階層パスを構築（URL用）
                    parent_folder_path = self.media_service.get_page_folder_path(parent_entity)
                    old_folder_path_str = str(parent_folder_path / old_folder_name).replace('\\', '/')
                    new_folder_path_str = str(parent_folder_path / new_folder_name).replace('\\', '/')
                    
                    old_folder = parent_folder / old_folder_name
                    new_folder = parent_folder / new_folder_name
                else:
                    print(f"ERROR: Parent entity not found for page {entity.id}")
                    return
            else:
                # ルートページの場合
                old_folder_path_str = old_folder_name
                new_folder_path_str = new_folder_name
                
                old_folder = self.media_service.uploads_dir / old_folder_name
                new_folder = self.media_service.uploads_dir / new_folder_name
            
            # 古いフォルダが存在し、新しいフォルダと異なる場合
            if old_folder.exists() and old_folder.is_dir():
                old_folder_resolved = old_folder.resolve()
                new_folder_resolved = new_folder.resolve()
                
                if old_folder_resolved != new_folder_resolved:
                    # 既存のフォルダを検索して、実際の場所を確認
                    existing_folder = self.media_service._find_existing_page_folder(entity)
                    if existing_folder:
                        existing_resolved = existing_folder.resolve()
                        # 既存フォルダが古いフォルダと同じ場合のみリネーム
                        if existing_resolved == old_folder_resolved:
                            if not new_folder.exists():
                                new_folder.mkdir(parents=False, exist_ok=True)
                            
                            self._move_folder_contents(old_folder, new_folder, entity.title)
                            self._remove_empty_folders(old_folder)
                            
                            # コンテンツ内のURLを更新
                            self._update_content_urls_after_rename(entity.id, old_folder_path_str, new_folder_path_str)
                        elif existing_resolved != new_folder_resolved:
                            # 既存フォルダが別の場所にある場合、そこから新しい場所へ移動
                            if not new_folder.exists():
                                new_folder.mkdir(parents=False, exist_ok=True)
                            self._move_folder_contents(existing_folder, new_folder, entity.title)
                            self._remove_empty_folders(existing_folder)
                            
                            # 既存フォルダのパスを計算してコンテンツ内のURLを更新
                            existing_folder_relative = existing_folder.relative_to(self.media_service.uploads_dir)
                            existing_folder_path_str = str(existing_folder_relative).replace('\\', '/')
                            self._update_content_urls_after_rename(entity.id, existing_folder_path_str, new_folder_path_str)
                    else:
                        # 既存フォルダが見つからない場合、古いフォルダから新しいフォルダへ移動
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                        self._move_folder_contents(old_folder, new_folder, entity.title)
                        self._remove_empty_folders(old_folder)
                        
                        # コンテンツ内のURLを更新
                        self._update_content_urls_after_rename(entity.id, old_folder_path_str, new_folder_path_str)
            else:
                # 古いフォルダが見つからない場合、既存のフォルダを検索して新しい場所へ移動
                existing_folder = self.media_service._find_existing_page_folder(entity)
                if existing_folder:
                    existing_resolved = existing_folder.resolve()
                    new_folder_resolved = new_folder.resolve()
                    
                    if existing_resolved != new_folder_resolved:
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                        self._move_folder_contents(existing_folder, new_folder, entity.title)
                        self._remove_empty_folders(existing_folder)
                        
                        # 既存フォルダのパスを計算してコンテンツ内のURLを更新
                        existing_folder_relative = existing_folder.relative_to(self.media_service.uploads_dir)
                        existing_folder_path_str = str(existing_folder_relative).replace('\\', '/')
                        self._update_content_urls_after_rename(entity.id, existing_folder_path_str, new_folder_path_str)
            
        except Exception as e:
            print(f"Warning: Failed to rename folder on order change: {e}")
            import traceback
            traceback.print_exc()
    
    def _update_content_urls_after_rename(self, page_id: int, old_folder_path: str, new_folder_path: str) -> None:
        """フォルダリネーム後にコンテンツ内のURLを更新"""
        try:
            import re
            from pages.models import Page
            
            page = Page.objects.get(id=page_id)
            if not page.content:
                return
            
            # update_content_urls.pyの_update_urls_in_contentと同じロジックを使用
            # ページIDベースでパターンマッチを行う（より確実）
            # パターン1: /media/uploads/page_{id}/filename（古い形式）
            pattern1 = re.compile(
                rf'/media/uploads/page_{page_id}/([^"\'>\s]+)',
                re.IGNORECASE
            )
            
            # パターン2: /media/uploads/{任意のorder}_page_{id}_{タイトル}/filename（現在の形式）
            # 階層構造にも対応するため、パス全体をマッチさせる
            pattern2 = re.compile(
                rf'/media/uploads/([^/]+/)*\d+_page_{page_id}_[^/]+/([^"\'>\s]+)',
                re.IGNORECASE
            )
            
            old_content = page.content
            updated_content = old_content
            
            # パターン1を置換（古い形式）
            def replace_url1(match):
                filename = match.group(1)
                return f'/media/uploads/{new_folder_path}/{filename}'
            
            updated_content = pattern1.sub(replace_url1, updated_content)
            
            # パターン2を置換（現在の形式）
            def replace_url2(match):
                filename = match.group(2)  # 最後のグループがファイル名
                return f'/media/uploads/{new_folder_path}/{filename}'
            
            updated_content = pattern2.sub(replace_url2, updated_content)
            
            # 階層構造内のページの場合、親パスを含むパターンもチェック
            # パターン3: /media/uploads/{親パス}/{任意のorder}_page_{id}_{タイトル}/filename
            # これはパターン2で既にカバーされているが、念のため明示的に処理
            
            # 変更があった場合は保存
            if old_content != updated_content:
                page.content = updated_content
                page.save(update_fields=['content'])
                print(f"✓ Updated content URLs for page {page_id}: {old_folder_path} -> {new_folder_path}")
            else:
                # デバッグ用：変更がない場合でもログを出力
                print(f"  No URL changes needed for page {page_id} (old: {old_folder_path}, new: {new_folder_path})")
            
        except Page.DoesNotExist:
            print(f"Warning: Page {page_id} not found when updating content URLs")
        except Exception as e:
            print(f"Warning: Failed to update content URLs for page {page_id}: {e}")
            import traceback
            traceback.print_exc()

    def _update_content_urls_for_page(self, page_id: int) -> None:
        """指定されたページのコンテンツ内のURLを現在のフォルダパスに更新"""
        try:
            entity = self.repository.find_by_id(page_id)
            if not entity:
                return
            
            from pages.models import Page
            page = Page.objects.get(id=page_id)
            if not page.content:
                return
            
            # 現在の正しいフォルダパスを取得
            current_folder_path = self.media_service.get_page_folder_path(entity)
            folder_path_str = str(current_folder_path).replace('\\', '/')
            
            # update_content_urls.pyの_update_urls_in_contentと同じロジック
            import re
            
            # パターン1: /media/uploads/page_{id}/filename
            pattern1 = re.compile(
                rf'/media/uploads/page_{page_id}/([^"\'>\s]+)',
                re.IGNORECASE
            )
            
            # パターン2: /media/uploads/{任意のパス}/{任意のorder}_page_{id}_{タイトル}/filename
            pattern2 = re.compile(
                rf'/media/uploads/([^/]+/)*\d+_page_{page_id}_[^/]+/([^"\'>\s]+)',
                re.IGNORECASE
            )
            
            old_content = page.content
            updated_content = old_content
            
            def replace_url1(match):
                filename = match.group(1)
                return f'/media/uploads/{folder_path_str}/{filename}'
            
            def replace_url2(match):
                filename = match.group(2)
                return f'/media/uploads/{folder_path_str}/{filename}'
            
            updated_content = pattern1.sub(replace_url1, updated_content)
            updated_content = pattern2.sub(replace_url2, updated_content)
            
            if old_content != updated_content:
                page.content = updated_content
                page.save(update_fields=['content'])
                print(f"✓ Updated content URLs for page {page_id} to current folder path: {folder_path_str}")
            
        except Exception as e:
            print(f"Warning: Failed to update content URLs for page {page_id}: {e}")
            import traceback
            traceback.print_exc()
    
    def _update_all_pages_content_urls(self, affected_page_ids: set) -> None:
        """指定されたページIDを含むURLを持つすべてのページのコンテンツを更新"""
        try:
            from pages.models import Page
            import re
            
            # すべてのページを取得
            all_pages = Page.objects.all()
            
            for page in all_pages:
                if not page.content:
                    continue
                
                content_updated = False
                updated_content = page.content
                
                # 影響を受けた各ページIDについて、そのページのURLを検索して更新
                for affected_page_id in affected_page_ids:
                    entity = self.repository.find_by_id(affected_page_id)
                    if not entity:
                        continue
                    
                    # 現在の正しいフォルダパスを取得
                    current_folder_path = self.media_service.get_page_folder_path(entity)
                    folder_path_str = str(current_folder_path).replace('\\', '/')
                    
                    # パターン1: /media/uploads/page_{id}/filename
                    pattern1 = re.compile(
                        rf'/media/uploads/page_{affected_page_id}/([^"\'>\s]+)',
                        re.IGNORECASE
                    )
                    
                    # パターン2: /media/uploads/{任意のパス}/{任意のorder}_page_{id}_{タイトル}/filename
                    pattern2 = re.compile(
                        rf'/media/uploads/([^/]+/)*\d+_page_{affected_page_id}_[^/]+/([^"\'>\s]+)',
                        re.IGNORECASE
                    )
                    
                    def replace_url1(match):
                        filename = match.group(1)
                        return f'/media/uploads/{folder_path_str}/{filename}'
                    
                    def replace_url2(match):
                        filename = match.group(2)
                        return f'/media/uploads/{folder_path_str}/{filename}'
                    
                    old_before = updated_content
                    updated_content = pattern1.sub(replace_url1, updated_content)
                    updated_content = pattern2.sub(replace_url2, updated_content)
                    
                    if old_before != updated_content:
                        content_updated = True
                
                # 変更があった場合は保存
                if content_updated:
                    page.content = updated_content
                    page.save(update_fields=['content'])
                    print(f"✓ Updated content URLs in page {page.id} that reference affected pages")
            
        except Exception as e:
            print(f"Warning: Failed to update all pages content URLs: {e}")
            import traceback
            traceback.print_exc()

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
            
            # uploads直下に誤って作成されたフォルダをチェック（最重要）
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
                    # _get_page_folder_absolute_pathを使う（get_page_folder_pathは使わない）
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

    def _move_folder_to_new_parent(self, entity: 'PageEntity', old_parent_id: Optional[int]) -> None:
        """親が変わった場合にフォルダを古い親から新しい親に移動する"""
        try:
            import re
            import os
            import shutil
            from pathlib import Path
            
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            
            # 古い親フォルダを取得
            old_parent_folder = None
            old_folder = None
            if old_parent_id:
                old_parent_entity = self.repository.find_by_id(old_parent_id)
                if old_parent_entity:
                    old_parent_folder = self.media_service._get_page_folder_absolute_path(old_parent_entity)
                    if not old_parent_folder.exists() or not old_parent_folder.is_dir():
                        old_parent_folder = self.media_service._find_existing_parent_folder(old_parent_entity)
                
                if old_parent_folder and old_parent_folder.exists() and old_parent_folder.is_dir():
                    # 古い親フォルダ内でこのページのフォルダを検索（IDとタイトルで検索）
                    for item in old_parent_folder.iterdir():
                        if item.is_dir() and f'_page_{entity.id}_' in item.name and safe_title in item.name:
                            old_folder = item
                            break
                    
                    # 見つからない場合は、フォルダ名から推測
                    if not old_folder:
                        # 古いorderが分からないため、既存のフォルダを検索する必要がある
                        # しかし、orderが変更されている可能性があるため、IDとタイトルで検索した結果を使用
                        pass
                else:
                    print(f"Warning: Old parent folder not found for page {entity.id}")
            else:
                # ルートから移動する場合、uploadsフォルダ内を検索
                for item in self.media_service.uploads_dir.iterdir():
                    if item.is_dir() and f'_page_{entity.id}_' in item.name and safe_title in item.name:
                        old_folder = item
                        break
            
            # 新しい親フォルダを取得
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
                # ルートに移動する場合
                new_folder = self.media_service.uploads_dir / folder_name
            
            # 古いフォルダが見つかった場合、新しいフォルダに移動
            if old_folder and old_folder.exists() and old_folder.is_dir():
                old_folder_resolved = old_folder.resolve()
                new_folder_resolved = new_folder.resolve()
                
                if old_folder_resolved != new_folder_resolved:
                    # 新しいフォルダが存在しない場合は作成
                    if not new_folder.exists():
                        new_folder.mkdir(parents=False, exist_ok=True)
                    
                    # フォルダ全体を移動（メディアファイル、サブディレクトリ、HTMLファイルすべて）
                    self._move_folder_contents(old_folder, new_folder, entity.title)
                    
                    # 移動後に古いフォルダを削除
                    self._remove_empty_folders(old_folder)
            else:
                print(f"Warning: Old folder not found for page {entity.id} (old_parent_id={old_parent_id})")
                # 既存のフォルダを検索して新しい場所へ移動（フォールバック）
                existing_folder = self.media_service._find_existing_page_folder(entity)
                if existing_folder:
                    existing_resolved = existing_folder.resolve()
                    new_folder_resolved = new_folder.resolve()
                    
                    if existing_resolved != new_folder_resolved:
                        if not new_folder.exists():
                            new_folder.mkdir(parents=False, exist_ok=True)
                        self._move_folder_contents(existing_folder, new_folder, entity.title)
                        self._remove_empty_folders(existing_folder)
            
        except Exception as e:
            print(f"Warning: Failed to move folder to new parent: {e}")
            import traceback
            traceback.print_exc()

    def _cleanup_orphaned_folders_in_parent(self, parent_id: Optional[int]) -> None:
        """親フォルダ内のDBに存在しない孤立フォルダを削除する"""
        try:
            import re
            import os
            import shutil
            from pathlib import Path
            
            # すべてのページIDを取得
            all_pages = self.repository.find_all_pages()
            existing_page_ids = {page.id for page in all_pages}
            
            # 親フォルダを取得
            parent_folder = None
            if parent_id:
                parent_entity = self.repository.find_by_id(parent_id)
                if parent_entity:
                    parent_folder = self.media_service._get_page_folder_absolute_path(parent_entity)
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        parent_folder = self.media_service._find_existing_parent_folder(parent_entity)
            else:
                # ルートレベルの場合
                parent_folder = self.media_service.uploads_dir
            
            if not parent_folder or not parent_folder.exists() or not parent_folder.is_dir():
                return
            
            # 親フォルダ内のすべてのフォルダをチェック
            folders_to_check = list(parent_folder.iterdir())
            
            for folder_path in folders_to_check:
                if not folder_path.is_dir():
                    continue
                
                # フォルダ名からページIDを抽出
                # パターン: {order}_page_{id}_{title}
                match = re.match(r'\d+_page_(\d+)_', folder_path.name)
                
                if match:
                    page_id = int(match.group(1))
                    
                    # DBに存在しない場合は孤立フォルダとして削除
                    if page_id not in existing_page_ids:
                        try:
                            # フォルダとその中身を削除
                            shutil.rmtree(folder_path)
                            print(f"✓ Cleaned up orphaned folder: {folder_path.name} (page_id={page_id} does not exist in DB)")
                        except Exception as e:
                            print(f"Warning: Failed to remove orphaned folder {folder_path.name}: {e}")
            
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned folders: {e}")
            import traceback
            traceback.print_exc()
