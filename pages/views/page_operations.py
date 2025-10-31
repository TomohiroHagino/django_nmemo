"""ページ操作ビュー（移動、並び替え、アイコン更新）"""

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from ..application.dto import UpdatePageDTO
from .utils import _get_service


@require_http_methods(["POST"])
def page_move(request, page_id):
    """ページを別の親の配下へ移動"""
    service = _get_service()
    
    # リクエストから新しい親IDを取得（ルートに移動する場合は None）
    new_parent_id = request.POST.get('new_parent_id')
    if new_parent_id:
        try:
            new_parent_id = int(new_parent_id)
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': '無効な親ページIDです'}, status=400)
    else:
        new_parent_id = None
    
    # 対象ページを取得
    page = service.get_page_detail(page_id)
    if page is None:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    
    # 循環参照の防止チェック
    if new_parent_id is not None:
        if new_parent_id == page_id:
            return JsonResponse({'success': False, 'error': '自分自身を親にはできません'}, status=400)
        
        # 新しい親が現在のページの子孫でないことを確認
        current = service.get_page_detail(new_parent_id)
        while current and current.parent_id:
            if current.parent_id == page_id:
                return JsonResponse({'success': False, 'error': '子孫ページを親にはできません'}, status=400)
            current = service.get_page_detail(current.parent_id)
    
    # ページ情報の更新（タイトルや本文は現状維持）
    dto = UpdatePageDTO(
        page_id=page_id,
        title=page.title,
        content=page.content
    )
    
    # モデルを直接更新して親を付け替え
    from ..models import Page as PageModel
    try:
        page_model = PageModel.objects.get(id=page_id)
        page_model.parent_id = new_parent_id
        page_model.save()
        
        return JsonResponse({'success': True})
    except PageModel.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
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
    page = service.get_page_detail(page_id)
    
    if page is None:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    
    # モデルを直接更新してアイコンを保存
    from ..models import Page as PageModel
    try:
        page_model = PageModel.objects.get(id=page_id)
        page_model.icon = icon
        page_model.save()
        
        return JsonResponse({'success': True})
    except PageModel.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["POST"])
def page_reorder(request, page_id):
    """ページの並び替え：ターゲットの前後に挿入"""
    from ..models import Page as PageModel
    
    target_page_id = request.POST.get('target_page_id')
    position = request.POST.get('position', 'before')  # 'before' または 'after'
    
    if not target_page_id:
        return JsonResponse({'success': False, 'error': 'ターゲットページIDが必要です'}, status=400)
    
    try:
        target_page_id = int(target_page_id)
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': '無効なターゲットページIDです'}, status=400)
    
    try:
        page = PageModel.objects.get(id=page_id)
        target_page = PageModel.objects.get(id=target_page_id)
        
        # 親をターゲットページと同じに変更
        page.parent = target_page.parent
        
        # 兄弟（同一親配下のページ、移動対象を含む）を取得
        siblings = list(PageModel.objects.filter(parent=target_page.parent).order_by('order', 'created_at'))
        
        # 現在位置から移動対象を除去
        siblings = [s for s in siblings if s.id != page_id]
        
        # ターゲット位置を見つけて前後に挿入
        new_siblings = []
        inserted = False
        for sibling in siblings:
            if sibling.id == target_page_id:
                if position == 'before':
                    new_siblings.append(page)
                    new_siblings.append(sibling)
                else:  # after
                    new_siblings.append(sibling)
                    new_siblings.append(page)
                inserted = True
            else:
                new_siblings.append(sibling)
        
        # 万が一ターゲットが見つからない場合は末尾に追加（通常は発生しない想定）
        if not inserted:
            new_siblings.append(page)
        
        # 並び順を一括更新（10刻みで設定し、後続の並び替えを容易にする）
        for idx, sibling in enumerate(new_siblings):
            sibling.order = idx * 10
            sibling.save()
        
        return JsonResponse({'success': True})
    except PageModel.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
