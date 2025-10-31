"""HTML生成サービス"""

import base64
import re
from pathlib import Path
from django.conf import settings

from ...domain.page_aggregate import PageEntity


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
    
    def __init__(self):
        self.media_root = Path(settings.MEDIA_ROOT)
    
    def generate_html_content(self, entity: PageEntity) -> str:
        """画像を埋め込んだHTMLコンテンツを生成する"""
        content = entity.content
        
        # コンテンツ内の画像を検出して base64 に埋め込み
        pattern = r'<img([^>]*)src=["\']([^"\']+)["\']([^>]*)>'
        embedded_content = re.sub(pattern, self._replace_image_with_base64, content)
        
        # HTML ドキュメントを構築
        return self._build_html_document(entity, embedded_content)
    
    def save_html_to_folder(self, entity: PageEntity) -> None:
        """ページのHTML版を画像フォルダに保存する"""
        page_folder = self.media_root / 'uploads' / f'page_{entity.id}'
        
        # ページフォルダが存在しなければ作成
        page_folder.mkdir(parents=True, exist_ok=True)
        
        # HTML コンテンツを生成
        html_content = self.generate_html_content(entity)
        
        # ファイル名をサニタイズ
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', entity.title)
        html_filename = f'{safe_title}.html'
        html_path = page_folder / html_filename
        
        try:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
        except Exception as e:
            print(f"Warning: Failed to save HTML to {html_path}: {e}")
    
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
