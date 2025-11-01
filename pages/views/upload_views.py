"""ファイルアップロード関連ビュー"""

import os
import re
import uuid
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.conf import settings
from pages.infrastructure.repositories import PageRepository
from pages.application.page_service.media_service import MediaService


def _get_page_folder_path(page_id: int) -> str:
    """ページIDから階層構造のフォルダパスを取得"""
    repository = PageRepository()
    media_service = MediaService(repository)
    folder_path = media_service.get_page_folder_path_by_id(page_id)
    return str(folder_path).replace('\\', '/')


def _validate_and_save_file(
    request,
    file_key: str,
    allowed_types: list,
    allowed_extensions: list,
    max_size: int,
    use_original_name: bool = False
):
    """ファイルアップロードの共通処理"""
    if file_key not in request.FILES:
        return JsonResponse({'error': f'{file_key}ファイルが必要です'}, status=400)
    
    page_id = request.POST.get('page_id')
    if not page_id:
        return JsonResponse({'error': 'ページIDが必要です'}, status=400)
    
    try:
        page_id = int(page_id)
    except ValueError:
        return JsonResponse({'error': '無効なページIDです'}, status=400)
    
    # ページの階層構造フォルダパスを取得
    folder_path = _get_page_folder_path(page_id)
    
    file = request.FILES[file_key]
    
    # ファイル種別の検証
    file_extension = os.path.splitext(file.name)[1].lower()
    
    if file.content_type not in allowed_types and file_extension not in allowed_extensions:
        return JsonResponse({'error': '許可されていないファイル形式です'}, status=400)
    
    # ファイルサイズの検証
    if file.size > max_size:
        size_mb = max_size / (1024 * 1024)
        return JsonResponse({'error': f'ファイルサイズは{size_mb}MB以下にしてください'}, status=400)
    
    # ファイル名を生成
    if use_original_name:
        # 元のファイル名を取得し、危険な文字をサニタイズ
        original_filename = file.name
        name_without_ext, ext = os.path.splitext(original_filename)
        safe_name = re.sub(r'[<>:"/\\|?*]', '_', name_without_ext)
        safe_filename = safe_name + (ext or file_extension)
        
        # 同じファイル名が既に存在する場合、重複を避けるために番号を追加
        filepath = os.path.join('uploads', folder_path, safe_filename)
        counter = 1
        while default_storage.exists(filepath):
            safe_filename = f"{safe_name}_{counter}{ext or file_extension}"
            filepath = os.path.join('uploads', folder_path, safe_filename)
            counter += 1
    else:
        # UUIDベースのファイル名
        ext = os.path.splitext(file.name)[1] or file_extension
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join('uploads', folder_path, filename)
    
    # 保存
    saved_path = default_storage.save(filepath, file)
    
    # URL を返却
    if file_key == 'image':
        # 画像は相対パス（階層構造のパスを使用）
        file_url = f'/media/uploads/{folder_path}/{os.path.basename(saved_path)}'
    else:
        # その他は絶対URL
        file_url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    
    result = {
        'success': True,
        'url': file_url
    }
    
    if use_original_name:
        result['filename'] = file.name
    
    return JsonResponse(result)


@require_http_methods(["POST"])
def upload_image(request):
    """リッチテキストエディタ用：画像アップロード"""
    return _validate_and_save_file(
        request,
        file_key='image',
        allowed_types=['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        allowed_extensions=['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
        max_size=5 * 1024 * 1024,  # 5MB
        use_original_name=False
    )


@require_http_methods(["POST"])
def upload_video(request):
    """リッチテキストエディタ用：動画アップロード"""
    return _validate_and_save_file(
        request,
        file_key='video',
        allowed_types=['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
        allowed_extensions=['.mp4', '.webm', '.ogg', '.mov'],
        max_size=250 * 1024 * 1024,  # 250MB
        use_original_name=False
    )


@require_http_methods(["POST"])
def upload_excel(request):
    """リッチテキストエディタ用：エクセルファイルアップロード"""
    return _validate_and_save_file(
        request,
        file_key='excel',
        allowed_types=[
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel.sheet.macroEnabled.12',
        ],
        allowed_extensions=['.xls', '.xlsx', '.xlsm'],
        max_size=50 * 1024 * 1024,  # 50MB
        use_original_name=True
    )


@require_http_methods(["POST"])
def upload_zip(request):
    """リッチテキストエディタ用：ZIPファイルアップロード"""
    return _validate_and_save_file(
        request,
        file_key='zip',
        allowed_types=['application/zip', 'application/x-zip-compressed', 'application/x-zip'],
        allowed_extensions=['.zip'],
        max_size=100 * 1024 * 1024,  # 100MB
        use_original_name=True
    )


@require_http_methods(["POST"])
def upload_sketch(request):
    """リッチテキストエディタ用：Sketchファイルアップロード"""
    return _validate_and_save_file(
        request,
        file_key='sketch',
        allowed_types=[],
        allowed_extensions=['.sketch'],
        max_size=100 * 1024 * 1024,  # 100MB
        use_original_name=True
    )


@require_http_methods(["POST"])
def upload_ico(request):
    """リッチテキストエディタ用：ICOファイルアップロード"""
    return _validate_and_save_file(
        request,
        file_key='ico',
        allowed_types=[],
        allowed_extensions=['.ico'],
        max_size=10 * 1024 * 1024,  # 10MB
        use_original_name=True
    )
