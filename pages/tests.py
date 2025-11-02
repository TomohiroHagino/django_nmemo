"""ページアプリケーションのテスト"""

from django.test import TestCase, Client
from django.urls import reverse
from datetime import datetime
from .models import Page
from .application.dto import CreatePageDTO, UpdatePageDTO
from .domain.page_aggregate import PageEntity


class PageModelTest(TestCase):
    """Pageモデルのテスト"""
    
    def setUp(self):
        """各テストの前に実行される初期化処理"""
        self.root_page = Page.objects.create(
            title='ルートページ',
            content='ルートのコンテンツ',
            icon='📄'
        )
        self.child_page = Page.objects.create(
            title='子ページ',
            content='子のコンテンツ',
            icon='📝',
            parent=self.root_page
        )
    
    def test_page_creation(self):
        """ページの作成テスト"""
        self.assertEqual(Page.objects.count(), 2)
        self.assertEqual(self.root_page.title, 'ルートページ')
        self.assertTrue(self.root_page.created_at)
        self.assertTrue(self.root_page.updated_at)
    
    def test_page_hierarchy(self):
        """ページの階層構造テスト"""
        self.assertEqual(self.child_page.parent, self.root_page)
        self.assertEqual(self.root_page.children.count(), 1)
        self.assertEqual(self.root_page.children.first(), self.child_page)
    
    def test_page_str(self):
        """Pageモデルの__str__メソッドテスト"""
        self.assertEqual(str(self.root_page), 'ルートページ')
    
    def test_page_ordering(self):
        """ページの並び順テスト"""
        page1 = Page.objects.create(title='ページ1', order=10)
        page2 = Page.objects.create(title='ページ2', order=20)
        page3 = Page.objects.create(title='ページ3', order=5)
        
        # 作成したページのみを取得して検証
        test_pages = [page3, page1, page2]
        for page in test_pages:
            page.refresh_from_db()
        
        # Page.objects.filter() を使って作成したページのみを取得
        pages = list(Page.objects.filter(id__in=[page1.id, page2.id, page3.id]).order_by('order'))
        
        self.assertEqual(pages[0].title, 'ページ3')
        self.assertEqual(pages[-1].title, 'ページ2')


class PageEntityTest(TestCase):
    """PageEntityのテスト"""
    
    def test_valid_entity(self):
        """有効なエンティティの作成テスト"""
        entity = PageEntity(
            id=None,
            title='テストタイトル',
            content='テストコンテンツ',
            parent_id=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # バリデーションが成功することを確認
        entity.validate()
        self.assertEqual(entity.title, 'テストタイトル')
    
    def test_empty_title_validation(self):
        """空のタイトルでバリデーションエラーになることをテスト"""
        entity = PageEntity(
            id=None,
            title='',
            content='テストコンテンツ',
            parent_id=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        with self.assertRaises(ValueError) as context:
            entity.validate()
        
        self.assertEqual(str(context.exception), 'タイトルは必須です')
    
    def test_long_title_validation(self):
        """タイトルが200文字を超える場合のバリデーションエラーテスト"""
        entity = PageEntity(
            id=None,
            title='a' * 201,  # 201文字
            content='テストコンテンツ',
            parent_id=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        with self.assertRaises(ValueError) as context:
            entity.validate()
        
        self.assertIn('200文字以内', str(context.exception))
    
    def test_update_title(self):
        """タイトルの更新テスト"""
        entity = PageEntity(
            id=1,
            title='元のタイトル',
            content='テストコンテンツ',
            parent_id=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        entity.update_title('新しいタイトル')
        self.assertEqual(entity.title, '新しいタイトル')
    
    def test_update_content(self):
        """コンテンツの更新テスト"""
        entity = PageEntity(
            id=1,
            title='タイトル',
            content='元のコンテンツ',
            parent_id=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        entity.update_content('新しいコンテンツ')
        self.assertEqual(entity.content, '新しいコンテンツ')
    
    def test_add_child(self):
        """子ページの追加テスト"""
        parent = PageEntity(
            id=1,
            title='親',
            content='親のコンテンツ',
            parent_id=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        child = PageEntity(
            id=2,
            title='子',
            content='子のコンテンツ',
            parent_id=1,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        parent.add_child(child)
        self.assertEqual(len(parent.children), 1)
        self.assertEqual(parent.children[0], child)
    
    def test_get_all_descendants(self):
        """すべての子孫ページの取得テスト"""
        grandparent = PageEntity(id=1, title='祖父母', content='', parent_id=None, created_at=datetime.now(), updated_at=datetime.now())
        parent = PageEntity(id=2, title='親', content='', parent_id=1, created_at=datetime.now(), updated_at=datetime.now())
        child1 = PageEntity(id=3, title='子1', content='', parent_id=2, created_at=datetime.now(), updated_at=datetime.now())
        child2 = PageEntity(id=4, title='子2', content='', parent_id=2, created_at=datetime.now(), updated_at=datetime.now())
        
        grandparent.add_child(parent)
        parent.add_child(child1)
        parent.add_child(child2)
        
        descendants = grandparent.get_all_descendants()
        self.assertEqual(len(descendants), 3)  # parent, child1, child2


class PageViewTest(TestCase):
    """ビューのテスト"""
    
    def setUp(self):
        """各テストの前に実行される初期化処理"""
        self.client = Client(enforce_csrf_checks=False)
        self.page = Page.objects.create(
            title='テストページ',
            content='<p>テストコンテンツ</p>'
        )
    
    def test_index_view(self):
        """インデックスビューのテスト"""
        response = self.client.get(reverse('pages:index'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'テストページ')
    
    def test_create_page_post(self):
        """ページ作成のPOSTリクエストテスト"""
        response = self.client.post(
            reverse('pages:page_create'),
            {
                'title': '新しいページ',
                'content': '<p>新しいコンテンツ</p>',
                'parent_id': ''
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(Page.objects.count(), 2)
    
    def test_create_page_without_title(self):
        """タイトルなしでのページ作成失敗テスト"""
        response = self.client.post(
            reverse('pages:page_create'),
            {
                'title': '',
                'content': '<p>コンテンツ</p>',
                'parent_id': ''
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])
    
    def test_update_page(self):
        """ページ更新のテスト"""
        response = self.client.post(
            reverse('pages:page_update', args=[self.page.id]),
            {
                'title': '更新されたタイトル',
                'content': '<p>更新されたコンテンツ</p>'
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        
        self.page.refresh_from_db()
        self.assertEqual(self.page.title, '更新されたタイトル')
    
    def test_delete_page(self):
        """ページ削除のテスト"""
        response = self.client.post(
            reverse('pages:page_delete', args=[self.page.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(Page.objects.count(), 0)
    
    def test_api_page_detail(self):
        """ページ詳細APIのテスト"""
        response = self.client.get(reverse('pages:api_page_detail', args=[self.page.id]))
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data['title'], 'テストページ')
        self.assertEqual(data['content'], '<p>テストコンテンツ</p>')
    
    def test_api_page_detail_not_found(self):
        """存在しないページの詳細APIテスト"""
        response = self.client.get(reverse('pages:api_page_detail', args=[99999]))
        self.assertEqual(response.status_code, 404)


class PageHierarchyTest(TestCase):
    """ページの階層構造のテスト"""
    
    def setUp(self):
        """各テストの前に実行される初期化処理"""
        self.client = Client(enforce_csrf_checks=False)
        self.root1 = Page.objects.create(title='ルート1', order=10)
        self.root2 = Page.objects.create(title='ルート2', order=20)
        self.child1 = Page.objects.create(title='子1', parent=self.root1, order=10)
        self.child2 = Page.objects.create(title='子2', parent=self.root1, order=20)
        self.grandchild = Page.objects.create(title='孫', parent=self.child1, order=10)
    
    def test_page_tree_structure(self):
        """ページツリー構造のテスト"""
        self.assertEqual(self.root1.children.count(), 2)
        self.assertEqual(self.child1.children.count(), 1)
        self.assertEqual(self.grandchild.parent, self.child1)
    
    def test_move_page_to_different_parent(self):
        """ページの親変更テスト"""
        from .models import Page as PageModel
        
        # 子2をルート2の子にする
        response = self.client.post(
            reverse('pages:page_move', args=[self.child2.id]),
            {
                'new_parent_id': str(self.root2.id)  # 明示的に文字列に変換
            }
        )
        
        # エラーの詳細を確認するため
        if response.status_code != 200:
            error_data = response.json()
            error_msg = f"Expected status 200, got {response.status_code}. Error: {error_data}"
            self.assertEqual(response.status_code, 200, error_msg)
        
        self.assertTrue(response.json()['success'])
        
        self.child2.refresh_from_db()
        self.assertEqual(self.child2.parent, self.root2)
    
    def test_move_page_to_root(self):
        """ページをルートへ移動するテスト"""
        response = self.client.post(
            reverse('pages:page_move', args=[self.child1.id]),
            {
                'new_parent_id': ''
            }
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        
        self.child1.refresh_from_db()
        self.assertIsNone(self.child1.parent)


class PageSearchTest(TestCase):
    """ページ検索のテスト"""
    
    def setUp(self):
        """各テストの前に実行される初期化処理"""
        Page.objects.create(title='Python入門', content='Pythonについての記事')
        Page.objects.create(title='Django基礎', content='Djangoについての記事')
        Page.objects.create(title='JavaScriptチュートリアル', content='JSの記事')
    
    def test_get_all_root_pages(self):
        """すべてのルートページ取得テスト"""
        root_pages = Page.objects.filter(parent=None)
        self.assertEqual(root_pages.count(), 3)


class PageExportTest(TestCase):
    """ページエクスポートのテスト"""
    
    def setUp(self):
        """各テストの前に実行される初期化処理"""
        self.client = Client(enforce_csrf_checks=False)
        self.page = Page.objects.create(
            title='エクスポートテストページ',
            content='<p>テストコンテンツ</p>'
        )
