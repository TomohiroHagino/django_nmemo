"""ページフォルダ管理サービス（ファサード）"""

from typing import Optional, Dict
from ...domain.repositories import PageRepositoryInterface
from .media_service import MediaService
from .folder_move_service import FolderMoveService
from .folder_cleanup_service import FolderCleanupService


class PageFolderService:
    """ページフォルダの管理を担当するサービス（ファサード）"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService
    ):
        self.repository = repository
        self.media_service = media_service
        
        # 内部サービスを初期化
        self.move_service = FolderMoveService(repository, media_service)
        self.cleanup_service = FolderCleanupService(
            repository, media_service, self.move_service
        )
    
    # クリーンアップメソッドの委譲
    def cleanup_old_folder(self, old_title: str, entity: 'PageEntity') -> None:
        """タイトル変更時に古いフォルダをクリーンアップ"""
        return self.cleanup_service.cleanup_old_folder(old_title, entity)
    
    def cleanup_orphaned_old_folders(
        self, page_id: int, old_folder_name: str, exclude_folder: 'Path'
    ) -> None:
        """誤って作成された可能性のある古いフォルダをクリーンアップ"""
        return self.cleanup_service.cleanup_orphaned_old_folders(
            page_id, old_folder_name, exclude_folder
        )
    
    def cleanup_misplaced_folders_after_save(self, entity: 'PageEntity') -> None:
        """保存後に親階層に誤って作成されたフォルダを削除"""
        return self.cleanup_service.cleanup_misplaced_folders_after_save(entity)
    
    def cleanup_orphaned_folders_in_parent(self, parent_id: Optional[int], entity_cache: Optional[Dict[int, PageEntity]] = None) -> None:
        """親フォルダ内のDBに存在しない孤立フォルダを削除する"""
        return self.cleanup_service.cleanup_orphaned_folders_in_parent(parent_id, entity_cache)
    
    # 移動・リネームメソッドの委譲
    def move_folder_contents(
        self, old_folder: 'Path', new_folder: 'Path', old_title: str
    ) -> None:
        """古いフォルダ内のすべてのコンテンツを新しいフォルダに移動"""
        return self.move_service.move_folder_contents(old_folder, new_folder, old_title)
    
    def merge_directories(self, src_dir: 'Path', dst_dir: 'Path') -> None:
        """ソースディレクトリの内容を宛先ディレクトリにマージ"""
        return self.move_service.merge_directories(src_dir, dst_dir)
    
    def remove_empty_folders(self, folder: 'Path') -> None:
        """空になったフォルダを再帰的に削除"""
        return self.move_service.remove_empty_folders(folder)
    
    def rename_folder_on_order_change(
        self, entity: 'PageEntity', old_order: int
    ) -> tuple:
        """order変更時にフォルダをリネームする"""
        return self.move_service.rename_folder_on_order_change(entity, old_order)
    
    def move_folder_to_new_parent(
        self, 
        entity: 'PageEntity', 
        old_parent_id: Optional[int],
        entity_cache: Optional[Dict[int, PageEntity]] = None
    ) -> None:
        """親が変わった場合にフォルダを古い親から新しい親に移動する"""
        return self.move_service.move_folder_to_new_parent(entity, old_parent_id, entity_cache)
