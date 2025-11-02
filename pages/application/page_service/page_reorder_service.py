"""ページ並び替えサービス"""

import traceback
from typing import Optional, Set, Dict, List
from datetime import datetime
from django.db import transaction
from ...domain.page_aggregate import PageAggregate
from ...domain.repositories import PageRepositoryInterface
from ...domain.page_aggregate import PageEntity
from ..dto import PageDTO
from .dto_converter import DtoConverter
from .html_generator import HtmlGenerator
from .page_folder_service import PageFolderService
from .page_url_service import PageUrlService
from django.utils import timezone
from pages.models import Page


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
        # 初期のエンティティキャッシュを初期化
        entity_cache: Dict[int, PageEntity] = {}
        
        # 1と2を一括取得（リポジトリインターフェース経由）
        entities = self.repository.find_by_ids([page_id, target_page_id])
        entities_dict = {e.id: e for e in entities}
        # 初期エンティティをキャッシュに追加
        entity_cache.update(entities_dict)
        
        entity = entities_dict.get(page_id)
        if entity is None:
            return None
        
        target_entity = entities_dict.get(target_page_id)
        if target_entity is None:
            raise ValueError('ターゲットページが見つかりません')
        
        new_parent_id = target_entity.parent_id
        old_parent_id = entity.parent_id
        parent_changed = entity.parent_id != new_parent_id
        
        # 親ページを事前に取得してキャッシュに追加（後で複数回使用されるため）
        if target_entity.parent_id and target_entity.parent_id not in entity_cache:
            parent_entity = self.repository.find_by_id(target_entity.parent_id)
            if parent_entity:
                entity_cache[target_entity.parent_id] = parent_entity
        
        all_pages = None
        if parent_changed:
            from ...domain.page_aggregate import PageDomainService
            all_pages = self.repository.find_all_pages()
            if not PageDomainService.validate_hierarchy(new_parent_id, page_id, all_pages):
                raise ValueError('循環参照を防ぐため、この操作は許可されません')
        
        # existing_pages_dictは不要（bulk_updateで内部処理される）
        updated_siblings, old_orders, saved_entities_cache, entity_cache = self._execute_reorder(
            entity, target_entity, target_page_id, position, entity_cache
        )
        
        # エンティティキャッシュを作成（保存後のエンティティを初期値として使用）
        entity_cache: Dict[int, PageEntity] = entity_cache.copy()
        
        if parent_changed:
            saved_entity = entity_cache.get(page_id) or self.repository.find_by_id(page_id)
            if saved_entity:
                entity_cache[page_id] = saved_entity
                try:
                    # entity_cacheを渡して親エンティティの重複取得を避ける
                    self.folder_service.move_folder_to_new_parent(saved_entity, old_parent_id, entity_cache)
                except Exception as e:
                    print(f"Warning: Failed to move folder to new parent for page {saved_entity.id}: {e}")
                    traceback.print_exc()
        
        # _handle_order_changesでエンティティを取得し、キャッシュに保存
        affected_page_ids, entity_cache = self._handle_order_changes(
            updated_siblings, old_orders, page_id, entity_cache
        )
        
        if affected_page_ids:
            # 全ページを再利用（既に取得済みの場合）、entity_cacheも渡す
            self.url_service.update_all_pages_content_urls(affected_page_ids, entity_cache, all_pages)
        
        # キャッシュされたエンティティを使用
        self._generate_html_for_affected_pages(updated_siblings, page_id, entity_cache)
        
        try:
            # 親エンティティは既にキャッシュにあるはず（事前に取得済み）
            if target_entity.parent_id and target_entity.parent_id not in entity_cache:
                # 念のため取得（通常は到達しない）
                parent_entity = self.repository.find_by_id(target_entity.parent_id)
                if parent_entity:
                    entity_cache[target_entity.parent_id] = parent_entity
            
            # cleanup_orphaned_folders_in_parentにもentity_cacheを渡す
            self.folder_service.cleanup_orphaned_folders_in_parent(target_entity.parent_id, entity_cache)
        except Exception as e:
            print(f"Warning: Failed to cleanup orphaned folders: {e}")
            traceback.print_exc()
        
        # キャッシュからエンティティを取得（必ずキャッシュにあるはず）
        final_entity = entity_cache.get(page_id)
        if final_entity:
            aggregate = PageAggregate.from_entity_tree(final_entity)
            return DtoConverter.entity_to_dto(aggregate) if aggregate.id else None
        return None
    
    def _execute_reorder(
        self, 
        entity, 
        target_entity, 
        target_page_id: int, 
        position: str,
        entity_cache: Dict[int, PageEntity]
    ) -> tuple:
        """並び替えを実行する（保存後のエンティティも返す）"""
        target_parent_id = target_entity.parent_id
        
        # 親ページを事前にキャッシュに追加（後で複数回使用されるため）
        if target_parent_id and target_parent_id not in entity_cache:
            parent_entity = self.repository.find_by_id(target_parent_id)
            if parent_entity:
                entity_cache[target_parent_id] = parent_entity
        
        # 兄弟ページをリポジトリ経由で取得
        if target_parent_id:
            siblings_entities = self.repository.find_children(target_parent_id)
        else:
            siblings_entities = self.repository.find_all_root_pages()
        
        # 兄弟ページをentity_cacheに追加（cleanup_orphaned_folders_in_parentで再利用）
        for entity_item in siblings_entities:
            if entity_item.id:
                entity_cache[entity_item.id] = entity_item
        
        siblings_entities = [s for s in siblings_entities if s.id != entity.id]
        
        target_in_siblings = any(s.id == target_page_id for s in siblings_entities)
        if not target_in_siblings:
            siblings_entities.append(target_entity)
        
        # 既存のorderを保存（リネーム用）
        old_orders = {}
        for sibling in siblings_entities:
            if sibling.id:
                old_orders[sibling.id] = sibling.order
        
        page_entity = entity
        if page_entity.id:
            old_orders[page_entity.id] = page_entity.order
        
        aggregate = PageAggregate.from_entity_tree(entity)
        siblings = [PageAggregate.from_entity_tree(s) for s in siblings_entities]
        
        aggregate.parent_id = target_parent_id
        aggregate.updated_at = datetime.now()
        
        updated_siblings = aggregate.reorder(target_page_id, position, siblings)
        
        # エンティティをリストにまとめる
        entities_to_update = []
        for sibling in updated_siblings:
            if sibling.id == entity.id:
                sibling.parent_id = target_parent_id
            
            sibling_entity = DtoConverter.aggregate_to_entity(sibling)
            entities_to_update.append(sibling_entity)
        
        if not any(s.id == entity.id for s in updated_siblings):
            updated_siblings.append(aggregate)
            entity_to_update = DtoConverter.aggregate_to_entity(aggregate)
            entities_to_update.append(entity_to_update)
        
        # 一括更新（existing_pages_dictはNoneで渡す）
        saved_entities = self.repository.bulk_update(entities_to_update, None)
        saved_entities_cache = {e.id: e for e in saved_entities}
        
        # entity_cacheに保存済みエンティティも追加
        entity_cache.update(saved_entities_cache)
        
        # デバッグ: キャッシュに全てのエンティティが含まれているか確認
        updated_sibling_ids = {s.id for s in updated_siblings}
        cached_ids = set(entity_cache.keys())
        if updated_sibling_ids != cached_ids:
            print(f"Warning: Cache mismatch. Updated siblings: {updated_sibling_ids}, Cached: {cached_ids}")
        
        if entity.id not in old_orders:
            old_orders[entity.id] = entity.order
        
        return updated_siblings, old_orders, saved_entities_cache, entity_cache
    
    def _handle_order_changes(
        self, 
        updated_siblings: list, 
        old_orders: dict, 
        page_id: int,
        entity_cache: Dict[int, PageEntity]
    ) -> tuple[Set[int], Dict[int, PageEntity]]:
        """order変更時の処理（エンティティキャッシュを返す）"""
        affected_page_ids = set()
        
        for sibling in updated_siblings:
            # キャッシュから取得（必ずキャッシュにあるはず）
            saved_entity = entity_cache.get(sibling.id)
            # キャッシュにない場合は、bulk_updateの結果が正しく保存されていない可能性がある
            if saved_entity is None:
                print(f"Warning: Entity {sibling.id} not found in cache, fetching from DB")
                saved_entity = self.repository.find_by_id(sibling.id)
                if saved_entity:
                    entity_cache[sibling.id] = saved_entity
            
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    affected_page_ids.add(saved_entity.id)
                    try:
                        old_folder_path_str, new_folder_path_str = self.folder_service.rename_folder_on_order_change(saved_entity, old_order)
                        if old_folder_path_str and new_folder_path_str:
                            self.url_service.update_content_urls_after_rename(saved_entity.id, old_folder_path_str, new_folder_path_str, saved_entity)
                        else:
                            self.url_service.update_content_urls_for_page(saved_entity.id, saved_entity)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for page {saved_entity.id}: {e}")
                        traceback.print_exc()
        
        if not any(s.id == page_id for s in updated_siblings):
            # キャッシュから取得（page_idもbulk_updateに含まれているはず）
            saved_entity = entity_cache.get(page_id)
            if saved_entity is None:
                print(f"Warning: Entity {page_id} not found in cache, fetching from DB")
                saved_entity = self.repository.find_by_id(page_id)
                if saved_entity:
                    entity_cache[page_id] = saved_entity
            
            if saved_entity and saved_entity.id in old_orders:
                old_order = old_orders[saved_entity.id]
                if old_order != saved_entity.order:
                    affected_page_ids.add(page_id)
                    try:
                        old_folder_path_str, new_folder_path_str = self.folder_service.rename_folder_on_order_change(saved_entity, old_order)
                        if old_folder_path_str and new_folder_path_str:
                            self.url_service.update_content_urls_after_rename(saved_entity.id, old_folder_path_str, new_folder_path_str, saved_entity)
                        else:
                            self.url_service.update_content_urls_for_page(saved_entity.id, saved_entity)
                    except Exception as e:
                        print(f"Warning: Failed to rename folder for page {saved_entity.id}: {e}")
                        traceback.print_exc()
        
        return affected_page_ids, entity_cache
    
    def _generate_html_for_affected_pages(
        self, 
        updated_siblings: list, 
        page_id: int,
        entity_cache: Dict[int, PageEntity]
    ) -> None:
        """影響を受けたページのHTMLを生成する（キャッシュされたエンティティを使用）"""
        # 親エンティティを事前にキャッシュに追加して重複取得を避ける
        parent_ids = set()
        for sibling in updated_siblings:
            saved_entity = entity_cache.get(sibling.id)
            if saved_entity and saved_entity.parent_id:
                parent_ids.add(saved_entity.parent_id)
        
        saved_entity = entity_cache.get(page_id)
        if saved_entity and saved_entity.parent_id:
            parent_ids.add(saved_entity.parent_id)
        
        # 親エンティティを取得してキャッシュに追加（再帰的に親の親も取得）
        all_parent_ids = set(parent_ids)
        while parent_ids:
            current_parent_ids = parent_ids.copy()
            parent_ids = set()
            
            for parent_id in current_parent_ids:
                if parent_id not in entity_cache:
                    parent_entity = self.repository.find_by_id(parent_id)
                    if parent_entity:
                        entity_cache[parent_id] = parent_entity
                        # 親の親も取得対象に追加
                        if parent_entity.parent_id:
                            parent_ids.add(parent_entity.parent_id)
                            all_parent_ids.add(parent_entity.parent_id)
        
        for sibling in updated_siblings:
            # キャッシュから取得（必ずキャッシュにあるはず）
            saved_entity = entity_cache.get(sibling.id)
            if saved_entity is None:
                print(f"Warning: Entity {sibling.id} not found in cache for HTML generation, skipping")
                continue
            
            if saved_entity:
                try:
                    # エンティティキャッシュを渡して親エンティティの重複取得を避ける
                    self.html_generator.save_html_to_folder(saved_entity, entity_cache)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for page {saved_entity.id}: {e}")
                    traceback.print_exc()
        
        if not any(s.id == page_id for s in updated_siblings):
            # キャッシュから取得（必ずキャッシュにあるはず）
            saved_entity = entity_cache.get(page_id)
            if saved_entity is None:
                print(f"Warning: Entity {page_id} not found in cache for HTML generation, skipping")
                return
            
            if saved_entity:
                try:
                    # エンティティキャッシュを渡して親エンティティの重複取得を避ける
                    self.html_generator.save_html_to_folder(saved_entity, entity_cache)
                except Exception as e:
                    print(f"Warning: Failed to save HTML for moved page {saved_entity.id}: {e}")
                    traceback.print_exc()
