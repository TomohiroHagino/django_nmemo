// カスタムVideoBlotを登録（ローカル動画ファイル用の<video>タグ）
const BlockEmbed = Quill.import('blots/block/embed');

class VideoBlot extends BlockEmbed {
    // 動画要素（iframe または video タグ）を作成
    static create(value) {
        const node = super.create();
        // URLがYouTube/Vimeoの場合はiframe、それ以外は<video>タグ
        if (value.includes('youtube.com') || value.includes('youtu.be') || value.includes('vimeo.com')) {
            // iframe用
            const iframe = document.createElement('iframe');
            iframe.setAttribute('src', value);
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', true);
            iframe.setAttribute('class', 'ql-video');
            node.appendChild(iframe);
        } else {
            // ローカル動画用の<video>タグ
            const video = document.createElement('video');
            video.setAttribute('controls', '');
            video.setAttribute('class', 'ql-video-local');
            video.style.maxWidth = '100%';
            video.style.height = 'auto';
            
            const source = document.createElement('source');
            source.setAttribute('src', value);
            video.appendChild(source);
            
            node.appendChild(video);
        }
        return node;
    }
    
    // 動画要素からURLを取得
    static value(node) {
        const iframe = node.querySelector('iframe');
        const video = node.querySelector('video source');
        return iframe ? iframe.getAttribute('src') : (video ? video.getAttribute('src') : '');
    }
}

VideoBlot.blotName = 'video';
VideoBlot.tagName = 'div';
VideoBlot.className = 'video-wrapper';

// VideoBlotを登録
export function registerVideoBlot() {
    Quill.register(VideoBlot);
}

