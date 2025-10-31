"""ページのバリデーション"""

from typing import Optional


class PageValidator:
    """ページのバリデーションロジックを担当"""
    
    MAX_TITLE_LENGTH = 200
    
    @staticmethod
    def validate_title(title: Optional[str]) -> None:
        """タイトルのバリデーション"""
        if not title or not title.strip():
            raise ValueError('タイトルは必須です')
        
        if len(title) > PageValidator.MAX_TITLE_LENGTH:
            raise ValueError(f'タイトルは{PageValidator.MAX_TITLE_LENGTH}文字以内で入力してください')
    
    @staticmethod
    def normalize_title(title: str) -> str:
        """タイトルを正規化する"""
        return title.strip()