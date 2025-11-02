"""メディアパス管理サービス"""

import re
from pathlib import Path
from typing import Optional, Dict
from django.conf import settings
from ...domain.page_aggregate import PageEntity
from ...domain.repositories import PageRepositoryInterface


class MediaPathService:
    """メディアファイルのパス管理を担当するサービス"""
    
    def __init__(self, repository: Optional[PageRepositoryInterface] = None):
        self.media_root = Path(settings.MEDIA_ROOT)
        self.uploads_dir = self.media_root / 'uploads'
        self.repository = repository
    
    def get_page_folder_name(self, entity: PageEntity) -> str:
        """ページのフォルダ名のみを取得する（親パスを含まない）"""
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
        return f'{entity.order}_page_{entity.id}_{safe_title}'
    
    def get_page_folder_path(self, entity: PageEntity) -> Path:
        """ページのフォルダパスを階層構造で取得する（相対パス）"""
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
        folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
        
        if entity.parent_id and self.repository:
            parent_entity = self.repository.find_by_id(entity.parent_id)
            if parent_entity:
                parent_path = self.get_page_folder_path(parent_entity)
                return parent_path / folder_name
        
        return Path(folder_name)
    
    def get_page_folder_path_by_id(self, page_id: int) -> Path:
        """ページIDからフォルダパスを取得する"""
        if not self.repository:
            return Path(f'page_{page_id}')
        
        entity = self.repository.find_by_id(page_id)
        if entity:
            return self.get_page_folder_path(entity)
        
        return Path(f'page_{page_id}')
    
    def get_page_folder_absolute_path(self, entity: PageEntity, entity_cache: Optional[Dict[int, PageEntity]] = None) -> Path:
        """ページのフォルダの絶対パスを取得する"""
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
        folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
        
        if entity.parent_id and self.repository:
            # キャッシュから親エンティティを取得、なければDBから取得
            parent_entity = None
            if entity_cache:
                parent_entity = entity_cache.get(entity.parent_id)
            
            if parent_entity is None:
                print(f"Warning: Parent {entity.parent_id} not in cache in get_page_folder_absolute_path, fetching from DB")
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity and entity_cache is not None:
                    entity_cache[entity.parent_id] = parent_entity
            
            if parent_entity:
                parent_folder = self.get_page_folder_absolute_path(parent_entity, entity_cache)
                return parent_folder / folder_name
        
        return self.uploads_dir / folder_name
    
    def find_existing_parent_folder(self, parent_entity: PageEntity, entity_cache: Optional[Dict[int, PageEntity]] = None) -> Optional[Path]:
        """既存の親フォルダを検索する（orderが変更された場合に対応）"""
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', parent_entity.title)
        
        if parent_entity.parent_id and self.repository:
            # キャッシュから親エンティティを取得、なければDBから取得
            grandparent_entity = None
            if entity_cache:
                grandparent_entity = entity_cache.get(parent_entity.parent_id)
            
            if grandparent_entity is None:
                print(f"Warning: Grandparent {parent_entity.parent_id} not in cache in find_existing_parent_folder, fetching from DB")
                grandparent_entity = self.repository.find_by_id(parent_entity.parent_id)
                if grandparent_entity and entity_cache is not None:
                    entity_cache[parent_entity.parent_id] = grandparent_entity
            
            if grandparent_entity:
                grandparent_folder = self.find_existing_parent_folder(grandparent_entity, entity_cache)
                if grandparent_folder and grandparent_folder.exists():
                    for item in grandparent_folder.iterdir():
                        if item.is_dir() and f'_page_{parent_entity.id}_' in item.name and safe_title in item.name:
                            return item
        else:
            for item in self.uploads_dir.iterdir():
                if item.is_dir() and f'_page_{parent_entity.id}_' in item.name and safe_title in item.name:
                    return item
        
        return None
    
    def find_existing_page_folder(self, entity: PageEntity, entity_cache: Optional[Dict[int, PageEntity]] = None) -> Optional[Path]:
        """既存のページフォルダを検索する（orderが変更された場合に対応）"""
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
        
        if entity.parent_id and self.repository:
            # キャッシュから親エンティティを取得、なければDBから取得
            parent_entity = None
            if entity_cache:
                parent_entity = entity_cache.get(entity.parent_id)
            
            if parent_entity is None:
                print(f"Warning: Parent {entity.parent_id} not in cache in find_existing_page_folder, fetching from DB")
                parent_entity = self.repository.find_by_id(entity.parent_id)
                if parent_entity and entity_cache is not None:
                    entity_cache[entity.parent_id] = parent_entity
            
            if parent_entity:
                parent_folder = self.get_page_folder_absolute_path(parent_entity, entity_cache)
                if not parent_folder.exists() or not parent_folder.is_dir():
                    parent_folder = self.find_existing_parent_folder(parent_entity, entity_cache)
                
                if parent_folder and parent_folder.exists() and parent_folder.is_dir():
                    for item in parent_folder.iterdir():
                        if item.is_dir() and f'_page_{entity.id}_' in item.name and safe_title in item.name:
                            return item
        else:
            for item in self.uploads_dir.iterdir():
                if item.is_dir() and f'_page_{entity.id}_' in item.name and safe_title in item.name:
                    return item
        
        return None
