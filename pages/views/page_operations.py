"""ページ操作ビュー（移動、並び替え、アイコン更新）"""

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .utils import _get_service


@require_http_methods(["POST"])
def page_move(request, page_id):
    """ページを別の親の配下へ移動"""
    service = _get_service()
    
    # リクエストから新しい親IDを取得（ルートに移動する場合は None）
    new_parent_id = request.POST.get('new_parent_id', '').strip()
    
    # 空文字列または None の場合はルートに移動
    if new_parent_id:
        try:
            new_parent_id = int(new_parent_id)
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': '無効な親ページIDです'}, status=400)
    else:
        new_parent_id = None
    
    try:
        result = service.move_page(page_id, new_parent_id)
        if result is None:
            return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
        return JsonResponse({'success': True})
    except ValueError as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["POST"])
def page_update_icon(request, page_id):
    """ページのアイコンを更新"""
    icon = request.POST.get('icon', '📄')
    
    # アイコンの検証（1文字・絵文字想定。長すぎる値は拒否）
    if len(icon) > 10:
        return JsonResponse({'success': False, 'error': '無効なアイコンです'}, status=400)
    
    service = _get_service()
    
    try:
        result = service.update_page_icon(page_id, icon)
        if result is None:
            return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["POST"])
def page_reorder(request, page_id):
    """ページの並び替え：ターゲットの前後に挿入"""
    target_page_id = request.POST.get('target_page_id')
    position = request.POST.get('position', 'before')  # 'before' または 'after'
    
    if not target_page_id:
        return JsonResponse({'success': False, 'error': 'ターゲットページIDが必要です'}, status=400)
    
    if position not in ['before', 'after']:
        return JsonResponse({'success': False, 'error': 'positionはbeforeまたはafterである必要があります'}, status=400)
    
    try:
        target_page_id = int(target_page_id)
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': '無効なターゲットページIDです'}, status=400)
    
    service = _get_service()
    
    try:
        result = service.reorder_page(page_id, target_page_id, position)
        if result is None:
            return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
