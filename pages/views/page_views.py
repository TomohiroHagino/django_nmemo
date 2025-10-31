"""ページCRUD操作ビュー"""

from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.urls import resolve
from django.views import View
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator

from ..application.dto import CreatePageDTO, UpdatePageDTO
from .utils import _get_service


def index(request):
    """インデックスページ：ページツリーを表示"""
    service = _get_service()
    tree_data = service.get_page_tree()
    return render(request, 'pages/index.html', tree_data)


@method_decorator(require_http_methods(["POST"]), name='dispatch')
class PageView(View):
    """ページのCRUD操作ビュー（責務をメソッドで分離）"""
    
    def post(self, request, page_id=None):
        """POSTリクエストのルーティング（URL名から判定）"""
        if page_id is None:
            # page/create/ の場合
            return self._create(request)
        else:
            # URL名から判定（削除と更新を区別）
            url_name = resolve(request.path).url_name
            if url_name == 'page_delete':
                return self._delete(request, page_id)
            else:
                # page_update の場合
                return self._update(request, page_id)
    
    # ========== CRUD操作メソッド ==========
    
    def _create(self, request):
        """ページを作成"""
        form_data = self._extract_form_data_for_create(request)
        
        validation_error = self._validate_form_data(form_data)
        if validation_error:
            return self._build_error_response(request, validation_error)
        
        dto = CreatePageDTO(
            title=form_data['title'],
            content=form_data['content'],
            parent_id=form_data['parent_id']
        )
        
        try:
            service = _get_service()
            page = service.create_page(dto)
            return self._build_success_response(request, page_id=page.id)
        except ValueError as e:
            return self._build_error_response(request, str(e))
    
    def _update(self, request, page_id):
        """ページを更新"""
        form_data = self._extract_form_data_for_update(request)
        
        validation_error = self._validate_form_data(form_data)
        if validation_error:
            return self._build_error_response(
                request, validation_error,
                redirect_url='pages:page_detail',
                redirect_kwargs={'page_id': page_id}
            )
        
        dto = UpdatePageDTO(
            page_id=page_id,
            title=form_data['title'],
            content=form_data['content']
        )
        
        try:
            service = _get_service()
            page = service.update_page(dto)
            
            if page is None:
                raise Http404('ページが見つかりません')
            
            return self._build_success_response(
                request,
                redirect_url='pages:page_detail',
                redirect_kwargs={'page_id': page_id}
            )
        except ValueError as e:
            return self._build_error_response(
                request, str(e),
                redirect_url='pages:page_detail',
                redirect_kwargs={'page_id': page_id}
            )
    
    def _delete(self, request, page_id):
        """ページを削除"""
        service = _get_service()
        
        # 削除前に親IDを取得
        page = service.get_page_detail(page_id)
        parent_id = page.parent_id if page else None
        
        success = service.delete_page(page_id)
        
        if not success:
            if self._is_ajax_request(request):
                return JsonResponse(
                    {'success': False, 'error': 'ページが見つかりません'}, 
                    status=404
                )
            raise Http404('ページが見つかりません')
        
        if parent_id:
            return self._build_success_response(
                request,
                redirect_url='pages:page_detail',
                redirect_kwargs={'page_id': parent_id}
            )
        
        return self._build_success_response(request)
    
    # ========== 共通のヘルパーメソッド（プレゼンテーション層の責務） ==========
    
    def _extract_form_data_for_create(self, request):
        """作成用フォームデータを取得"""
        return {
            'title': request.POST.get('title', '').strip(),
            'content': request.POST.get('content', ''),
            'parent_id': self._parse_parent_id(request.POST.get('parent_id'))
        }
    
    def _extract_form_data_for_update(self, request):
        """更新用フォームデータを取得"""
        return {
            'title': request.POST.get('title', '').strip(),
            'content': request.POST.get('content', '')
        }
    
    def _parse_parent_id(self, parent_id_str):
        """parent_idをintまたはNoneに変換"""
        if not parent_id_str or not parent_id_str.strip():
            return None
        try:
            return int(parent_id_str)
        except (ValueError, AttributeError):
            return None
    
    def _validate_form_data(self, form_data):
        """フォームデータのバリデーション"""
        if not form_data.get('title'):
            return 'タイトルは必須です'
        return None
    
    def _is_ajax_request(self, request):
        """AJAXリクエストかどうかを判定"""
        return request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    def _build_success_response(self, request, page_id=None, redirect_url='pages:index', redirect_kwargs=None):
        """成功レスポンスを生成"""
        if self._is_ajax_request(request):
            response_data = {'success': True}
            if page_id:
                response_data['page_id'] = page_id
            return JsonResponse(response_data)
        
        if redirect_kwargs:
            return redirect(redirect_url, **redirect_kwargs)
        return redirect(redirect_url)
    
    def _build_error_response(self, request, error_message, redirect_url='pages:index', redirect_kwargs=None):
        """エラーレスポンスを生成"""
        if self._is_ajax_request(request):
            return JsonResponse({'success': False, 'error': error_message}, status=400)
        
        if redirect_kwargs:
            return redirect(redirect_url, **redirect_kwargs)
        return redirect(redirect_url)


# 関数ベースビューとして公開（後方互換性のため）
page_create = PageView.as_view()
page_update = PageView.as_view()
page_delete = PageView.as_view()
