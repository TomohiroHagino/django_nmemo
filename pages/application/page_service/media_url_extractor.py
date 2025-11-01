"""メディアURL抽出サービス"""

import re


class MediaUrlExtractor:
    """HTMLコンテンツからメディアURLを抽出するサービス"""
    
    def extract_media_urls(self, content: str) -> set:
        """HTMLコンテンツから画像・動画URLをすべて抽出する"""
        urls = set()
        
        # img の src 属性を抽出
        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
        for url in re.findall(img_pattern, content):
            if '/media/' in url:
                if url.startswith('http://') or url.startswith('https://'):
                    media_index = url.find('/media/')
                    if media_index != -1:
                        urls.add(url[media_index:])
                else:
                    urls.add(url)
        
        # video の src 属性を抽出
        video_pattern = r'<video[^>]+src=["\']([^"\']+)["\']'
        for url in re.findall(video_pattern, content):
            if '/media/' in url:
                if url.startswith('http://') or url.startswith('https://'):
                    media_index = url.find('/media/')
                    if media_index != -1:
                        urls.add(url[media_index:])
                else:
                    urls.add(url)
        
        # source タグの src 属性を抽出（video 内の source タグ対応）
        source_pattern = r'<source[^>]+src=["\']([^"\']+)["\']'
        for url in re.findall(source_pattern, content):
            if '/media/' in url:
                if url.startswith('http://') or url.startswith('https://'):
                    media_index = url.find('/media/')
                    if media_index != -1:
                        urls.add(url[media_index:])
                else:
                    urls.add(url)
        
        # a タグの href 属性から /media/uploads/ で始まるファイルURLを抽出
        a_pattern = r'<a[^>]+href=["\']([^"\']+)["\']'
        for match in re.finditer(a_pattern, content):
            href = match.group(1)
            if '/media/uploads/' in href:
                if href.startswith('http://') or href.startswith('https://'):
                    media_index = href.find('/media/uploads/')
                    if media_index != -1:
                        relative_path = href[media_index:]
                        urls.add(relative_path)
                elif href.startswith('/media/uploads/'):
                    urls.add(href)
        
        return urls
