"""アプリケーションサービス（ユースケース）"""

from typing import Optional, List
from datetime import datetime
import json
import shutil
import re
import os
from pathlib import Path
from django.conf import settings

from ..domain.entities import PageEntity
from ..domain.repositories import PageRepositoryInterface
from ..domain.services import PageDomainService
from .dto import CreatePageDTO, UpdatePageDTO, PageDTO


class PageApplicationService:
    """ページ関連ユースケースのためのアプリケーションサービス"""
    
    def __init__(self, repository: PageRepositoryInterface):
        self.repository = repository
        self.domain_service = PageDomainService()
    
    def get_all_root_pages(self) -> List[PageDTO]:
        """ルートページをすべて取得する"""
        entities = self.repository.find_all_root_pages()
        return [self._entity_to_dto(entity) for entity in entities]
    
    def get_page_tree(self) -> dict:
        """すべてのページをツリー構造として取得する"""
        # すべてのページを取得
        all_pages = self.repository.find_all_pages()
        
        # ドメインサービスを使ってツリーを構築
        root_pages = self.domain_service.build_page_tree(all_pages)
        
        # テンプレート向けの dict 構造へ変換
        def entity_to_tree_dict(entity: PageEntity) -> dict:
            return {
                'id': entity.id,
                'title': entity.title,
                'content': entity.content,
                'icon': entity.icon,
                'parent_id': entity.parent_id,
                'created_at': entity.created_at.isoformat(),
                'updated_at': entity.updated_at.isoformat(),
                'children': [entity_to_tree_dict(child) for child in entity.children]
            }
        
        return {
            'pages': [entity_to_tree_dict(page) for page in root_pages]
        }
    
    def get_page_detail(self, page_id: int) -> Optional[PageDTO]:
        """ページ詳細を取得する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        return self._entity_to_dto(entity)
    
    def get_page_with_children(self, page_id: int) -> Optional[tuple[PageDTO, List[PageDTO]]]:
        """ページとその子ページ一覧を取得する"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        children_entities = self.repository.find_children(page_id)
        page_dto = self._entity_to_dto(entity)
        children_dtos = [self._entity_to_dto(child) for child in children_entities]
        
        return page_dto, children_dtos
    
    def create_page(self, dto: CreatePageDTO) -> PageDTO:
        """新規ページを作成する"""
        
        # 親の子ページの中で最大の order を取得して +10
        max_order = 0
        if dto.parent_id:
            siblings = self.repository.find_children(dto.parent_id)
        else:
            siblings = self.repository.find_all_root_pages()
        
        if siblings:
            max_order = max((child.order for child in siblings), default=0)
        
        entity = PageEntity(
            id=None,
            title=dto.title.strip(),
            content=dto.content,
            parent_id=dto.parent_id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            order=max_order + 10,  # 追加
            children=[]
        )
        
        entity.validate()
        saved_entity = self.repository.save(entity)
        
        # 一時フォルダからページ専用フォルダへ画像を移動
        saved_entity.content = self._move_temp_images_to_page_folder(saved_entity.id, saved_entity.content)
        if saved_entity.content != dto.content:
            # 新しい画像URLでコンテンツを更新
            saved_entity = self.repository.save(saved_entity)
        
        # ページフォルダにHTMLファイルを保存（この行を追加）
        self._save_html_to_folder(saved_entity)
        
        return self._entity_to_dto(saved_entity)
    
    def update_page(self, dto: UpdatePageDTO) -> Optional[PageDTO]:
        """ページを更新する"""
        entity = self.repository.find_by_id(dto.page_id)
        if entity is None:
            return None
        
        # 旧コンテンツを保持（削除された画像の判定用）
        old_content = entity.content
        
        entity.update_title(dto.title)
        
        # 更新前に一時画像をページフォルダへ移動
        updated_content = self._move_temp_images_to_page_folder(dto.page_id, dto.content)
        
        entity.update_content(updated_content)
        entity.updated_at = datetime.now()
        
        # 旧→新の比較でコンテンツから削除された画像を物理削除
        self._delete_removed_images(dto.page_id, old_content, updated_content)
        
        # フォルダ内にあるがコンテンツで参照されない孤立画像を削除
        self._delete_orphaned_images(dto.page_id, updated_content)
        
        saved_entity = self.repository.save(entity)
        
        # ページフォルダにHTMLファイルを保存
        self._save_html_to_folder(saved_entity)
        
        return self._entity_to_dto(saved_entity)
    
    def delete_page(self, page_id: int) -> bool:
        """ページとその子孫、関連画像を削除する"""
        entity = self.repository.find_with_all_descendants(page_id)
        if entity is None:
            return False
        
        # 子孫を含め削除対象のページIDを収集
        page_ids_to_delete = self._collect_page_ids(entity)
        
        # DBからページと子ページを削除
        self.repository.delete(page_id)
        
        # 関連する画像フォルダを削除
        self._delete_page_images(page_ids_to_delete)
        
        return True
    
    def _collect_page_ids(self, entity: PageEntity) -> List[int]:
        """子孫を含むすべてのページIDを再帰的に収集する"""
        ids = [entity.id]
        for child in entity.children:
            ids.extend(self._collect_page_ids(child))
        return ids
    
    def _delete_page_images(self, page_ids: List[int]) -> None:
        """指定ページID群の画像フォルダを削除する"""
        media_root = Path(settings.MEDIA_ROOT)
        uploads_dir = media_root / 'uploads'
        
        for page_id in page_ids:
            page_folder = uploads_dir / f'page_{page_id}'
            if page_folder.exists() and page_folder.is_dir():
                try:
                    shutil.rmtree(page_folder)
                except Exception as e:
                    # エラーはログ出力のみ・削除処理自体は継続
                    print(f"Warning: Failed to delete image folder for page {page_id}: {e}")
    
    def _delete_removed_images(self, page_id: int, old_content: str, new_content: str) -> None:
        """コンテンツから削除された画像・動画を物理削除する"""
        media_root = Path(settings.MEDIA_ROOT)
        
        # 旧・新コンテンツから画像・動画URLを抽出
        old_media = self._extract_media_urls(old_content)
        new_media = self._extract_media_urls(new_content)
        
        # 削除対象のURL集合を算出
        removed_media = old_media - new_media
        
        # 削除対象のメディアファイルを削除
        for media_url in removed_media:
            # URL をファイルパスに変換
            # 期待形式: /media/uploads/page_X/filename.ext
            if media_url.startswith('/media/'):
                relative_path = media_url.replace('/media/', '')
                file_path = media_root / relative_path
                
                if file_path.exists() and file_path.is_file():
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"Warning: Failed to delete media {file_path}: {e}")
    
    def _extract_image_urls(self, content: str) -> set:
        """HTMLコンテンツから画像URLをすべて抽出する"""
        import re
        # img の src 属性を抽出
        pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
        matches = re.findall(pattern, content)
        return set(matches)
    
    def _extract_media_urls(self, content: str) -> set:
        """HTMLコンテンツから画像・動画URLをすべて抽出する"""
        import re
        urls = set()
        
        # img の src 属性を抽出
        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
        urls.update(re.findall(img_pattern, content))
        
        # video の src 属性を抽出
        video_pattern = r'<video[^>]+src=["\']([^"\']+)["\']'
        urls.update(re.findall(video_pattern, content))
        
        # source タグの src 属性を抽出（video 内の source タグ対応）
        source_pattern = r'<source[^>]+src=["\']([^"\']+)["\']'
        urls.update(re.findall(source_pattern, content))
        
        return urls
    
    def _delete_orphaned_images(self, page_id: int, content: str) -> None:
        """ページフォルダ内のうちコンテンツで参照されない画像・動画を削除する"""
        media_root = Path(settings.MEDIA_ROOT)
        page_folder = media_root / 'uploads' / f'page_{page_id}'
        
        if not page_folder.exists() or not page_folder.is_dir():
            return
        
        # コンテンツで参照されている画像・動画のファイル名集合を作成
        content_media = self._extract_media_urls(content)
        content_filenames = set()
        for media_url in content_media:
            # URL からファイル名を抽出（/media/uploads/page_X/filename.ext）
            if f'/page_{page_id}/' in media_url:
                filename = os.path.basename(media_url)
                content_filenames.add(filename)
        
        # フォルダ内の画像・動画ファイル一覧を取得（.html は除外）
        folder_files = set()
        media_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', 
                           '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'}
        try:
            for file_path in page_folder.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in media_extensions:
                    folder_files.add(file_path.name)
        except Exception as e:
            print(f"Warning: Failed to list files in {page_folder}: {e}")
            return
        
        # 孤立（未参照）の画像・動画を特定
        orphaned_files = folder_files - content_filenames
        
        # 孤立ファイルを削除
        for filename in orphaned_files:
            file_path = page_folder / filename
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Failed to delete orphaned image {file_path}: {e}")
    
    def _save_html_to_folder(self, entity: PageEntity) -> None:
        """ページのHTML版を画像フォルダに保存する"""
        media_root = Path(settings.MEDIA_ROOT)
        page_folder = media_root / 'uploads' / f'page_{entity.id}'
        
        # ページフォルダが存在しなければ作成
        page_folder.mkdir(parents=True, exist_ok=True)
        
        # HTML コンテンツを生成
        html_content = self._generate_html_content(entity)
        
        # ファイル名をサニタイズ
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', entity.title)
        html_filename = f'{safe_title}.html'
        html_path = page_folder / html_filename
        
        try:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
        except Exception as e:
            print(f"Warning: Failed to save HTML to {html_path}: {e}")
    
    def _generate_html_content(self, entity: PageEntity) -> str:
        """画像を埋め込んだHTMLコンテンツを生成する"""
        import base64
        
        media_root = Path(settings.MEDIA_ROOT)
        content = entity.content
        
        # コンテンツ内の画像を検出して base64 に埋め込み
        pattern = r'<img([^>]*)src=["\']([^"\']+)["\']([^>]*)>'
        
        def replace_image(match):
            before_src = match.group(1)
            img_url = match.group(2)
            after_src = match.group(3)
            
            # ローカルのメディアURLであれば base64 へ変換
            if img_url.startswith('/media/'):
                relative_path = img_url.replace('/media/', '')
                file_path = media_root / relative_path
                
                if file_path.exists() and file_path.is_file():
                    try:
                        with open(file_path, 'rb') as f:
                            image_data = f.read()
                            image_base64 = base64.b64encode(image_data).decode('utf-8')
                            
                            # 拡張子から MIME タイプを判定
                            ext = file_path.suffix.lower()
                            mime_types = {
                                '.jpg': 'image/jpeg',
                                '.jpeg': 'image/jpeg',
                                '.png': 'image/png',
                                '.gif': 'image/gif',
                                '.webp': 'image/webp',
                                '.svg': 'image/svg+xml'
                            }
                            mime_type = mime_types.get(ext, 'image/png')
                            
                            # data URL を生成
                            data_url = f'data:{mime_type};base64,{image_base64}'
                            return f'<img{before_src}src="{data_url}"{after_src}>'
                    except Exception as e:
                        print(f"Warning: Failed to embed image {file_path}: {e}")
            
            # ローカル画像でない、または処理失敗時はそのまま返す
            return match.group(0)
        
        embedded_content = re.sub(pattern, replace_image, content)
        
        # HTML ドキュメントを構築
        html = f'''<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{entity.title}</title>
    <!-- Highlight.js CSS -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/monokai.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }}
        h1 {{
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }}
        .meta {{
            color: #666;
            font-size: 0.9em;
            margin-bottom: 30px;
        }}
        .content {{
            margin-top: 20px;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
        p {{
            margin: 10px 0;
        }}
        /* コードブロック用スタイル */
        pre {{
            padding: 1em;
            overflow-x: auto;
            margin: 1em 0;
        }}
        pre code {{
            display: block;
            padding: 0;
        }}
        /* Quillのコードブロック背景をオーバーライド */
        .ql-syntax {{
            background: transparent !important;
        }}
    </style>
</head>
<body>
    <h1>{entity.title}</h1>
    <div class="meta">
        <p>作成日時: {entity.created_at.strftime('%Y年%m月%d日 %H:%M')}</p>
        <p>更新日時: {entity.updated_at.strftime('%Y年%m月%d日 %H:%M')}</p>
    </div>
    <div class="content">
        {embedded_content}
    </div>
    <script>
        // ページロード時にシンタックスハイライトを適用
        document.addEventListener('DOMContentLoaded', function() {{
            hljs.highlightAll();
        }});
    </script>
</body>
</html>'''
        return html
    
    def export_page(self, page_id: int) -> Optional[str]:
        """ページとその子孫をJSONとしてエクスポートする"""
        entity = self.repository.find_with_all_descendants(page_id)
        if entity is None:
            return None
        
        data = entity.to_dict()
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def export_page_as_html(self, page_id: int) -> Optional[str]:
        """ページを画像埋め込み済み単一HTMLとしてエクスポートする"""
        entity = self.repository.find_by_id(page_id)
        if entity is None:
            return None
        
        return self._generate_html_content(entity)
    
    def _move_temp_images_to_page_folder(self, page_id: int, content: str) -> str:
        """一時フォルダの画像・動画をページ専用フォルダへ移動し、URL を更新する"""
        if not content:
            return content
        
        media_root = Path(settings.MEDIA_ROOT)
        temp_folder = media_root / 'uploads' / 'page_temp'
        page_folder = media_root / 'uploads' / f'page_{page_id}'
        
        # ページフォルダを作成（存在しなければ）
        page_folder.mkdir(parents=True, exist_ok=True)
        
        # content 内の page_temp を参照する画像・動画URLを抽出
        pattern = r'(/media/uploads/page_temp/[^"\'>\s]+)'
        matches = re.findall(pattern, content)
        
        updated_content = content
        for old_url in matches:
            # URL からファイル名を抽出
            filename = old_url.split('/')[-1]
            old_path = temp_folder / filename
            new_path = page_folder / filename
            
            if old_path.exists():
                try:
                    # ファイルを移動
                    shutil.move(str(old_path), str(new_path))
                    
                    # コンテンツ内のURLを更新
                    new_url = f'/media/uploads/page_{page_id}/{filename}'
                    updated_content = updated_content.replace(old_url, new_url)
                    
                    print(f"Moved image: {old_path} -> {new_path}")
                except Exception as e:
                    print(f"Warning: Failed to move image {old_path}: {e}")
        
        # 空になった一時フォルダを掃除
        try:
            if temp_folder.exists() and not any(temp_folder.iterdir()):
                temp_folder.rmdir()
        except Exception:
            pass  # 掃除時のエラーは無視
        
        return updated_content
    
    def _entity_to_dto(self, entity: PageEntity) -> PageDTO:
        """エンティティをDTOに変換する"""
        return PageDTO(
            id=entity.id,
            title=entity.title,
            content=entity.content,
            icon=entity.icon,
            parent_id=entity.parent_id,
            created_at=entity.created_at.isoformat(),
            updated_at=entity.updated_at.isoformat()
        )
