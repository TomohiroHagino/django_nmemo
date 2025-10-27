"""ページ用ビュー（プレゼンテーション層）"""

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse, Http404
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.conf import settings
import os
import uuid

from .application.services import PageApplicationService
from .application.dto import CreatePageDTO, UpdatePageDTO
from .infrastructure.repositories import PageRepository


def _get_service() -> PageApplicationService:
    """アプリケーションサービスのインスタンスを取得"""
    repository = PageRepository()
    return PageApplicationService(repository)


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
        
        # インデックスにリダイレクト（新規ページはツリーに反映される）
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
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
        raise Http404('ページが見つかりません')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})
    
    if parent_id:
        return redirect('pages:page_detail', page_id=parent_id)
    return redirect('pages:index')


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
    from .application.dto import UpdatePageDTO
    dto = UpdatePageDTO(
        page_id=page_id,
        title=page.title,
        content=page.content
    )
    
    # モデルを直接更新して親を付け替え
    from .models import Page as PageModel
    try:
        page_model = PageModel.objects.get(id=page_id)
        page_model.parent_id = new_parent_id
        page_model.save()
        
        return JsonResponse({'success': True})
    except PageModel.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def export_page(request, page_id):
    """ページと子孫を JSON としてエクスポート"""
    service = _get_service()
    json_data = service.export_page(page_id)
    
    if json_data is None:
        raise Http404('ページが見つかりません')
    
    response = HttpResponse(
        json_data,
        content_type='application/json; charset=utf-8'
    )
    response['Content-Disposition'] = f'attachment; filename=page_{page_id}.json'
    
    return response


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
    import re
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    response = HttpResponse(
        html_content,
        content_type='text/html; charset=utf-8'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response


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


@require_http_methods(["POST"])
def upload_image(request):
    """リッチテキストエディタ用：画像アップロード"""
    if 'image' not in request.FILES:
        return JsonResponse({'error': '画像ファイルが必要です'}, status=400)
    
    # リクエストから page_id を取得
    page_id = request.POST.get('page_id')
    if not page_id:
        return JsonResponse({'error': 'ページIDが必要です'}, status=400)
    
    image = request.FILES['image']
    
    # ファイル種別の検証
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if image.content_type not in allowed_types:
        return JsonResponse({'error': '許可されていないファイル形式です'}, status=400)
    
    # ファイルサイズの検証（最大 5MB）
    if image.size > 5 * 1024 * 1024:
        return JsonResponse({'error': 'ファイルサイズは5MB以下にしてください'}, status=400)
    
    # 一意のファイル名を生成し、ページごとのディレクトリに保存
    ext = os.path.splitext(image.name)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join('uploads', f'page_{page_id}', filename)
    
    # 保存
    saved_path = default_storage.save(filepath, image)
    
    # URL を返却
    image_url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    
    return JsonResponse({
        'success': True,
        'url': image_url
    })


@require_http_methods(["POST"])
def upload_video(request):
    """リッチテキストエディタ用：動画アップロード"""
    if 'video' not in request.FILES:
        return JsonResponse({'error': '動画ファイルが必要です'}, status=400)
    
    # リクエストから page_id を取得
    page_id = request.POST.get('page_id')
    if not page_id:
        return JsonResponse({'error': 'ページIDが必要です'}, status=400)
    
    video = request.FILES['video']
    
    # ファイル種別の検証
    allowed_types = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if video.content_type not in allowed_types:
        return JsonResponse({'error': '許可されていないファイル形式です（mp4, webm, ogg, mov）'}, status=400)
    
    # ファイルサイズの検証（最大 250MB）
    if video.size > 250 * 1024 * 1024:
        return JsonResponse({'error': 'ファイルサイズは250MB以下にしてください'}, status=400)
    
    # 一意のファイル名を生成し、ページごとのディレクトリに保存
    ext = os.path.splitext(video.name)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join('uploads', f'page_{page_id}', filename)
    
    # 保存
    saved_path = default_storage.save(filepath, video)
    
    # URL を返却
    video_url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    
    return JsonResponse({
        'success': True,
        'url': video_url
    })


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
    from .models import Page as PageModel
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
    from .models import Page as PageModel
    
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
