"""Repository implementations using Django ORM"""

from typing import Optional, List
from datetime import datetime
from django.db import transaction

from ..models import Page
from ..domain.entities import PageEntity
from ..domain.repositories import PageRepositoryInterface


class PageRepository(PageRepositoryInterface):
    """Page repository implementation"""
    
    def _to_entity(self, page: Page, load_children: bool = False) -> PageEntity:
        """Convert Django model to domain entity"""
        entity = PageEntity(
            id=page.id,
            title=page.title,
            content=page.content,
            icon=getattr(page, 'icon', '📄'),
            parent_id=page.parent_id,
            created_at=page.created_at,
            updated_at=page.updated_at,
            children=[]
        )
        
        if load_children:
            children = page.children.all().order_by('created_at')
            entity.children = [self._to_entity(child, load_children=True) for child in children]
        
        return entity
    
    def _to_model(self, entity: PageEntity, existing_page: Optional[Page] = None) -> Page:
        """Convert domain entity to Django model"""
        if existing_page:
            page = existing_page
            page.title = entity.title
            page.content = entity.content
            page.icon = entity.icon
            if entity.parent_id:
                page.parent_id = entity.parent_id
        else:
            page = Page(
                title=entity.title,
                content=entity.content,
                icon=entity.icon,
                parent_id=entity.parent_id
            )
        
        return page
    
    def find_by_id(self, page_id: int) -> Optional[PageEntity]:
        """Find page by ID"""
        try:
            page = Page.objects.get(id=page_id)
            return self._to_entity(page)
        except Page.DoesNotExist:
            return None
    
    def find_all_root_pages(self) -> List[PageEntity]:
        """Find all root pages"""
        pages = Page.objects.filter(parent=None).order_by('created_at')
        return [self._to_entity(page) for page in pages]
    
    def find_all_pages(self) -> List[PageEntity]:
        """Find all pages"""
        pages = Page.objects.all().order_by('created_at')
        return [self._to_entity(page) for page in pages]
    
    def find_children(self, page_id: int) -> List[PageEntity]:
        """Find all children of a page"""
        pages = Page.objects.filter(parent_id=page_id).order_by('created_at')
        return [self._to_entity(page) for page in pages]
    
    def save(self, entity: PageEntity) -> PageEntity:
        """Save page entity"""
        entity.validate()
        
        if entity.id:
            # Update existing
            try:
                existing_page = Page.objects.get(id=entity.id)
                page = self._to_model(entity, existing_page)
            except Page.DoesNotExist:
                page = self._to_model(entity)
        else:
            # Create new
            page = self._to_model(entity)
        
        page.save()
        return self._to_entity(page)
    
    @transaction.atomic
    def delete(self, page_id: int) -> None:
        """Delete page and all its children recursively"""
        try:
            page = Page.objects.get(id=page_id)
            
            def delete_recursive(p: Page):
                for child in p.children.all():
                    delete_recursive(child)
                p.delete()
            
            delete_recursive(page)
        except Page.DoesNotExist:
            pass
    
    def find_with_all_descendants(self, page_id: int) -> Optional[PageEntity]:
        """Find page with all descendants loaded"""
        try:
            page = Page.objects.get(id=page_id)
            return self._to_entity(page, load_children=True)
        except Page.DoesNotExist:
            return None

