"""API関連ビュー"""

from django.http import JsonResponse

from .utils import _get_service


def api_page_detail(request, page_id):
    """ページ詳細を JSON で返す API エンドポイント"""
    service = _get_service()
    page = service.get_page_detail(page_id)
    
    if page is None:
        return JsonResponse({'error': 'ページが見つかりません'}, status=404)
    
    return JsonResponse({
        'id': page.id,
        'title': page.title,
        'content': page.content,
        'icon': page.icon,
        'parent_id': page.parent_id,
        'created_at': page.created_at,
        'updated_at': page.updated_at
    })
