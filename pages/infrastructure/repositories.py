"""Django ORM を用いたリポジトリ実装"""

from typing import Optional, List
from datetime import datetime
from django.db import transaction

from ..models import Page
from ..domain.page_aggregate import PageEntity
from ..domain.repositories import PageRepositoryInterface


class PageRepository(PageRepositoryInterface):
    """Page リポジトリの実装"""
    
    def _to_entity(self, page: Page, load_children: bool = False) -> PageEntity:
        """Django のモデルをドメインエンティティへ変換"""
        entity = PageEntity(
            id=page.id,
            title=page.title,
            content=page.content,
            icon=getattr(page, 'icon', '📄'),
            parent_id=page.parent_id,
            order=page.order,
            created_at=page.created_at,
            updated_at=page.updated_at,
            children=[]
        )
        
        if load_children:
            children = page.children.all().order_by('created_at')
            entity.children = [self._to_entity(child, load_children=True) for child in children]
        
        return entity
    
    def _to_model(self, entity: PageEntity, existing_page: Optional[Page] = None) -> Page:
        """ドメインエンティティを Django モデルへ変換"""
        if existing_page:
            page = existing_page
            page.title = entity.title
            page.content = entity.content
            page.icon = entity.icon
            page.order = entity.order
            # parent_idがNoneでも更新する
            page.parent_id = entity.parent_id
        else:
            page = Page(
                title=entity.title,
                content=entity.content,
                icon=entity.icon,
                parent_id=entity.parent_id,
                order=entity.order
            )
        
        return page
    
    def find_by_id(self, page_id: int) -> Optional[PageEntity]:
        """ID でページを検索"""
        try:
            page = Page.objects.get(id=page_id)
            return self._to_entity(page)
        except Page.DoesNotExist:
            return None
    
    def find_all_root_pages(self) -> List[PageEntity]:
        """ルート直下のページをすべて取得"""
        pages = Page.objects.filter(parent=None).order_by('order', 'created_at')
        return [self._to_entity(page) for page in pages]
    
    def find_all_pages(self) -> List[PageEntity]:
        """全ページを取得"""
        pages = Page.objects.all().order_by('order', 'created_at')
        return [self._to_entity(page) for page in pages]
    
    def find_children(self, page_id: int) -> List[PageEntity]:
        """指定ページの子ページをすべて取得"""
        pages = Page.objects.filter(parent_id=page_id).order_by('order', 'created_at')
        return [self._to_entity(page) for page in pages]
    
    def save(self, entity: PageEntity) -> PageEntity:
        """ページエンティティを保存"""
        entity.validate()
        
        if entity.id:
            # 既存レコードを更新
            try:
                existing_page = Page.objects.get(id=entity.id)
                page = self._to_model(entity, existing_page)
            except Page.DoesNotExist:
                page = self._to_model(entity)
        else:
            # 新規作成
            page = self._to_model(entity)
        
        page.save()
        return self._to_entity(page)
    
    @transaction.atomic
    def delete(self, page_id: int) -> None:
        """ページとその子孫を再帰的に削除"""
        try:
            page = Page.objects.get(id=page_id)
            
            def delete_recursive(p: Page):
                # 再帰的に子を削除してから自身を削除
                for child in p.children.all():
                    delete_recursive(child)
                p.delete()
            
            delete_recursive(page)
        except Page.DoesNotExist:
            pass
    
    def find_with_all_descendants(self, page_id: int) -> Optional[PageEntity]:
        """指定ページを、全ての子孫を読み込んだ状態で取得"""
        try:
            page = Page.objects.get(id=page_id)
            return self._to_entity(page, load_children=True)
        except Page.DoesNotExist:
            return None
