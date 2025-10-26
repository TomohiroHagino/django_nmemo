"""ページ用のドメインエンティティ"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List


@dataclass
class PageEntity:
    """ビジネスロジックを持つページのドメインエンティティ"""
    id: Optional[int]
    title: str
    content: str
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    icon: str = '📄'
    children: List['PageEntity'] = field(default_factory=list)

    def validate(self) -> None:
        """エンティティの状態を検証する"""
        if not self.title or not self.title.strip():
            raise ValueError('タイトルは必須です')
        
        if len(self.title) > 200:
            raise ValueError('タイトルは200文字以内で入力してください')
    
    def update_title(self, title: str) -> None:
        """バリデーションを行いタイトルを更新する"""
        if not title or not title.strip():
            raise ValueError('タイトルは必須です')
        self.title = title.strip()
    
    def update_content(self, content: str) -> None:
        """コンテンツを更新する"""
        self.content = content
    
    def add_child(self, child: 'PageEntity') -> None:
        """子ページを追加する"""
        if child.parent_id != self.id:
            raise ValueError('親ページIDが一致しません')
        self.children.append(child)
    
    def get_all_descendants(self) -> List['PageEntity']:
        """すべての子孫ページを再帰的に取得する"""
        descendants = []
        for child in self.children:
            descendants.append(child)
            descendants.extend(child.get_all_descendants())
        return descendants
    
    def to_dict(self) -> dict:
        """エクスポート用に辞書へ変換する"""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'children': [child.to_dict() for child in self.children]
        }
