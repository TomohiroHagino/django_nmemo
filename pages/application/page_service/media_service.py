"""メディアファイル操作サービス（後方互換性のためのラッパー）"""

from typing import Optional

from ...domain.repositories import PageRepositoryInterface
from .media_path_service import MediaPathService
from .media_url_extractor import MediaUrlExtractor
from .media_file_service import MediaFileService


class MediaService:
    """メディアファイル操作サービス（後方互換性のためのラッパー）"""
    
    def __init__(self, repository: Optional[PageRepositoryInterface] = None):
        self.path_service = MediaPathService(repository)
        self.url_extractor = MediaUrlExtractor()
        self.file_service = MediaFileService(repository, self.path_service, self.url_extractor)
        
        # 後方互換性のためのプロパティ
        self.media_root = self.path_service.media_root
        self.uploads_dir = self.path_service.uploads_dir
        self.repository = repository
    
    # パス関連メソッドの委譲
    def get_page_folder_name(self, entity):
        return self.path_service.get_page_folder_name(entity)
    
    def get_page_folder_path(self, entity):
        return self.path_service.get_page_folder_path(entity)
    
    def get_page_folder_path_by_id(self, page_id: int):
        return self.path_service.get_page_folder_path_by_id(page_id)
    
    def _get_page_folder_absolute_path(self, entity):
        return self.path_service.get_page_folder_absolute_path(entity)
    
    def _find_existing_parent_folder(self, parent_entity):
        return self.path_service.find_existing_parent_folder(parent_entity)
    
    def _find_existing_page_folder(self, entity):
        return self.path_service.find_existing_page_folder(entity)
    
    # URL抽出メソッドの委譲
    def extract_media_urls(self, content: str):
        return self.url_extractor.extract_media_urls(content)
    
    # ファイル操作メソッドの委譲
    def move_temp_images_to_page_folder(self, page_id: int, content: str, entity=None):
        return self.file_service.move_temp_images_to_page_folder(page_id, content, entity)
    
    def delete_removed_media(self, page_id: int, old_content: str, new_content: str):
        return self.file_service.delete_removed_media(page_id, old_content, new_content)
    
    def delete_orphaned_media(self, page_id: int, content: str):
        return self.file_service.delete_orphaned_media(page_id, content)
    
    def delete_page_media_folders(self, page_ids):
        return self.file_service.delete_page_media_folders(page_ids)