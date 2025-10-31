"""ページCRUD操作ビュー"""

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from ..application.dto import CreatePageDTO, UpdatePageDTO
from .utils import _get_service


def index(request):
    """インデックスページ：ページツリーを表示"""
    service = _get_service()
    tree_data = service.get_page_tree()
    return render(request, 'pages/index.html', tree_data)


@require_http_methods(["POST"])
def page_create(request):
    """ページを新規作成"""
    title = request.POST.get('title', '').strip()
    content = request.POST.get('content', '')
    parent_id = request.POST.get('parent_id')
    
    if not title:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'タイトルは必須です'}, status=400)
        return redirect('pages:index')
    
    # parent_id を int もしくは None に変換
    try:
        parent_id = int(parent_id) if parent_id and parent_id.strip() else None
    except (ValueError, AttributeError):
        parent_id = None
    
    service = _get_service()
    dto = CreatePageDTO(
        title=title,
        content=content,
        parent_id=parent_id
    )
    
    try:
        page = service.create_page(dto)
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'page_id': page.id})
        
        return redirect('pages:index')
    
    except ValueError as e:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
        return redirect('pages:index')


@require_http_methods(["POST"])
def page_update(request, page_id):
    """ページを更新"""
    title = request.POST.get('title', '').strip()
    content = request.POST.get('content', '')
    
    if not title:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'タイトルは必須です'}, status=400)
        return redirect('pages:page_detail', page_id=page_id)
    
    service = _get_service()
    dto = UpdatePageDTO(
        page_id=page_id,
        title=title,
        content=content
    )
    
    try:
        page = service.update_page(dto)
        
        if page is None:
            from django.http import Http404
            raise Http404('ページが見つかりません')
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': True})
        
        return redirect('pages:page_detail', page_id=page_id)
    
    except ValueError as e:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
        return redirect('pages:page_detail', page_id=page_id)


@require_http_methods(["POST"])
def page_delete(request, page_id):
    """ページとその子ページを削除"""
    service = _get_service()
    
    # 削除前に親IDを取得
    page = service.get_page_detail(page_id)
    parent_id = page.parent_id if page else None
    
    success = service.delete_page(page_id)
    
    if not success:
        from django.http import Http404
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
        raise Http404('ページが見つかりません')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})
    
    if parent_id:
        return redirect('pages:page_detail', page_id=parent_id)
    return redirect('pages:index')
