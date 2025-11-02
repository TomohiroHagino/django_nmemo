"""HTML生成サービス"""

import base64
import re
import traceback
from pathlib import Path
from django.conf import settings
from .media_service import MediaService
from ...domain.page_aggregate import PageEntity
from ...infrastructure.repositories import PageRepository
from typing import Optional, Dict


class HtmlGenerator:
    """HTML生成を担当するサービス"""
    
    MIME_TYPES = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    }
    
    def __init__(self, media_service=None):
        self.media_root = Path(settings.MEDIA_ROOT)
        self.media_service = media_service
    
    def generate_html_content(self, entity: PageEntity) -> str:
        """画像を埋め込んだHTMLコンテンツを生成する"""
        content = entity.content
        
        # コンテンツ内の画像を検出して base64 に埋め込み
        pattern = r'<img([^>]*)src=["\']([^"\']+)["\']([^>]*)>'
        embedded_content = re.sub(pattern, self._replace_image_with_base64, content)
        
        # HTML ドキュメントを構築
        return self._build_html_document(entity, embedded_content)
    
    def save_html_to_folder(self, entity: PageEntity, entity_cache: Optional[Dict[int, PageEntity]] = None) -> None:
        """ページのHTML版を画像フォルダに保存する
        
        Args:
            entity: 保存するページエンティティ
            entity_cache: エンティティキャッシュ（親エンティティの取得を最適化するため）
        """
        
        # media_serviceが渡されている場合はそれを使用、なければ新規作成
        if self.media_service:
            media_service = self.media_service
        else:
            # フォールバック: repositoryを使用して階層構造のパスを取得
            repository = PageRepository()
            media_service = MediaService(repository)
        
        page_folder = None  # 初期化を追加
        
        # まず、既存のフォルダを検索（orderが変更された場合に対応）
        existing_page_folder = None
        if media_service.repository:
            existing_page_folder = media_service._find_existing_page_folder(entity, entity_cache)
            if existing_page_folder:
                print(f"Found existing page folder: {existing_page_folder}")
            else:
                print(f"No existing page folder found")
        
        # 親フォルダを先に明示的に作成してから、子フォルダを作成
        if entity.parent_id:
            if not media_service.repository:
                # repositoryがない場合はエラーを発生させる
                raise ValueError(f'repository is None but entity has parent_id={entity.parent_id}')
            else:
                # キャッシュから親エンティティを取得、なければDBから取得
                parent_entity = None
                if entity_cache:
                    parent_entity = entity_cache.get(entity.parent_id)
                
                if parent_entity is None:
                    parent_entity = media_service.repository.find_by_id(entity.parent_id)
                    # キャッシュに追加
                    if parent_entity and entity_cache is not None:
                        entity_cache[entity.parent_id] = parent_entity
                
                if parent_entity:
                    # _get_page_folder_absolute_pathを使う（entity_cacheを渡す）
                    parent_folder = media_service._get_page_folder_absolute_path(parent_entity, entity_cache)
                    
                    # 親フォルダが存在しない場合は、既存のフォルダを検索
                    if not parent_folder.exists() or not parent_folder.is_dir():
                        existing_parent_folder = media_service._find_existing_parent_folder(parent_entity, entity_cache)
                        if existing_parent_folder:
                            parent_folder = existing_parent_folder
                        else:
                            raise ValueError(f'親ページ（ID: {entity.parent_id}）のフォルダが存在しません。親ページを先に保存してください。')
                    else:
                        print(f"Parent folder exists: {parent_folder}")
                    
                    # 既存のフォルダがある場合はそれを使用、なければ新しいフォルダを作成
                    if existing_page_folder and existing_page_folder.exists():
                        page_folder = existing_page_folder
                        print(f"Using existing page folder: {page_folder}")
                    else:
                        # 親フォルダが存在する場合のみ、子フォルダを作成
                        safe_title = re.sub(r'[<>:"/\\|?*]', '_', entity.title)
                        folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                        
                        # 正しい階層構造で子フォルダを作成（親フォルダの直下）
                        page_folder = parent_folder / folder_name
                        page_folder.mkdir(parents=False, exist_ok=True)
                else:
                    raise ValueError(f'親ページ（ID: {entity.parent_id}）が見つかりません。')
        else:
            # ルートページの場合
            if existing_page_folder and existing_page_folder.exists():
                page_folder = existing_page_folder
            else:
                # get_page_folder_pathを使わずに、子フォルダ名を直接計算
                safe_title = re.sub(r'[<>:"/\\|?*]', '_', entity.title)
                folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                page_folder = self.media_root / 'uploads' / folder_name
                page_folder.mkdir(parents=False, exist_ok=True)
        
        # page_folderが設定されていることを確認
        if page_folder is None:
            raise ValueError(f'ページフォルダが設定できませんでした。entity.id={entity.id}, entity.parent_id={entity.parent_id}')
        
        # フォルダが存在することを確認
        if not page_folder.exists() or not page_folder.is_dir():
            raise ValueError(f'ページフォルダが存在しません: {page_folder}')
        
        # 親フォルダが作成された場合、親ページのHTMLファイルも作成する
        if entity.parent_id and media_service.repository:
            # キャッシュから親エンティティを取得（上で取得済みの場合は再利用）
            parent_entity = None
            if entity_cache:
                parent_entity = entity_cache.get(entity.parent_id)
            
            if parent_entity is None:
                parent_entity = media_service.repository.find_by_id(entity.parent_id)
                # キャッシュに追加
                if parent_entity and entity_cache is not None:
                    entity_cache[entity.parent_id] = parent_entity
                    
            if parent_entity:
                # _get_page_folder_absolute_pathを使う（entity_cacheを渡す）
                parent_folder = media_service._get_page_folder_absolute_path(parent_entity, entity_cache)
                
                # 親フォルダが存在しない場合は、既存のフォルダを検索
                if not parent_folder.exists() or not parent_folder.is_dir():
                    existing_folder = media_service._find_existing_parent_folder(parent_entity, entity_cache)
                    if existing_folder:
                        parent_folder = existing_folder
                
                # 親フォルダが存在し、HTMLファイルがない場合
                if parent_folder.exists() and parent_folder.is_dir():
                    parent_safe_title = re.sub(r'[<>:"/\\|?*]', '_', parent_entity.title)
                    parent_html_file = parent_folder / f'{parent_safe_title}.html'
                    if not parent_html_file.exists():
                        # 親ページのHTMLファイルを作成
                        parent_html_content = self.generate_html_content(parent_entity)
                        try:
                            with open(parent_html_file, 'w', encoding='utf-8') as f:
                                f.write(parent_html_content)
                        except Exception as e:
                            print(f"Warning: Failed to save parent HTML to {parent_html_file}: {e}")
        
        # HTML コンテンツを生成
        html_content = self.generate_html_content(entity)
        
        # ファイル名をサニタイズ
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', entity.title)
        html_filename = f'{safe_title}.html'
        html_path = page_folder / html_filename
        
        try:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"✓ HTML file saved to {html_path} (folder: {page_folder.name})")  # 成功ログを追加
        except Exception as e:
            error_msg = f"Warning: Failed to save HTML to {html_path}: {e}"
            print(error_msg)
            traceback.print_exc()  # スタックトレースを出力
            raise  # 例外を再発生させて、呼び出し元で処理できるようにする
    
    def _replace_image_with_base64(self, match: re.Match) -> str:
        """画像タグをbase64埋め込み形式に変換する"""
        before_src = match.group(1)
        img_url = match.group(2)
        after_src = match.group(3)
        
        # ローカルのメディアURLであれば base64 へ変換
        if img_url.startswith('/media/'):
            relative_path = img_url.replace('/media/', '')
            file_path = self.media_root / relative_path
            
            if file_path.exists() and file_path.is_file():
                try:
                    with open(file_path, 'rb') as f:
                        image_data = f.read()
                        image_base64 = base64.b64encode(image_data).decode('utf-8')
                        
                        # 拡張子から MIME タイプを判定
                        ext = file_path.suffix.lower()
                        mime_type = self.MIME_TYPES.get(ext, 'image/png')
                        
                        # data URL を生成
                        data_url = f'data:{mime_type};base64,{image_base64}'
                        return f'<img{before_src}src="{data_url}"{after_src}>'
                except Exception as e:
                    print(f"Warning: Failed to embed image {file_path}: {e}")
        
        # ローカル画像でない、または処理失敗時はそのまま返す
        return match.group(0)
    
    def _build_html_document(self, entity: PageEntity, content: str) -> str:
        """完全なHTMLドキュメントを構築する"""
        return f'''<!DOCTYPE html>
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
            display: flex;
        }}
        .meta p {{
            margin-right: 20px;
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
        {content}
    </div>
    <script>
        // ページロード時にシンタックスハイライトを適用
        document.addEventListener('DOMContentLoaded', function() {{
            hljs.highlightAll();
        }});
    </script>
</body>
</html>'''
