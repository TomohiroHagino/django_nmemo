"""メディアファイル操作サービス"""

import os
import re
import shutil
from pathlib import Path
from typing import List, Optional
from django.conf import settings

from ...domain.page_aggregate import PageEntity
from ...domain.repositories import PageRepositoryInterface


class MediaService:
    """メディアファイル（画像・動画）の操作を担当するサービス"""
    
    MEDIA_EXTENSIONS = {
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
        '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'
    }
    
    def __init__(self, repository: Optional[PageRepositoryInterface] = None):
        self.media_root = Path(settings.MEDIA_ROOT)
        self.uploads_dir = self.media_root / 'uploads'
        self.repository = repository
    
    def get_page_folder_path(self, entity: PageEntity) -> Path:
        """ページのフォルダパスを階層構造で取得する"""
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
        folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
        
        if entity.parent_id and self.repository:
            # 親ページのエンティティを取得
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                # 親のパスを再帰的に取得
                parent_path = self.get_page_folder_path(parent_entity)
                return parent_path / folder_name
        
        # ルートページの場合
        return Path(folder_name)
    
    def get_page_folder_path_by_id(self, page_id: int) -> Path:
        """ページIDからフォルダパスを取得する"""
        if not self.repository:
            return Path(f'page_{page_id}')
        
        entity = self.repository.find_by_id(page_id)
        if entity:
            return self.get_page_folder_path(entity)
        
        # フォールバック
        return Path(f'page_{page_id}')
    
    def extract_media_urls(self, content: str) -> set:
        """HTMLコンテンツから画像・動画URLをすべて抽出する"""
        urls = set()
        
        # img の src 属性を抽出
        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
        urls.update(re.findall(img_pattern, content))
        
        # video の src 属性を抽出
        video_pattern = r'<video[^>]+src=["\']([^"\']+)["\']'
        urls.update(re.findall(video_pattern, content))
        
        # source タグの src 属性を抽出（video 内の source タグ対応）
        source_pattern = r'<source[^>]+src=["\']([^"\']+)["\']'
        urls.update(re.findall(source_pattern, content))
        
        # a タグの href 属性から /media/uploads/ で始まるファイルURLを抽出
        # （画像・動画以外のファイル（.xlsx, .zip など）も含む）
        a_pattern = r'<a[^>]+href=["\']([^"\']+)["\']'
        for match in re.finditer(a_pattern, content):
            href = match.group(1)
            # /media/uploads/ で始まるURLはすべて抽出（ファイルへのリンクと判断）
            if href.startswith('/media/uploads/'):
                urls.add(href)
        
        return urls
    
    def move_temp_images_to_page_folder(self, page_id: int, content: str, entity: Optional[PageEntity] = None) -> str:
        """一時フォルダの画像・動画をページ専用フォルダへ移動し、URL を更新する"""
        if not content:
            return content
        
        temp_folder = self.uploads_dir / 'page_temp'
        
        # ページエンティティが渡されていない場合は取得
        if entity is None and self.repository:
            entity = self.repository.find_by_id(page_id)
        
        # ページフォルダパスを取得
        if entity:
            page_folder_relative = self.get_page_folder_path(entity)
        else:
            page_folder_relative = Path(f'page_{page_id}')
        
        page_folder = self.uploads_dir / page_folder_relative
        
        # 親フォルダの存在を確認してからフォルダを作成
        if entity and entity.parent_id and self.repository:
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                parent_folder_relative = self.get_page_folder_path(parent_entity)
                parent_folder = self.uploads_dir / parent_folder_relative
                
                # 親フォルダが存在しない場合はエラー（親ページを先に保存する必要がある）
                if not parent_folder.exists() or not parent_folder.is_dir():
                    raise ValueError(f'親ページ（ID: {entity.parent_id}）のフォルダが存在しません。親ページを先に保存してください。')
                
                # 親フォルダが存在する場合のみ、子フォルダを作成（parents=Falseで親フォルダを作成しない）
                page_folder.mkdir(parents=False, exist_ok=True)
            else:
                # 親が見つからない場合でもフォルダは作成（フォールバック）
                page_folder.mkdir(parents=True, exist_ok=True)
        else:
            # ルートページの場合はそのまま作成
            page_folder.mkdir(parents=True, exist_ok=True)
        
        # 親フォルダが作成された場合、親ページのHTMLファイルも作成する
        if entity and entity.parent_id and self.repository:
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                parent_folder_relative = self.get_page_folder_path(parent_entity)
                parent_folder = self.uploads_dir / parent_folder_relative
                # 親フォルダが存在し、HTMLファイルがない場合
                if parent_folder.exists() and parent_folder.is_dir():
                    parent_safe_title = re.sub(r'[<>:"/\\|?*]', '_', parent_entity.title)
                    parent_html_file = parent_folder / f'{parent_safe_title}.html'
                    if not parent_html_file.exists():
                        # 親ページのHTMLファイルを作成
                        try:
                            from .html_generator import HtmlGenerator
                            html_generator = HtmlGenerator()
                            parent_html_content = html_generator.generate_html_content(parent_entity)
                            with open(parent_html_file, 'w', encoding='utf-8') as f:
                                f.write(parent_html_content)
                        except Exception as e:
                            print(f"Warning: Failed to save parent HTML to {parent_html_file}: {e}")
        
        # content 内の page_temp を参照する画像・動画URLを抽出
        pattern = r'(/media/uploads/page_temp/[^"\'>\s]+)'
        matches = re.findall(pattern, content)
        
        updated_content = content
        folder_path_str = str(page_folder_relative).replace('\\', '/')
        
        for old_url in matches:
            # URL からファイル名を抽出
            filename = old_url.split('/')[-1]
            old_path = temp_folder / filename
            new_path = page_folder / filename
            
            if old_path.exists():
                try:
                    # ファイルを移動
                    shutil.move(str(old_path), str(new_path))
                    
                    # コンテンツ内のURLを更新
                    new_url = f'/media/uploads/{folder_path_str}/{filename}'
                    updated_content = updated_content.replace(old_url, new_url)
                    
                    print(f"Moved image: {old_path} -> {new_path}")
                except Exception as e:
                    print(f"Warning: Failed to move image {old_path}: {e}")
        
        # 空になった一時フォルダを掃除
        self._cleanup_empty_temp_folder(temp_folder)
        
        return updated_content
    
    def delete_removed_media(self, page_id: int, old_content: str, new_content: str) -> None:
        """コンテンツから削除された画像・動画を物理削除する"""
        old_media = self.extract_media_urls(old_content)
        new_media = self.extract_media_urls(new_content)
        
        # 削除対象のURL集合を算出
        removed_media = old_media - new_media
        
        if not removed_media:
            print(f"DEBUG: No removed media for page {page_id}")
            return
        
        print(f"DEBUG: Found {len(removed_media)} removed media URL(s) for page {page_id}")
        
        # ページのフォルダパスを取得（ログ用）
        page_folder_relative = self.get_page_folder_path_by_id(page_id)
        
        # 削除対象のメディアファイルを削除
        for media_url in removed_media:
            if media_url.startswith('/media/'):
                relative_path = media_url.replace('/media/', '')
                # クエリパラメータを除去
                relative_path = relative_path.split('?')[0].split('#')[0]
                file_path = self.media_root / relative_path
                
                print(f"DEBUG: Attempting to delete: {file_path} (from URL: {media_url})")
                
                if file_path.exists() and file_path.is_file():
                    try:
                        os.remove(file_path)
                        print(f"✓ Deleted removed media: {file_path}")
                    except Exception as e:
                        print(f"✗ Warning: Failed to delete media {file_path}: {e}")
                else:
                    print(f"✗ Warning: Media file not found: {file_path}")
            else:
                print(f"DEBUG: Skipping non-media URL: {media_url}")
    
    def delete_orphaned_media(self, page_id: int, content: str) -> None:
        """ページフォルダ内のうちコンテンツで参照されない画像・動画を削除する"""
        page_folder_relative = self.get_page_folder_path_by_id(page_id)
        page_folder = self.uploads_dir / page_folder_relative
        
        print(f"DEBUG: Checking orphaned media for page {page_id}")
        print(f"DEBUG: Page folder relative path: {page_folder_relative}")
        print(f"DEBUG: Page folder absolute path: {page_folder}")
        
        # フォルダが存在しない場合は、コンテンツから実際のパスを推測
        if not page_folder.exists() or not page_folder.is_dir():
            print(f"DEBUG: Page folder does not exist, trying to find from content")
            # コンテンツから実際に使用されているフォルダパスを取得
            content_media = self.extract_media_urls(content)
            print(f"DEBUG: Extracted {len(content_media)} media URLs from content")
            
            actual_folders = set()
            
            for media_url in content_media:
                print(f"DEBUG: Processing media URL: {media_url}")
                if media_url.startswith('/media/uploads/'):
                    # /media/uploads/ 以降のパスを取得
                    path_part = media_url.replace('/media/uploads/', '').split('?')[0].split('#')[0]
                    print(f"DEBUG: Path part: {path_part}")
                    # ファイル名を除いたフォルダパスを取得
                    if '/' in path_part:
                        folder_part = '/'.join(path_part.split('/')[:-1])
                        actual_folders.add(folder_part)
                        print(f"DEBUG: Added folder: {folder_part}")
            
            print(f"DEBUG: Found folders from content: {actual_folders}")
            
            if actual_folders:
                # 複数のフォルダがある場合は、ページIDを含むものを優先
                found_folder = None
                for folder_path_str in actual_folders:
                    # ページIDを含むフォルダパスを探す（新しい形式と古い形式の両方に対応）
                    if f'_page_{page_id}_' in folder_path_str or f'page_{page_id}/' in folder_path_str or folder_path_str.endswith(f'_page_{page_id}'):
                        potential_folder = self.uploads_dir / folder_path_str
                        print(f"DEBUG: Checking potential folder with page ID: {potential_folder}")
                        if potential_folder.exists() and potential_folder.is_dir():
                            page_folder = potential_folder
                            found_folder = folder_path_str
                            print(f"DEBUG: Found folder with page ID: {page_folder}")
                            break
                
                if not found_folder:
                    # 見つからない場合は最初のフォルダを使用
                    folder_path_str = list(actual_folders)[0]
                    page_folder = self.uploads_dir / folder_path_str
                    print(f"DEBUG: Using first found folder: {page_folder}")
            else:
                print(f"DEBUG: No folders found in content URLs")
            
            # それでも見つからない場合は処理を終了
            if not page_folder.exists() or not page_folder.is_dir():
                print(f"DEBUG: Could not find page folder, skipping orphaned media check")
                print(f"DEBUG: Searched path: {page_folder}")
                return
        
        # コンテンツで参照されているファイルのファイル名集合を作成
        content_media = self.extract_media_urls(content)
        print(f"DEBUG: Found {len(content_media)} media URL(s) in content")
        
        # 実際に存在するファイルパスの集合を作成
        referenced_file_paths = set()
        folder_path_str = str(page_folder.relative_to(self.uploads_dir)).replace('\\', '/')
        print(f"DEBUG: Using folder path: {folder_path_str}")
        
        for media_url in content_media:
            # クエリパラメータやフラグメントを除去
            clean_url = media_url.split('?')[0].split('#')[0]
            
            if clean_url.startswith('/media/'):
                # 相対パスを取得
                relative_path = clean_url.replace('/media/', '')
                file_path = self.media_root / relative_path
                
                # このファイルがページフォルダ内にあるかチェック
                try:
                    # 正規化されたパスを比較
                    if file_path.exists() and file_path.is_file():
                        resolved_file_path = file_path.resolve()
                        resolved_page_folder = page_folder.resolve()
                        
                        # ページフォルダ内のファイルかチェック
                        try:
                            resolved_file_path.relative_to(resolved_page_folder)
                            referenced_file_paths.add(file_path.name)
                            print(f"DEBUG: Referenced file found: {file_path.name}")
                        except ValueError:
                            # ページフォルダ外のファイルは無視
                            print(f"DEBUG: File is outside page folder: {file_path.name}")
                            pass
                except Exception as e:
                    print(f"DEBUG: Error checking file path {file_path}: {e}")
        
        print(f"DEBUG: Referenced file names: {referenced_file_paths}")
        
        # フォルダ内のすべてのファイル一覧を取得（.html は除外）
        folder_files = set()
        try:
            for file_path in page_folder.iterdir():
                if file_path.is_file() and file_path.suffix.lower() != '.html':
                    folder_files.add(file_path.name)
            print(f"DEBUG: Files in folder: {folder_files}")
        except Exception as e:
            print(f"✗ Warning: Failed to list files in {page_folder}: {e}")
            return
        
        # 孤立（未参照）のファイルを特定
        orphaned_files = folder_files - referenced_file_paths
        print(f"DEBUG: Orphaned files to delete: {orphaned_files}")
        
        # 孤立ファイルを削除
        deleted_count = 0
        for filename in orphaned_files:
            file_path = page_folder / filename
            try:
                os.remove(file_path)
                print(f"✓ Deleted orphaned media: {file_path}")
                deleted_count += 1
            except Exception as e:
                print(f"✗ Warning: Failed to delete orphaned file {file_path}: {e}")
        
        if deleted_count > 0:
            print(f"✓ Deleted {deleted_count} orphaned file(s) from {page_folder}")
        else:
            print(f"DEBUG: No orphaned files to delete")
    
    def delete_page_media_folders(self, page_ids: List[int]) -> None:
        """指定ページID群の画像フォルダを削除する"""
        for page_id in page_ids:
            page_folder_relative = self.get_page_folder_path_by_id(page_id)
            page_folder = self.uploads_dir / page_folder_relative
            if page_folder.exists() and page_folder.is_dir():
                try:
                    shutil.rmtree(page_folder)
                except Exception as e:
                    print(f"Warning: Failed to delete image folder for page {page_id}: {e}")
    
    def _cleanup_empty_temp_folder(self, temp_folder: Path) -> None:
        """空になった一時フォルダを削除する"""
        try:
            if temp_folder.exists() and not any(temp_folder.iterdir()):
                temp_folder.rmdir()
        except Exception:
            pass  # 掃除時のエラーは無視
