"""Views for pages (Presentation Layer)"""

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
    """Get application service instance"""
    repository = PageRepository()
    return PageApplicationService(repository)


def index(request):
    """Index page - display all pages in tree structure"""
    service = _get_service()
    tree_data = service.get_page_tree()
    return render(request, 'pages/index.html', tree_data)


@require_http_methods(["POST"])
def page_create(request):
    """Create a new page"""
    title = request.POST.get('title', '').strip()
    content = request.POST.get('content', '')
    parent_id = request.POST.get('parent_id')
    
    if not title:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'タイトルは必須です'}, status=400)
        return redirect('pages:index')
    
    # Convert parent_id to int or None
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
        
        # Redirect to index page (will show the new page in the tree)
        return redirect('pages:index')
    
    except ValueError as e:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
        return redirect('pages:index')


@require_http_methods(["POST"])
def page_update(request, page_id):
    """Update a page"""
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
    """Delete a page and all its children"""
    service = _get_service()
    
    # Get parent ID before deletion
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
    """Move a page to a different parent"""
    service = _get_service()
    
    # Get new parent ID from request (None for root level)
    new_parent_id = request.POST.get('new_parent_id')
    if new_parent_id:
        try:
            new_parent_id = int(new_parent_id)
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': '無効な親ページIDです'}, status=400)
    else:
        new_parent_id = None
    
    # Get the page
    page = service.get_page_detail(page_id)
    if page is None:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    
    # Check for circular reference
    if new_parent_id is not None:
        if new_parent_id == page_id:
            return JsonResponse({'success': False, 'error': '自分自身を親にはできません'}, status=400)
        
        # Check if new parent is a descendant of current page
        current = service.get_page_detail(new_parent_id)
        while current and current.parent_id:
            if current.parent_id == page_id:
                return JsonResponse({'success': False, 'error': '子孫ページを親にはできません'}, status=400)
            current = service.get_page_detail(current.parent_id)
    
    # Update the page
    from .application.dto import UpdatePageDTO
    dto = UpdatePageDTO(
        page_id=page_id,
        title=page.title,
        content=page.content
    )
    
    # Update parent directly in the model
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
    """Export page and all children as JSON"""
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
    """Export page as standalone HTML file with embedded images"""
    service = _get_service()
    html_content = service.export_page_as_html(page_id)
    
    if html_content is None:
        raise Http404('ページが見つかりません')
    
    # Get page title for filename
    page = service.get_page_detail(page_id)
    filename = f'{page.title}.html' if page else f'page_{page_id}.html'
    
    # Sanitize filename
    import re
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    response = HttpResponse(
        html_content,
        content_type='text/html; charset=utf-8'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response


def api_page_detail(request, page_id):
    """API endpoint to get page detail as JSON"""
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
    """Upload image for rich text editor"""
    if 'image' not in request.FILES:
        return JsonResponse({'error': '画像ファイルが必要です'}, status=400)
    
    # Get page_id from request
    page_id = request.POST.get('page_id')
    if not page_id:
        return JsonResponse({'error': 'ページIDが必要です'}, status=400)
    
    image = request.FILES['image']
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if image.content_type not in allowed_types:
        return JsonResponse({'error': '許可されていないファイル形式です'}, status=400)
    
    # Validate file size (max 5MB)
    if image.size > 5 * 1024 * 1024:
        return JsonResponse({'error': 'ファイルサイズは5MB以下にしてください'}, status=400)
    
    # Generate unique filename and save in page-specific folder
    ext = os.path.splitext(image.name)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join('uploads', f'page_{page_id}', filename)
    
    # Save file
    saved_path = default_storage.save(filepath, image)
    
    # Return URL
    image_url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    
    return JsonResponse({
        'success': True,
        'url': image_url
    })


@require_http_methods(["POST"])
def upload_video(request):
    """Upload video for rich text editor"""
    if 'video' not in request.FILES:
        return JsonResponse({'error': '動画ファイルが必要です'}, status=400)
    
    # Get page_id from request
    page_id = request.POST.get('page_id')
    if not page_id:
        return JsonResponse({'error': 'ページIDが必要です'}, status=400)
    
    video = request.FILES['video']
    
    # Validate file type
    allowed_types = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if video.content_type not in allowed_types:
        return JsonResponse({'error': '許可されていないファイル形式です（mp4, webm, ogg, mov）'}, status=400)
    
    # Validate file size (max 50MB)
    if video.size > 50 * 1024 * 1024:
        return JsonResponse({'error': 'ファイルサイズは50MB以下にしてください'}, status=400)
    
    # Generate unique filename and save in page-specific folder
    ext = os.path.splitext(video.name)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join('uploads', f'page_{page_id}', filename)
    
    # Save file
    saved_path = default_storage.save(filepath, video)
    
    # Return URL
    video_url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    
    return JsonResponse({
        'success': True,
        'url': video_url
    })


@require_http_methods(["POST"])
def page_update_icon(request, page_id):
    """Update page icon"""
    icon = request.POST.get('icon', '📄')
    
    # Validate icon (should be a single character/emoji)
    if len(icon) > 10:
        return JsonResponse({'success': False, 'error': '無効なアイコンです'}, status=400)
    
    service = _get_service()
    page = service.get_page_detail(page_id)
    
    if page is None:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    
    # Update icon directly in the model
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
    """Reorder pages by inserting before or after target"""
    from .models import Page as PageModel
    
    target_page_id = request.POST.get('target_page_id')
    position = request.POST.get('position', 'before')  # 'before' or 'after'
    
    if not target_page_id:
        return JsonResponse({'success': False, 'error': 'ターゲットページIDが必要です'}, status=400)
    
    try:
        target_page_id = int(target_page_id)
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': '無効なターゲットページIDです'}, status=400)
    
    try:
        page = PageModel.objects.get(id=page_id)
        target_page = PageModel.objects.get(id=target_page_id)
        
        # Get all siblings (pages with same parent as target)
        siblings = list(PageModel.objects.filter(parent=target_page.parent).order_by('order', 'created_at'))
        
        # Remove the page from its current position if it's in the list
        siblings = [s for s in siblings if s.id != page_id]
        
        # Find target position and insert
        new_siblings = []
        for sibling in siblings:
            if sibling.id == target_page_id:
                if position == 'before':
                    new_siblings.append(page)
                    new_siblings.append(sibling)
                else:  # after
                    new_siblings.append(sibling)
                    new_siblings.append(page)
            else:
                new_siblings.append(sibling)
        
        # Update order for all siblings
        for idx, sibling in enumerate(new_siblings):
            sibling.order = idx * 10  # Use increments of 10 for easier reordering
            sibling.parent = target_page.parent  # Update parent for moved page
            sibling.save()
        
        return JsonResponse({'success': True})
    except PageModel.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'ページが見つかりません'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
