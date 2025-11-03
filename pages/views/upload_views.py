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
    
    # 新規作成モーダルの場合は一時フォルダを使用
    is_temp = (page_id == 'temp')
    
    if is_temp:
        # 一時フォルダに保存
        folder_path = 'temp_uploads'
    else:
        try:
            page_id_int = int(page_id)
        except ValueError:
            return JsonResponse({'error': '無効なページIDです'}, status=400)
        
        # ページの階層構造フォルダパスを取得
        folder_path = _get_page_folder_path(page_id_int)
    
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


@require_http_methods(["POST"])
def cleanup_temp_images(request):
    """一時フォルダの未使用メディアファイルを全て削除する（temp_uploadsとpage_tempの両方に対応）"""
    import json
    from django.core.files.storage import default_storage
    import re
    import os
    import urllib.parse
    
    try:
        # リクエストボディからJSONを取得
        body = json.loads(request.body)
        content_html = body.get('content', '')
        
        print(f"DEBUG: Content HTML length: {len(content_html)}")
        print(f"DEBUG: Content HTML (first 500 chars): {content_html[:500]}")
        
        # 使用されているメディアファイル名を抽出
        # 画像と動画の両方に対応（src属性またはhref属性）
        used_files = set()
        used_files_lower = set()  # 大文字小文字を区別しない比較用
        
        # パターン: /media/uploads/temp_uploads/ または /media/uploads/page_temp/ で始まるURL
        patterns = [
            r'/media/uploads/temp_uploads/([^"\'>\s?#]+)',  # temp_uploadsフォルダ
            r'/media/uploads/page_temp/([^"\'>\s?#]+)',     # page_tempフォルダ
        ]
        
        for pattern in patterns:
            for match in re.finditer(pattern, content_html):
                filename = match.group(1)
                # URLデコード（必要に応じて）
                try:
                    filename = urllib.parse.unquote(filename)
                    # パスセパレータが含まれている場合は最後のファイル名のみを取得
                    if '/' in filename:
                        filename = filename.split('/')[-1]
                    if '\\' in filename:
                        filename = filename.split('\\')[-1]
                except:
                    pass
                if filename:
                    used_files.add(filename)
                    # 大文字小文字を区別しない比較用にも追加
                    used_files_lower.add(filename.lower())
        
        print(f"DEBUG: Found {len(used_files)} used files: {list(used_files)[:10]}")  # 最初の10個を表示
        
        deleted_count = 0
        
        # 削除対象フォルダのリスト
        temp_folders = [
            ('temp_uploads', 'uploads/temp_uploads'),
            ('page_temp', 'uploads/page_temp')
        ]
        
        for folder_name, folder_path in temp_folders:
            try:
                temp_dir = default_storage.path(folder_path)
            except Exception:
                # default_storage.pathが使えない場合、直接パスを構築
                temp_dir = os.path.join(settings.MEDIA_ROOT, folder_path)
            
            print(f"DEBUG: Checking folder: {temp_dir}")
            
            if not os.path.exists(temp_dir):
                print(f"DEBUG: Folder does not exist: {temp_dir}")
                continue
                
            if not os.path.isdir(temp_dir):
                print(f"DEBUG: Not a directory: {temp_dir}")
                continue
            
            files_in_folder = os.listdir(temp_dir)
            print(f"DEBUG: Found {len(files_in_folder)} items in {folder_name}")
            
            for filename in files_in_folder:
                file_path = os.path.join(temp_dir, filename)
                
                # ディレクトリはスキップ
                if os.path.isdir(file_path):
                    print(f"DEBUG: Skipping directory: {filename}")
                    continue
                
                # .htmlファイルはスキップ（ページファイル）
                if filename.endswith('.html'):
                    print(f"DEBUG: Skipping HTML file: {filename}")
                    continue
                
                # ファイル名が使用されていないかチェック
                should_delete = True
                
                # コンテンツが空の場合は、すべてのファイルを削除対象とする
                if not content_html or not content_html.strip():
                    should_delete = True
                    print(f"DEBUG: Content is empty, marking for deletion: {filename}")
                else:
                    # 使用されているファイル名のセットと比較（大文字小文字を考慮）
                    if filename in used_files:
                        should_delete = False
                        print(f"DEBUG: File {filename} is in used_files (exact match)")
                    # 大文字小文字を区別しない比較
                    elif filename.lower() in used_files_lower:
                        should_delete = False
                        print(f"DEBUG: File {filename} is in used_files_lower (case-insensitive match)")
                    else:
                        # URLエンコードされたバージョンもチェック
                        encoded_filename = urllib.parse.quote(filename, safe='')
                        if encoded_filename in used_files:
                            should_delete = False
                            print(f"DEBUG: File {filename} matches encoded version in used_files")
                        elif encoded_filename.lower() in used_files_lower:
                            should_delete = False
                            print(f"DEBUG: File {filename} matches encoded version in used_files_lower")
                        else:
                            # URLデコードされたバージョンと比較（使用ファイルリスト内で）
                            matched = False
                            for used_file in used_files:
                                try:
                                    decoded_used = urllib.parse.unquote(used_file)
                                    # 大文字小文字を区別しない比較
                                    if filename.lower() == decoded_used.lower() or filename.lower() == used_file.lower():
                                        should_delete = False
                                        matched = True
                                        print(f"DEBUG: File {filename} matches used_file {used_file} after decode")
                                        break
                                except:
                                    pass
                            if not matched:
                                print(f"DEBUG: File {filename} not matched, will be deleted")
                
                # 使用されていないファイルを削除
                if should_delete:
                    try:
                        os.remove(file_path)
                        deleted_count += 1
                        print(f"✓ Deleted: {file_path} (filename: {filename})")
                    except Exception as e:
                        print(f"✗ Warning: Failed to delete {file_path}: {e}")
                else:
                    print(f"  Kept: {filename}")
        
        # デバッグ情報
        print(f"DEBUG SUMMARY: Used files count: {len(used_files)}, Deleted files count: {deleted_count}")
        
        return JsonResponse({
            'success': True,
            'deleted_count': deleted_count
        })
            
    except Exception as e:
        import traceback
        print(f"✗ Error in cleanup_temp_images: {e}")
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)
