"""page_tempフォルダ内の画像を修正するためのコマンド"""

from django.core.management.base import BaseCommand
from pages.models import Page
from pages.application.services import PageApplicationService
from pages.infrastructure.repositories import PageRepository
from pages.application.dto import UpdatePageDTO


class Command(BaseCommand):
    help = 'ページ内のpage_temp画像を適切なページフォルダに移動します'

    def handle(self, *args, **options):
        self.stdout.write('既存ページの画像を修正しています...\n')
        
        repository = PageRepository()
        service = PageApplicationService(repository)
        
        # Get all pages
        pages = Page.objects.all()
        fixed_count = 0
        
        for page in pages:
            # コンテンツにpage_temp画像が含まれているか確認する
            if page.content and 'page_temp' in page.content:
                self.stdout.write(f'ページ {page.id}: {page.title} を修正中...')
                
                # ページを更新する（これにより画像の移動がトリガーされます）
                dto = UpdatePageDTO(
                    page_id=page.id,
                    title=page.title,
                    content=page.content
                )
                
                service.update_page(dto)
                fixed_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ 修正完了'))
        
        if fixed_count == 0:
            self.stdout.write(self.style.SUCCESS('修正が必要なページはありませんでした。'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n合計 {fixed_count} ページを修正しました。'))


