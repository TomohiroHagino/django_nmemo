"""Page models"""

from django.db import models


class Page(models.Model):
    """Page model for storing hierarchical pages"""
    title = models.CharField(max_length=200, verbose_name='タイトル')
    content = models.TextField(blank=True, verbose_name='コンテンツ')
    icon = models.CharField(max_length=10, default='📄', verbose_name='アイコン')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        verbose_name='親ページ'
    )
    order = models.IntegerField(default=0, verbose_name='表示順序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='作成日時')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新日時')

    class Meta:
        verbose_name = 'ページ'
        verbose_name_plural = 'ページ'
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.title

