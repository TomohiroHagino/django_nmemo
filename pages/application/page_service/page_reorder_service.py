"""ページ並び替えサービス"""

from typing import Optional, Set
from datetime import datetime
from django.db import transaction

from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from ..dto import PageDTO
from .dto_converter import DtoConverter
from .html_generator import HtmlGenerator
from .page_folder_service import PageFolderService
from .page_url_service import PageUrlService


class PageReorderService:
    """ページ並び替えを担当するサービス"""
    
    def __init__(
        self,
        repository: PageRepositoryInterface,
        html_generator: HtmlGenerator,
        folder_service: PageFolderService,
        url_service: PageUrlService
    ):
        self.repository = repository
        self.html_generator = html_generator
        self.folder_service = folder_service
        self.url_service = url_service
    
    @transaction.atomic
    def reorder_page(self, page_id: int, target_page_id: int, position: str) -> Optional[PageDTO]:
        """ページの並び替え：ターゲットの前後に挿入（親が異なる場合は親も変更）"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        target_entity = self.repository.find_by_id(target_page_id)
        if target_entity is None:
            raise ValueError('ターゲットページが見つかりません')
        
        new_parent_id = target_entity.parent_id
        old_parent_id = entity.parent_id
        parent_changed = entity.parent_id != new_parent_id
        
        if parent_changed:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
            if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
                raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        updated_siblings, old_orders = self._execute_reorder(entity, target_entity, target_page_id, position)
        
        if parent_changed:
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity:
                try:
                    self.folder_service.move_folder_to_new_parent(saved_entity, old_parent_id)
                except Exception as e:
                    print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        affected_page_ids = self._handle_order_changes(updated_siblings, old_orders, page_id)
        
        if affected_page_ids:
            self.url_service.update_all_pages_content_urls(affected_page_ids)
        
        self._generate_html_for_affected_pages(updated_siblings, page_id)
        
        try:
            self.folder_service.cleanup_orphaned_folders_in_parent(target_entity.parent_id)
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned folders: {e}")
            import traceback
            traceback.print_exc()
        
        aggregate = PageAggregate.from_entity_tree(entity)
        return DtoConverter.entity_to_dto(aggregate) if aggregate.id else None
    
    def _execute_reorder(self, entity, target_entity, target_page_id: int, position: str) -> tuple:
        """並び替えを実行する"""
        target_parent_id = target_entity.parent_id
        
        if target_parent_id:
            siblings_entities = self.repository.find_children(target_parent_id)
        else:
            siblings_entities = self.repository.find_all_root_pages()
        
        siblings_entities = [s for s in siblings_entities if s.id != entity.id]
        
        target_in_siblings = any(s.id == target_page_id for s in siblings_entities)
        if not target_in_siblings:
            siblings_entities.append(target_entity)
        
        old_orders = {}
        all_pages_to_check = [entity] + siblings_entities
        for page_entity in all_pages_to_check:
            old_orders[page_entity.id] = page_entity.order
        
        aggregate = PageAggregate.from_entity_tree(entity)
        siblings = [PageAggregate.from_entity_tree(s) for s in siblings_entities]
        
        aggregate.parent_id = target_parent_id
        aggregate.updated_at = datetime.now()
        
        updated_siblings = aggregate.reorder(target_page_id, position, siblings)
        
        for sibling in updated_siblings:
            if sibling.id == entity.id:
                sibling.parent_id = target_parent_id
            
            sibling_entity = DtoConverter.aggregate_to_entity(sibling)
            self.repository.save(sibling_entity)
        
        if not any(s.id == entity.id for s in updated_siblings):
            updated_siblings.append(aggregate)
            saved_entity = DtoConverter.aggregate_to_entity(aggregate)
            self.repository.save(saved_entity)
        
        if entity.id not in old_orders:
            old_orders[entity.id] = entity.order
        
        return updated_siblings, old_orders
    
    def _handle_order_changes(self, updated_siblings: list, old_orders: dict, page_id: int) -> Set[int]:
        """order変更時の処理"""
        affected_page_ids = set()
        
        for sibling in updated_siblings:
            saved_entity = self.repository.find_by_id(sibling.id)
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    affected_page_ids.add(saved_entity.id)
                    try:
                        old_folder_path_str, new_folder_path_str = self.folder_service.rename_folder_on_order_change(saved_entity, old_order)
                        if old_folder_path_str and new_folder_path_str:
                            self.url_service.update_content_urls_after_rename(saved_entity.id, old_folder_path_str, new_folder_path_str)
                        else:
                            self.url_service.update_content_urls_for_page(saved_entity.id)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for page {saved_entity.id}: {e}")
                        import traceback
                        traceback.print_exc()
        
        if not any(s.id == page_id for s in updated_siblings):
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    affected_page_ids.add(page_id)
                    try:
                        old_folder_path_str, new_folder_path_str = self.folder_service.rename_folder_on_order_change(saved_entity, old_order)
                        if old_folder_path_str and new_folder_path_str:
                            self.url_service.update_content_urls_after_rename(saved_entity.id, old_folder_path_str, new_folder_path_str)
                        else:
                            self.url_service.update_content_urls_for_page(saved_entity.id)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for page {saved_entity.id}: {e}")
                        import traceback
                        traceback.print_exc()
        
        return affected_page_ids
    
    def _generate_html_for_affected_pages(self, updated_siblings: list, page_id: int) -> None:
        """影響を受けたページのHTMLを生成する"""
        for sibling in updated_siblings:
            saved_entity = self.repository.find_by_id(sibling.id)
            if saved_entity:
                try:
                    self.html_generator.save_html_to_folder(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        if not any(s.id == page_id for s in updated_siblings):
            saved_entity = self.repository.find_by_id(page_id)
            if saved_entity:
                try:
                    self.html_generator.save_html_to_folder(saved_entity)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for moved page {saved_entity.id}: {e}")
                    import traceback
                    traceback.print_exc()
