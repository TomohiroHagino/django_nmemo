"""データ転送オブジェクト（DTO）"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class CreatePageDTO:
    """ページを作成するためのDTO"""
    title: str
    content: str
    parent_id: Optional[int] = None


@dataclass
class UpdatePageDTO:
    """ページを更新するためのDTO"""
    page_id: int
    title: str
    content: str


@dataclass
class PageDTO:
    """ページデータを表すDTO"""
    id: int
    title: str
    content: str
    icon: str
    parent_id: Optional[int]
    created_at: str
    updated_at: str
