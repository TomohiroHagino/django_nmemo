"""データベース内のページコンテンツのURLを階層構造に更新するコマンド

使用方法:
    python manage.py update_content_urls
    python manage.py update_content_urls --dry-run  # 実行せずに変更内容を表示
"""

import re
from django.core.management.base import BaseCommand
from pages.models import Page
from pages.infrastructure.repositories import PageRepository
from pages.application.page_service.media_service import MediaService


class Command(BaseCommand):
    help = 'データベース内のページコンテンツの画像URLを階層構造に合わせて更新します'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='実際には変更せず、変更内容を表示するだけ',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        repository = PageRepository()
        media_service = MediaService(repository)
        
        # すべてのページを取得
        all_pages = Page.objects.all()
        total_pages = all_pages.count()
        
        if total_pages == 0:
            self.stdout.write(self.style.WARNING('更新対象のページが見つかりませんでした。'))
            return
        
        self.stdout.write(f'更新対象ページ数: {total_pages}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUNモード: 実際の変更は行いません\n'))
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for page in all_pages:
            try:
                # ページエンティティを取得
                entity = repository.find_by_id(page.id)
                if not entity:
                    self.stdout.write(
                        self.style.WARNING(f'  [{page.id}] ページエンティティを取得できませんでした')
                    )
                    skipped_count += 1
                    continue
                
                # 現在のフォルダパスを取得
                current_folder_path = media_service.get_page_folder_path(entity)
                folder_path_str = str(current_folder_path).replace('\\', '/')
                
                # コンテンツ内のURLパターンを検索して更新
                old_content = page.content
                new_content = self._update_urls_in_content(
                    old_content,
                    page.id,
                    folder_path_str
                )
                
                # 変更があったかチェック
                if old_content != new_content:
                    if dry_run:
                        # 変更内容を表示
                        old_urls = self._extract_urls(old_content, page.id)
                        new_urls = self._extract_urls(new_content, page.id)
                        
                        self.stdout.write(
                            f'  [{page.id}] {page.title}'
                        )
                        for old_url in old_urls:
                            # 対応する新しいURLを探す
                            filename = old_url.split('/')[-1]
                            new_url = f'/media/uploads/{folder_path_str}/{filename}'
                            self.stdout.write(f'    {old_url} -> {new_url}')
                    else:
                        # データベースを更新
                        page.content = new_content
                        page.save(update_fields=['content'])
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  [{page.id}] ✓ {page.title} - URLを更新しました'
                            )
                        )
                    
                    updated_count += 1
                else:
                    skipped_count += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  [{page.id}] ✗ エラー: {str(e)}')
                )
                error_count += 1
        
        # 結果サマリー
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN結果:'))
            self.stdout.write(f'  対象: {total_pages}件')
            self.stdout.write(f'  更新が必要: {updated_count}件')
            self.stdout.write(f'  変更なし: {skipped_count}件')
            self.stdout.write(f'  エラー: {error_count}件')
            self.stdout.write('\n実際に更新を実行する場合は --dry-run オプションを外してください。')
        else:
            self.stdout.write(self.style.SUCCESS('更新結果:'))
            self.stdout.write(f'  更新: {updated_count}件')
            self.stdout.write(f'  スキップ: {skipped_count}件')
            self.stdout.write(f'  エラー: {error_count}件')
    
    def _update_urls_in_content(self, content: str, page_id: int, new_folder_path: str) -> str:
        """コンテンツ内のURLを新しいフォルダパスに更新"""
        if not content:
            return content
        
        # 古いURLパターンを検索
        # パターン1: /media/uploads/page_{id}/filename
        pattern1 = re.compile(
            rf'/media/uploads/page_{page_id}/([^"\'>\s]+)',
            re.IGNORECASE
        )
        
        # パターン2: /media/uploads/{order}_page_{id}_{title}/filename (既に変換済みだが階層構造ではない)
        pattern2 = re.compile(
            rf'/media/uploads/\d+_page_{page_id}_[^/]+/([^"\'>\s]+)',
            re.IGNORECASE
        )
        
        updated_content = content
        
        def replace_url(match):
            filename = match.group(1)
            new_url = f'/media/uploads/{new_folder_path}/{filename}'
            return new_url
        
        # パターン1を置換
        updated_content = pattern1.sub(replace_url, updated_content)
        
        # パターン2を置換（既に変換済みだが、フラット構造の場合）
        updated_content = pattern2.sub(replace_url, updated_content)
        
        return updated_content
    
    def _extract_urls(self, content: str, page_id: int) -> list:
        """コンテンツから該当ページのURLを抽出"""
        if not content:
            return []
        
        urls = []
        
        # img タグのsrc属性を抽出
        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
        for match in re.finditer(img_pattern, content):
            url = match.group(1)
            if f'page_{page_id}' in url or '/media/uploads/' in url:
                urls.append(url)
        
        # video タグのsrc属性を抽出
        video_pattern = r'<video[^>]+src=["\']([^"\']+)["\']'
        for match in re.finditer(video_pattern, content):
            url = match.group(1)
            if f'page_{page_id}' in url or '/media/uploads/' in url:
                urls.append(url)
        
        # source タグのsrc属性を抽出
        source_pattern = r'<source[^>]+src=["\']([^"\']+)["\']'
        for match in re.finditer(source_pattern, content):
            url = match.group(1)
            if f'page_{page_id}' in url or '/media/uploads/' in url:
                urls.append(url)
        
        return urls
