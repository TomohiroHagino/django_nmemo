"""メディアファイル操作サービス"""

import os
import re
import shutil
import urllib.parse
from pathlib import Path
from typing import List, Optional

from django.conf import settings

from ...domain.page_aggregate import PageEntity
from ...domain.repositories import PageRepositoryInterface
from .media_path_service import MediaPathService
from .media_url_extractor import MediaUrlExtractor


class MediaFileService:
    """メディアファイルの移動・削除を担当するサービス"""
    
    def __init__(
        self,
        repository: Optional[PageRepositoryInterface] = None,
        path_service: Optional[MediaPathService] = None,
        url_extractor: Optional[MediaUrlExtractor] = None
    ):
        self.repository = repository
        self.media_root = Path(settings.MEDIA_ROOT)
        self.uploads_dir = self.media_root / 'uploads'
        self.path_service = path_service or MediaPathService(repository)
        self.url_extractor = url_extractor or MediaUrlExtractor()
    
    def move_temp_images_to_page_folder(
        self,
        page_id: int,
        content: str,
        entity: Optional[PageEntity] = None
    ) -> str:
        """一時フォルダの画像・動画をページ専用フォルダへ移動し、URL を更新する"""
        if not content:
            return content
        
        temp_folder = self.uploads_dir / 'page_temp'
        
        if entity is None and self.repository:
            entity = self.repository.find_by_id(page_id)
        
        if entity:
            page_folder_relative = self.path_service.get_page_folder_path(entity)
        else:
            page_folder_relative = Path(f'page_{page_id}')
        
        # 実際のフォルダパスを計算
        if entity and entity.parent_id and self.repository:
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                parent_folder = self.path_service.get_page_folder_absolute_path(parent_entity)
                
                if not parent_folder.exists() or not parent_folder.is_dir():
                    existing_folder = self.path_service.find_existing_parent_folder(parent_entity)
                    if existing_folder:
                        parent_folder = existing_folder
                    else:
                        raise ValueError(f'親ページ（ID: {entity.parent_id}）のフォルダが存在しません。親ページを先に保存してください。パス: {parent_folder}')
                
                if parent_folder.exists() and parent_folder.is_dir():
                    parent_safe_title = re.sub(r'[<>:"/\\|?*]', '_', parent_entity.title)
                    parent_html_file = parent_folder / f'{parent_safe_title}.html'
                    if not parent_html_file.exists():
                        try:
                            from .html_generator import HtmlGenerator
                            html_generator = HtmlGenerator()
                            parent_html_content = html_generator.generate_html_content(parent_entity)
                            with open(parent_html_file, 'w', encoding='utf-8') as f:
                                f.write(parent_html_content)
                        except Exception as e:
                            print(f"Warning: Failed to save parent HTML to {parent_html_file}: {e}")
            else:
                raise ValueError(f'親ページ（ID: {entity.parent_id}）が見つかりません。')
        else:
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
            folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
            page_folder = self.uploads_dir / folder_name
            if not page_folder.exists():
                try:
                    page_folder.mkdir(parents=False, exist_ok=True)
                except FileNotFoundError as e:
                    raise ValueError(f'フォルダの作成に失敗しました: {page_folder}. エラー: {e}')
        
        # 親ページのHTMLファイルも作成する
        if entity and entity.parent_id and self.repository:
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                parent_folder = self.path_service.get_page_folder_absolute_path(parent_entity)
                if parent_folder.exists() and parent_folder.is_dir():
                    parent_safe_title = re.sub(r'[<>:"/\\|?*]', '_', parent_entity.title)
                    parent_html_file = parent_folder / f'{parent_safe_title}.html'
                    if not parent_html_file.exists():
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
        
        # page_folderの絶対パスを取得
        if entity:
            page_folder = self.path_service.get_page_folder_absolute_path(entity)
        else:
            page_folder = self.uploads_dir / page_folder_relative
        
        for old_url in matches:
            filename = old_url.split('/')[-1]
            old_path = temp_folder / filename
            new_path = page_folder / filename
            
            if old_path.exists():
                try:
                    if not page_folder.exists() or not page_folder.is_dir():
                        raise ValueError(f'ページフォルダが存在しません: {page_folder}')
                    
                    shutil.move(str(old_path), str(new_path))
                    new_url = f'/media/uploads/{folder_path_str}/{filename}'
                    updated_content = updated_content.replace(old_url, new_url)
                except Exception as e:
                    print(f"Warning: Failed to move image {old_path}: {e}")
        
        self._cleanup_empty_temp_folder(temp_folder)
        
        return updated_content
    
    def delete_removed_media(self, page_id: int, old_content: str, new_content: str) -> None:
        """コンテンツから削除された画像・動画を物理削除する"""
        old_media = self.url_extractor.extract_media_urls(old_content)
        new_media = self.url_extractor.extract_media_urls(new_content)
        
        removed_media = old_media - new_media
        
        if not removed_media:
            return
        
        for media_url in removed_media:
            if media_url.startswith('/media/'):
                relative_path = media_url.replace('/media/', '')
                relative_path = relative_path.split('?')[0].split('#')[0]
                file_path = self.media_root / relative_path
                
                if file_path.exists() and file_path.is_file():
                    filename = file_path.name
                    
                    referenced_filenames = set()
                    for url in new_media:
                        if url.startswith('/media/'):
                            url_path = url.replace('/media/', '').split('?')[0].split('#')[0]
                            if '/' in url_path:
                                ref_filename = url_path.split('/')[-1]
                            else:
                                ref_filename = url_path
                            referenced_filenames.add(ref_filename)
                    
                    if filename in referenced_filenames:
                        continue
                    
                    try:
                        os.remove(file_path)
                        print(f"✗ DELETED: {file_path}")
                    except Exception as e:
                        print(f"✗ Warning: Failed to delete media {file_path}: {e}")
    
    def delete_orphaned_media(self, page_id: int, content: str) -> None:
        """ページフォルダ内のうちコンテンツで参照されない画像・動画を削除する"""
        page_folder_relative = self.path_service.get_page_folder_path_by_id(page_id)
        page_folder = self.uploads_dir / page_folder_relative
        
        if not page_folder.exists() or not page_folder.is_dir():
            content_media = self.url_extractor.extract_media_urls(content)
            actual_folders = set()
            
            for media_url in content_media:
                if media_url.startswith('/media/uploads/'):
                    path_part = media_url.replace('/media/uploads/', '').split('?')[0].split('#')[0]
                    if '/' in path_part:
                        folder_part = '/'.join(path_part.split('/')[:-1])
                        actual_folders.add(folder_part)
            
            if actual_folders:
                found_folder = None
                for folder_path_str in actual_folders:
                    if f'_page_{page_id}_' in folder_path_str or f'page_{page_id}/' in folder_path_str or folder_path_str.endswith(f'_page_{page_id}'):
                        potential_folder = self.uploads_dir / folder_path_str
                        if potential_folder.exists() and potential_folder.is_dir():
                            page_folder = potential_folder
                            found_folder = folder_path_str
                            break
                
                if not found_folder:
                    folder_path_str = list(actual_folders)[0]
                    page_folder = self.uploads_dir / folder_path_str
            
            if not page_folder.exists() or not page_folder.is_dir():
                return
        
        content_media = self.url_extractor.extract_media_urls(content)
        referenced_file_names = set()
        
        for media_url in content_media:
            clean_url = media_url.split('?')[0].split('#')[0]
            
            if clean_url.startswith('http://') or clean_url.startswith('https://'):
                media_index = clean_url.find('/media/')
                if media_index != -1:
                    clean_url = clean_url[media_index:]
            
            if clean_url.startswith('/media/'):
                relative_path = clean_url.replace('/media/', '')
                try:
                    decoded_path = urllib.parse.unquote(relative_path)
                except Exception:
                    decoded_path = relative_path
                
                if '/' in decoded_path:
                    filename = decoded_path.split('/')[-1]
                else:
                    filename = decoded_path
                
                if filename:
                    referenced_file_names.add(filename)
                    if '/' in relative_path:
                        encoded_filename = relative_path.split('/')[-1]
                        if encoded_filename != filename:
                            referenced_file_names.add(encoded_filename)
        
        folder_files = set()
        try:
            for file_path in page_folder.iterdir():
                if file_path.is_file() and file_path.suffix.lower() != '.html':
                    folder_files.add(file_path.name)
        except Exception as e:
            print(f"Warning: Failed to list files in {page_folder}: {e}")
            return
        
        orphaned_files = set()
        for filename in folder_files:
            if filename in referenced_file_names:
                continue
            
            filename_lower = filename.lower()
            is_referenced = False
            for ref_name in referenced_file_names:
                if ref_name.lower() == filename_lower:
                    is_referenced = True
                    break
            
            if not is_referenced:
                try:
                    encoded_folder_filename = urllib.parse.quote(filename, safe='')
                    if encoded_folder_filename in referenced_file_names:
                        is_referenced = True
                except Exception:
                    pass
            
            if not is_referenced:
                orphaned_files.add(filename)
        
        deleted_count = 0
        for filename in orphaned_files:
            file_path = page_folder / filename
            try:
                os.remove(file_path)
                print(f"✗ DELETED: {file_path}")
                deleted_count += 1
            except Exception as e:
                print(f"✗ Warning: Failed to delete orphaned file {file_path}: {e}")
        
        if deleted_count > 0:
            print(f"✓ Deleted {deleted_count} orphaned file(s) from {page_folder}")
    
    def delete_page_media_folders(self, page_ids: List[int]) -> None:
        """指定ページID群の画像フォルダを削除する"""
        for page_id in page_ids:
            page_folder_relative = self.path_service.get_page_folder_path_by_id(page_id)
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
            pass
