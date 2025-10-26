"""
カスタムミドルウェア
Railsのように標準出力にHTTPリクエスト情報を表示
"""
from django.utils import timezone
import sys


class RequestLoggingMiddleware:
    """HTTPリクエスト情報を標準出力に表示するミドルウェア"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # リクエスト開始時刻
        start_time = timezone.now()
        
        # リクエスト情報を表示
        print("\n" + "=" * 80)
        print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] {request.method} {request.path}")
        print("-" * 80)
        
        # GETパラメーター
        if request.GET:
            print("GET Parameters:")
            for key, value in request.GET.items():
                print(f"  {key}: {value}")
        
        # POSTパラメーター
        if request.POST:
            print("POST Parameters:")
            for key, value in request.POST.items():
                # 長すぎる場合は省略
                if len(str(value)) > 200:
                    print(f"  {key}: {str(value)[:200]}...")
                else:
                    print(f"  {key}: {value}")
        
        # リクエストボディ（JSON等）
        # 注意: request.bodyにアクセスすると、他のミドルウェアがbodyを読み込んだ後は例外が発生する
        # そのため、try-exceptで囲んで、エラー時は無視する
        if request.content_type:
            content_type = request.content_type
            try:
                if hasattr(request, 'body') and request.body:
                    body_str = request.body.decode('utf-8')
                    if 'application/json' in content_type or 'application/xml' in content_type or 'text/' in content_type:
                        if len(body_str) > 500:
                            print(f"Request Body ({content_type}): {body_str[:500]}...")
                        else:
                            print(f"Request Body ({content_type}): {body_str}")
            except Exception:
                # bodyへのアクセスが失敗した場合は無視
                pass
        
        # Content-Type
        if request.META.get('CONTENT_TYPE'):
            print(f"Content-Type: {request.META.get('CONTENT_TYPE')}")
        
        # User Agent
        if request.META.get('HTTP_USER_AGENT'):
            print(f"User-Agent: {request.META.get('HTTP_USER_AGENT')}")
        
        print("-" * 80)
        
        # レスポンス処理
        response = self.get_response(request)
        
        # レスポンス情報
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds() * 1000  # ミリ秒
        
        print(f"Completed: {response.status_code} in {duration:.2f}ms")
        print("=" * 80 + "\n")
        
        return response

