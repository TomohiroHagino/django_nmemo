"""ページURL更新サービス"""

import re
from pages.models import Page

from ...domain.repositories import PageRepositoryInterface
from .media_service import MediaService


class PageUrlService:
    """ページコンテンツ内のURL更新を担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        media_service: MediaService
    ):
        self.repository = repository
        self.media_service = media_service
    
    def update_content_urls_after_rename(self, page_id: int, old_folder_path: str, new_folder_path: str) -> None:
        """フォルダリネーム後にコンテンツ内のURLを更新"""
        try:
            page = Page.objects.get(id=page_id)
            if not page.content:
                return
            
            # パターン1: /media/uploads/page_{id}/filename（古い形式）
            pattern1 = re.compile(
                rf'/media/uploads/page_{page_id}/([^"\'>\s]+)',
                re.IGNORECASE
            )
            
            # パターン2: /media/uploads/{任意のorder}_page_{id}_{タイトル}/filename（現在の形式）
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
                filename = match.group(2)
                return f'/media/uploads/{new_folder_path}/{filename}'
            
            updated_content = pattern2.sub(replace_url2, updated_content)
            
            # 変更があった場合は保存
            if old_content != updated_content:
                page.content = updated_content
                page.save(update_fields=['content'])
                print(f"✓ Updated content URLs for page {page_id}: {old_folder_path} -> {new_folder_path}")
            else:
                print(f"  No URL changes needed for page {page_id} (old: {old_folder_path}, new: {new_folder_path})")
            
        except Page.DoesNotExist:
            print(f"Warning: Page {page_id} not found when updating content URLs")
        except Exception as e:
            print(f"Warning: Failed to update content URLs for page {page_id}: {e}")
            import traceback
            traceback.print_exc()
    
    def update_content_urls_for_page(self, page_id: int) -> None:
        """指定されたページのコンテンツ内のURLを現在のフォルダパスに更新"""
        try:
            entity = self.repository.find_by_id(page_id)
            if not entity:
                return
            
            page = Page.objects.get(id=page_id)
            if not page.content:
                return
            
            # 現在の正しいフォルダパスを取得
            current_folder_path = self.media_service.get_page_folder_path(entity)
            folder_path_str = str(current_folder_path).replace('\\', '/')
            
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
    
    def update_all_pages_content_urls(self, affected_page_ids: set) -> None:
        """指定されたページIDを含むURLを持つすべてのページのコンテンツを更新"""
        try:
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
