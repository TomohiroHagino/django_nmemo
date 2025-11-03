"""page_tempフォルダの古いファイルをクリーンアップするコマンド

使用方法:
    python manage.py cleanup_temp_files
    python manage.py cleanup_temp_files --dry-run  # 実行せずに変更内容を表示
    python manage.py cleanup_temp_files --all  # すべてのファイルを削除
    python manage.py cleanup_temp_files --days 7  # 7日以上古いファイルを削除（デフォルト）
"""

import os
from pathlib import Path
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from pages.infrastructure.repositories import PageRepository
from pages.application.page_service.media_service import MediaService


class Command(BaseCommand):
    help = 'page_tempフォルダ内の古いファイルをクリーンアップします'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='実際には変更せず、変更内容を表示するだけ',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='すべてのファイルを削除（日数に関係なく）',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='この日数以上古いファイルを削除（デフォルト: 7）',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        delete_all = options['all']
        days = options['days']
        
        media_root = Path(settings.MEDIA_ROOT)
        
        # 両方のフォルダを処理
        temp_folders = [
            ('temp_uploads', media_root / 'uploads' / 'temp_uploads'),
            ('page_temp', media_root / 'uploads' / 'page_temp')
        ]
        
        total_deleted = 0
        total_skipped = 0
        total_errors = 0
        
        for folder_name, temp_folder in temp_folders:
            if not temp_folder.exists():
                self.stdout.write(self.style.SUCCESS(f'{folder_name}フォルダが存在しません。'))
                continue
            
            if not temp_folder.is_dir():
                self.stdout.write(self.style.WARNING(f'{temp_folder} はフォルダではありません。'))
                continue
            
            self.stdout.write(f'\n{folder_name}フォルダの処理を開始...')
            deleted, skipped, errors = self._cleanup_folder(
                temp_folder, folder_name, dry_run, delete_all, days
            )
            total_deleted += deleted
            total_skipped += skipped
            total_errors += errors
        
        # 結果サマリー
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN結果:'))
            self.stdout.write(f'  削除対象: {total_deleted}件')
            self.stdout.write(f'  保持: {total_skipped}件')
        else:
            self.stdout.write(self.style.SUCCESS('クリーンアップ結果:'))
            self.stdout.write(f'  削除: {total_deleted}件')
            self.stdout.write(f'  スキップ: {total_skipped}件')
            self.stdout.write(f'  エラー: {total_errors}件')
    
    def _cleanup_folder(self, temp_folder, folder_name, dry_run, delete_all, days):
        """個別のフォルダをクリーンアップ"""
        # ファイルを取得
        files = []
        try:
            for item in temp_folder.iterdir():
                if item.is_file():
                    files.append(item)
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'ファイル一覧の取得に失敗しました: {e}')
            )
            return 0, 0, 0
        
        if not files:
            self.stdout.write(self.style.SUCCESS(f'{folder_name}フォルダにファイルがありません。'))
            return 0, 0, 0
        
        self.stdout.write(f'{folder_name}フォルダ内のファイル数: {len(files)}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUNモード: 実際の変更は行いません\n'))
        
        # 参照されているファイルをチェック
        repository = PageRepository()
        media_service = MediaService(repository)
        referenced_files = self._get_referenced_files(repository, folder_name)
        
        deleted_count = 0
        skipped_count = 0
        error_count = 0
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        for file_path in files:
            try:
                file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                file_age = datetime.now() - file_mtime
                filename = file_path.name
                is_referenced = filename in referenced_files
                
                should_delete = False
                reason = ""
                
                if delete_all:
                    should_delete = True
                    reason = "すべてのファイルを削除"
                elif file_mtime < cutoff_date:
                    should_delete = True
                    reason = f"{file_age.days}日前のファイル（{days}日以上経過）"
                
                if should_delete:
                    if is_referenced:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  ⚠ [{filename}] 参照されているためスキップ ({reason})'
                            )
                        )
                        skipped_count += 1
                        continue
                    
                    if dry_run:
                        self.stdout.write(
                            f'  [{filename}] 削除対象: {reason} (最終更新: {file_mtime.strftime("%Y-%m-%d %H:%M:%S")})'
                        )
                    else:
                        try:
                            os.remove(file_path)
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'  ✓ [{filename}] 削除しました ({reason})'
                                )
                            )
                            deleted_count += 1
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(
                                    f'  ✗ [{filename}] 削除エラー: {e}'
                                )
                            )
                            error_count += 1
                else:
                    if dry_run:
                        self.stdout.write(
                            f'  [{filename}] 保持: {file_age.days}日前（{days}日未満）'
                        )
                    skipped_count += 1
                    
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ✗ [{file_path.name}] 処理エラー: {e}')
                )
                error_count += 1
        
        # 空になったフォルダを削除
        if not dry_run and deleted_count > 0:
            try:
                if temp_folder.exists() and not any(temp_folder.iterdir()):
                    temp_folder.rmdir()
                    self.stdout.write(f'\n空になった{folder_name}フォルダを削除しました。')
            except Exception:
                pass
        
        return deleted_count, skipped_count, error_count
    
    def _get_referenced_files(self, repository, folder_name) -> set:
        """すべてのページコンテンツから参照されているファイル名の集合を取得"""
        referenced = set()
        
        try:
            from pages.models import Page
            all_pages = Page.objects.all()
            
            # フォルダ名に応じたパターン
            if folder_name == 'temp_uploads':
                pattern = r'/media/uploads/temp_uploads/([^"\'>\s?]+)'
            else:
                pattern = r'/media/uploads/page_temp/([^"\'>\s?]+)'
            
            for page in all_pages:
                if page.content:
                    import re
                    matches = re.findall(pattern, page.content)
                    for match in matches:
                        filename = match.split('?')[0].split('#')[0]
                        referenced.add(filename)
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'参照ファイルの取得中にエラー: {e}')
            )
        
        return referenced
