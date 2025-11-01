"""エクスポート関連ビュー"""

import re
from django.http import HttpResponse, Http404

from .utils import _get_service


def export_page_html(request, page_id):
    """ページを埋め込み画像付きの単一 HTML としてエクスポート"""
    service = _get_service()
    html_content = service.export_page_as_html(page_id)
    
    if html_content is None:
        raise Http404('ページが見つかりません')
    
    # ダウンロード用のファイル名にページタイトルを使用
    page = service.get_page_detail(page_id)
    filename = f'{page.title}.html' if page else f'page_{page_id}.html'
    
    # ファイル名をサニタイズ
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    response = HttpResponse(
        html_content,
        content_type='text/html; charset=utf-8'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response