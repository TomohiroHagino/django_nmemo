"""ページフォルダを新しい命名規則にマイグレーションするコマンド

使用方法:
    python manage.py migrate_page_folders
    python manage.py migrate_page_folders --dry-run  # 実行せずに変更内容を表示
    python manage.py migrate_page_folders --to-hierarchy  # フラット構造から階層構造へ
"""

import re
import shutil
from pathlib import Path
from collections import deque
from django.core.management.base import BaseCommand
from django.conf import settings
from pages.infrastructure.repositories import PageRepository
from pages.models import Page


class Command(BaseCommand):
    help = '既存のフォルダを{order}_page_{id}_{タイトル}形式に階層構造でマイグレーションします'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='実際には変更せず、変更内容を表示するだけ',
        )
        parser.add_argument(
            '--update-content',
            action='store_true',
            help='データベース内のコンテンツのURLも更新する',
        )
        parser.add_argument(
            '--to-hierarchy',
            action='store_true',
            help='フラット構造の{order}_page_{id}_{タイトル}フォルダを階層構造に再編成',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        update_content = options['update_content']
        to_hierarchy = options['to_hierarchy']
        
        if to_hierarchy:
            self._migrate_to_hierarchy(dry_run, update_content)
        else:
            self._migrate_from_old_format(dry_run, update_content)
    
    def _migrate_to_hierarchy(self, dry_run, update_content):
        """フラット構造の{order}_page_{id}_{タイトル}フォルダを階層構造に再編成"""
        media_root = Path(settings.MEDIA_ROOT)
        uploads_dir = media_root / 'uploads'
        
        if not uploads_dir.exists():
            self.stdout.write(self.style.WARNING(f'アップロードディレクトリが見つかりません: {uploads_dir}'))
            return
        
        repository = PageRepository()
        
        # {order}_page_{id}_{タイトル}形式のフォルダを検索（uploads直下のみ）
        pattern = re.compile(r'^(\d+)_page_(\d+)_(.+)$')
        old_folder_map = {}
        
        for item in uploads_dir.iterdir():
            if item.is_dir():
                match = pattern.match(item.name)
                if match:
                    page_id = int(match.group(2))
                    # フォルダがすでに階層構造内にあるかチェック（親フォルダが存在する場合はスキップ）
                    if item.parent == uploads_dir:
                        old_folder_map[page_id] = item
        
        if not old_folder_map:
            self.stdout.write(self.style.SUCCESS('マイグレーション対象のフォルダが見つかりませんでした。'))
            return
        
        self.stdout.write(f'階層構造への再編成対象フォルダ数: {len(old_folder_map)}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUNモード: 実際の変更は行いません\n'))
        
        # すべてのページを取得して、親から子への順序でソート
        all_pages = repository.find_all_pages()
        page_map = {page.id: page for page in all_pages}
        
        # 階層構造に基づいて処理順序を決定（親から子へ）
        processing_order = self._get_processing_order(all_pages)
        
        # 新しいフォルダパスのマップ（ページID -> 新しいパス）
        new_folder_paths = {}
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for page_id in processing_order:
            if page_id not in old_folder_map:
                continue
            
            try:
                entity = page_map.get(page_id)
                if entity is None:
                    self.stdout.write(
                        self.style.WARNING(
                            f'  [{page_id}] ページが見つかりません: {old_folder_map[page_id].name}'
                        )
                    )
                    skip_count += 1
                    continue
                
                # 現在のフォルダ名を確認（既に正しい形式のはず）
                current_folder = old_folder_map[page_id]
                folder_name = current_folder.name
                
                # 親ページのパスを取得
                if entity.parent_id and entity.parent_id in new_folder_paths:
                    # 親が存在する場合、親のパスの下に配置
                    parent_path = new_folder_paths[entity.parent_id]
                    new_folder = uploads_dir / parent_path / folder_name
                    new_folder_path = parent_path / folder_name
                else:
                    # ルートページの場合、そのまま（既に正しい場所にある）
                    # ただし、移動する必要がない場合はスキップ
                    if current_folder.parent == uploads_dir:
                        # 既にルートにあり、親もないので移動不要
                        new_folder_paths[page_id] = Path(folder_name)
                        continue
                    new_folder = uploads_dir / folder_name
                    new_folder_path = Path(folder_name)
                
                # 移動先が現在地と同じ場合はスキップ
                if current_folder.resolve() == new_folder.resolve():
                    new_folder_paths[page_id] = new_folder_path
                    continue
                
                # 新しいパスをマップに保存
                new_folder_paths[page_id] = new_folder_path
                
                old_path_str = str(current_folder.relative_to(uploads_dir))
                new_path_str = str(new_folder_path)
                
                # 既に新しいフォルダが存在する場合
                if new_folder.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f'  [{page_id}] 新しいフォルダが既に存在します: {new_path_str}'
                        )
                    )
                    skip_count += 1
                    continue
                
                # フォルダ移動
                if dry_run:
                    self.stdout.write(
                        f'  [{page_id}] {old_path_str} -> {new_path_str}'
                    )
                    if update_content:
                        self.stdout.write(f'    コンテンツ内のURLも更新: /{old_path_str}/ -> /{new_path_str}/')
                else:
                    try:
                        # 親ディレクトリが存在しない場合は作成
                        new_folder.parent.mkdir(parents=True, exist_ok=True)
                        
                        # フォルダを移動
                        shutil.move(str(current_folder), str(new_folder))
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  [{page_id}] ✓ {old_path_str} -> {new_path_str}'
                            )
                        )
                        
                        # データベース内のコンテンツのURLを更新
                        if update_content:
                            self._update_content_urls(
                                page_id, 
                                old_path_str.replace('\\', '/'), 
                                new_path_str.replace('\\', '/')
                            )
                            self.stdout.write(f'    コンテンツ内のURLを更新しました')
                        
                        success_count += 1
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f'  [{page_id}] ✗ エラー: {str(e)}'
                            )
                        )
                        error_count += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  [{page_id}] ✗ 処理エラー: {str(e)}')
                )
                error_count += 1
        
        # 結果サマリー
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN結果:'))
            self.stdout.write(f'  対象: {len(old_folder_map)}件')
            self.stdout.write(f'  スキップ: {skip_count}件')
            self.stdout.write('\n実際にマイグレーションを実行する場合は --dry-run オプションを外してください。')
        else:
            self.stdout.write(self.style.SUCCESS('マイグレーション結果:'))
            self.stdout.write(f'  成功: {success_count}件')
            self.stdout.write(f'  スキップ: {skip_count}件')
            self.stdout.write(f'  エラー: {error_count}件')
    
    def _migrate_from_old_format(self, dry_run, update_content):
        """古いpage_{id}形式から新しい形式へマイグレーション（既存の処理）"""
        media_root = Path(settings.MEDIA_ROOT)
        uploads_dir = media_root / 'uploads'
        
        if not uploads_dir.exists():
            self.stdout.write(self.style.WARNING(f'アップロードディレクトリが見つかりません: {uploads_dir}'))
            return
        
        repository = PageRepository()
        
        # page_{id}形式のフォルダを検索
        pattern = re.compile(r'^page_(\d+)$')
        old_folder_map = {}
        
        for item in uploads_dir.iterdir():
            if item.is_dir():
                match = pattern.match(item.name)
                if match:
                    page_id = int(match.group(1))
                    old_folder_map[page_id] = item
        
        if not old_folder_map:
            self.stdout.write(self.style.SUCCESS('マイグレーション対象のフォルダが見つかりませんでした。'))
            return
        
        self.stdout.write(f'マイグレーション対象フォルダ数: {len(old_folder_map)}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUNモード: 実際の変更は行いません\n'))
        
        # すべてのページを取得して、親から子への順序でソート
        all_pages = repository.find_all_pages()
        page_map = {page.id: page for page in all_pages}
        
        # 階層構造に基づいて処理順序を決定（親から子へ）
        processing_order = self._get_processing_order(all_pages)
        
        # 新しいフォルダパスのマップ（ページID -> 新しいパス）
        new_folder_paths = {}
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for page_id in processing_order:
            if page_id not in old_folder_map:
                continue
            
            try:
                entity = page_map.get(page_id)
                if entity is None:
                    self.stdout.write(
                        self.style.WARNING(
                            f'  [{page_id}] ページが見つかりません: {old_folder_map[page_id].name}'
                        )
                    )
                    skip_count += 1
                    continue
                
                # 新しいフォルダ名を生成
                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', entity.title)
                folder_name = f'{entity.order}_page_{entity.id}_{safe_title}'
                
                # 親ページのパスを取得
                if entity.parent_id and entity.parent_id in new_folder_paths:
                    # 親が存在する場合、親のパスの下に配置
                    parent_path = new_folder_paths[entity.parent_id]
                    new_folder = uploads_dir / parent_path / folder_name
                    new_folder_path = parent_path / folder_name
                else:
                    # ルートページの場合
                    new_folder = uploads_dir / folder_name
                    new_folder_path = Path(folder_name)
                
                # 新しいパスをマップに保存
                new_folder_paths[page_id] = new_folder_path
                
                old_folder = old_folder_map[page_id]
                old_path_str = str(old_folder.relative_to(uploads_dir))
                new_path_str = str(new_folder_path)
                
                # 既に新しいフォルダが存在する場合
                if new_folder.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f'  [{page_id}] 新しいフォルダが既に存在します: {new_path_str}'
                        )
                    )
                    skip_count += 1
                    continue
                
                # フォルダ移動
                if dry_run:
                    self.stdout.write(
                        f'  [{page_id}] {old_path_str} -> {new_path_str}'
                    )
                    if update_content:
                        self.stdout.write(f'    コンテンツ内のURLも更新: /page_{page_id}/ -> /{new_path_str}/')
                else:
                    try:
                        # 親ディレクトリが存在しない場合は作成
                        new_folder.parent.mkdir(parents=True, exist_ok=True)
                        
                        # フォルダを移動
                        shutil.move(str(old_folder), str(new_folder))
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  [{page_id}] ✓ {old_path_str} -> {new_path_str}'
                            )
                        )
                        
                        # データベース内のコンテンツのURLを更新
                        if update_content:
                            self._update_content_urls(
                                page_id, 
                                f'page_{page_id}', 
                                str(new_folder_path).replace('\\', '/')
                            )
                            self.stdout.write(f'    コンテンツ内のURLを更新しました')
                        
                        success_count += 1
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f'  [{page_id}] ✗ エラー: {str(e)}'
                            )
                        )
                        error_count += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  [{page_id}] ✗ 処理エラー: {str(e)}')
                )
                error_count += 1
        
        # 結果サマリー
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN結果:'))
            self.stdout.write(f'  対象: {len(old_folder_map)}件')
            self.stdout.write(f'  スキップ: {skip_count}件')
            self.stdout.write('\n実際にマイグレーションを実行する場合は --dry-run オプションを外してください。')
        else:
            self.stdout.write(self.style.SUCCESS('マイグレーション結果:'))
            self.stdout.write(f'  成功: {success_count}件')
            self.stdout.write(f'  スキップ: {skip_count}件')
            self.stdout.write(f'  エラー: {error_count}件')
    
    def _get_processing_order(self, all_pages):
        """ページを親から子への順序でソート（BFS）"""
        # ページID -> ページエンティティのマップ
        page_map = {page.id: page for page in all_pages}
        # ページID -> 子ページIDのリスト
        children_map = {}
        
        # ルートページを探す
        root_pages = []
        for page in all_pages:
            if page.parent_id is None:
                root_pages.append(page.id)
            else:
                if page.parent_id not in children_map:
                    children_map[page.parent_id] = []
                children_map[page.parent_id].append(page.id)
        
        # BFSで順序を決定
        order = []
        queue = deque(root_pages)
        
        while queue:
            page_id = queue.popleft()
            order.append(page_id)
            
            # 子ページをキューに追加
            if page_id in children_map:
                for child_id in children_map[page_id]:
                    queue.append(child_id)
        
        return order
    
    def _update_content_urls(self, page_id: int, old_folder_path: str, new_folder_path: str):
        """データベース内のページコンテンツのURLを更新"""
        try:
            page = Page.objects.get(id=page_id)
            # 古いURLパターンを検索（複数のパターンに対応）
            old_patterns = [
                f'/media/uploads/{old_folder_path}/',
                f'/media/uploads/{old_folder_path}',
            ]
            new_url = f'/media/uploads/{new_folder_path}/'
            
            content_updated = False
            for old_pattern in old_patterns:
                if old_pattern in page.content:
                    page.content = page.content.replace(old_pattern, new_url)
                    content_updated = True
            
            if content_updated:
                page.save(update_fields=['content'])
                return True
        except Page.DoesNotExist:
            pass
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'    コンテンツURL更新エラー: {str(e)}')
            )
        return False
