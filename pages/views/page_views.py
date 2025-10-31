"""ページCRUD操作ビュー"""

from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
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
class PageCreateView(View):
    """ページ作成ビュー（責務をメソッドで分離）"""
    
    def post(self, request):
        # 1. リクエストデータの取得（プレゼンテーション層）
        form_data = self._extract_form_data(request)
        
        # 2. プレゼンテーション層でのバリデーション
        validation_error = self._validate_form_data(form_data)
        if validation_error:
            return self._build_error_response(request, validation_error)
        
        # 3. DTOの作成（プレゼンテーション層）
        dto = self._create_dto(form_data)
        
        # 4. ビジネスロジックの実行（サービス層に委譲）
        try:
            page = self._execute_service(dto)
            return self._build_success_response(request, page_id=page.id)
        except ValueError as e:
            return self._build_error_response(request, str(e))
    
    def _extract_form_data(self, request):
        """リクエストからフォームデータを取得・変換（プレゼンテーション層の責務）"""
        return {
            'title': request.POST.get('title', '').strip(),
            'content': request.POST.get('content', ''),
            'parent_id': self._parse_parent_id(request.POST.get('parent_id'))
        }
    
    def _parse_parent_id(self, parent_id_str):
        """parent_idをintまたはNoneに変換（プレゼンテーション層の責務）"""
        if not parent_id_str or not parent_id_str.strip():
            return None
        try:
            return int(parent_id_str)
        except (ValueError, AttributeError):
            return None
    
    def _validate_form_data(self, form_data):
        """フォームデータのバリデーション（プレゼンテーション層の責務）"""
        if not form_data.get('title'):
            return 'タイトルは必須です'
        return None
    
    def _create_dto(self, form_data):
        """DTOを作成（プレゼンテーション層の責務）"""
        return CreatePageDTO(
            title=form_data['title'],
            content=form_data['content'],
            parent_id=form_data['parent_id']
        )
    
    def _execute_service(self, dto):
        """サービス層を実行（ビジネスロジック層への橋渡し）"""
        service = _get_service()
        return service.create_page(dto)
    
    def _is_ajax_request(self, request):
        """AJAXリクエストかどうかを判定"""
        return request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    def _build_success_response(self, request, **kwargs):
        """成功レスポンスを生成（プレゼンテーション層の責務）"""
        if self._is_ajax_request(request):
            response_data = {'success': True}
            if 'page_id' in kwargs:
                response_data['page_id'] = kwargs['page_id']
            return JsonResponse(response_data)
        return redirect('pages:index')
    
    def _build_error_response(self, request, error_message, redirect_url='pages:index'):
        """エラーレスポンスを生成（プレゼンテーション層の責務）"""
        if self._is_ajax_request(request):
            return JsonResponse({'success': False, 'error': error_message}, status=400)
        return redirect(redirect_url)


@method_decorator(require_http_methods(["POST"]), name='dispatch')
class PageUpdateView(View):
    """ページ更新ビュー"""
    
    def post(self, request, page_id):
        form_data = self._extract_form_data(request)
        
        validation_error = self._validate_form_data(form_data)
        if validation_error:
            return self._build_error_response(request, validation_error, page_id)
        
        dto = self._create_dto(form_data, page_id)
        
        try:
            page = self._execute_service(dto)
            if page is None:
                raise Http404('ページが見つかりません')
            return self._build_success_response(request, page_id)
        except ValueError as e:
            return self._build_error_response(request, str(e), page_id)
    
    def _extract_form_data(self, request):
        """リクエストからフォームデータを取得"""
        return {
            'title': request.POST.get('title', '').strip(),
            'content': request.POST.get('content', '')
        }
    
    def _validate_form_data(self, form_data):
        """フォームデータのバリデーション"""
        if not form_data.get('title'):
            return 'タイトルは必須です'
        return None
    
    def _create_dto(self, form_data, page_id):
        """DTOを作成"""
        return UpdatePageDTO(
            page_id=page_id,
            title=form_data['title'],
            content=form_data['content']
        )
    
    def _execute_service(self, dto):
        """サービス層を実行"""
        service = _get_service()
        return service.update_page(dto)
    
    def _is_ajax_request(self, request):
        """AJAXリクエストかどうかを判定"""
        return request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    def _build_success_response(self, request, page_id):
        """成功レスポンスを生成"""
        if self._is_ajax_request(request):
            return JsonResponse({'success': True})
        return redirect('pages:page_detail', page_id=page_id)
    
    def _build_error_response(self, request, error_message, page_id):
        """エラーレスポンスを生成"""
        if self._is_ajax_request(request):
            return JsonResponse({'success': False, 'error': error_message}, status=400)
        return redirect('pages:page_detail', page_id=page_id)


@method_decorator(require_http_methods(["POST"]), name='dispatch')
class PageDeleteView(View):
    """ページ削除ビュー"""
    
    def post(self, request, page_id):
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
        
        if self._is_ajax_request(request):
            return JsonResponse({'success': True})
        
        if parent_id:
            return redirect('pages:page_detail', page_id=parent_id)
        return redirect('pages:index')
    
    def _is_ajax_request(self, request):
        """AJAXリクエストかどうかを判定"""
        return request.headers.get('X-Requested-With') == 'XMLHttpRequest'


# 関数ベースビューとして公開（後方互換性のため）
page_create = PageCreateView.as_view()
page_update = PageUpdateView.as_view()
page_delete = PageDeleteView.as_view()
