"""メディアファイル操作サービス"""

import os
import re
import shutil
from pathlib import Path
from typing import List
from django.conf import settings


class MediaService:
    """メディアファイル（画像・動画）の操作を担当するサービス"""
    
    MEDIA_EXTENSIONS = {
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
        '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'
    }
    
    def __init__(self):
        self.media_root = Path(settings.MEDIA_ROOT)
        self.uploads_dir = self.media_root / 'uploads'
    
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
        
        return urls
    
    def move_temp_images_to_page_folder(self, page_id: int, content: str) -> str:
        """一時フォルダの画像・動画をページ専用フォルダへ移動し、URL を更新する"""
        if not content:
            return content
        
        temp_folder = self.uploads_dir / 'page_temp'
        page_folder = self.uploads_dir / f'page_{page_id}'
        
        # ページフォルダを作成（存在しなければ）
        page_folder.mkdir(parents=True, exist_ok=True)
        
        # content 内の page_temp を参照する画像・動画URLを抽出
        pattern = r'(/media/uploads/page_temp/[^"\'>\s]+)'
        matches = re.findall(pattern, content)
        
        updated_content = content
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
                    new_url = f'/media/uploads/page_{page_id}/{filename}'
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
        
        # 削除対象のメディアファイルを削除
        for media_url in removed_media:
            if media_url.startswith('/media/'):
                relative_path = media_url.replace('/media/', '')
                file_path = self.media_root / relative_path
                
                if file_path.exists() and file_path.is_file():
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"Warning: Failed to delete media {file_path}: {e}")
    
    def delete_orphaned_media(self, page_id: int, content: str) -> None:
        """ページフォルダ内のうちコンテンツで参照されない画像・動画を削除する"""
        page_folder = self.uploads_dir / f'page_{page_id}'
        
        if not page_folder.exists() or not page_folder.is_dir():
            return
        
        # コンテンツで参照されている画像・動画のファイル名集合を作成
        content_media = self.extract_media_urls(content)
        content_filenames = set()
        for media_url in content_media:
            if f'/page_{page_id}/' in media_url:
                filename = os.path.basename(media_url)
                content_filenames.add(filename)
        
        # フォルダ内の画像・動画ファイル一覧を取得（.html は除外）
        folder_files = set()
        try:
            for file_path in page_folder.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in self.MEDIA_EXTENSIONS:
                    folder_files.add(file_path.name)
        except Exception as e:
            print(f"Warning: Failed to list files in {page_folder}: {e}")
            return
        
        # 孤立（未参照）の画像・動画を特定
        orphaned_files = folder_files - content_filenames
        
        # 孤立ファイルを削除
        for filename in orphaned_files:
            file_path = page_folder / filename
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Failed to delete orphaned image {file_path}: {e}")
    
    def delete_page_media_folders(self, page_ids: List[int]) -> None:
        """指定ページID群の画像フォルダを削除する"""
        for page_id in page_ids:
            page_folder = self.uploads_dir / f'page_{page_id}'
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
