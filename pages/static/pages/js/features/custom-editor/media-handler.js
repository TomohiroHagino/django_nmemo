// 画像・動画のアップロードと挿入
export function createImageHandler(editor, currentPageId, isCreateModal) {
  return async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.click();

      input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;

          if (file.size > 5 * 1024 * 1024) {
              alert('ファイルサイズは5MB以下にしてください');
              return;
          }

          const pageId = isCreateModal ? 'temp' : (currentPageId || '');
          if (!pageId && !isCreateModal) {
              alert('ページIDが取得できません。ページを再読み込みしてください。');
              return;
          }

          const formData = new FormData();
          formData.append('image', file);
          formData.append('page_id', pageId);

          const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

          try {
              const response = await fetch('/api/upload-image/', {
                  method: 'POST',
                  headers: { 'X-CSRFToken': csrfToken },
                  body: formData
              });

              const data = await response.json();

              if (data.success) {
                  insertImage(editor, data.url);
              } else {
                  alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
              }
          } catch (error) {
              alert('画像のアップロードに失敗しました');
          }
      };
  };
}

export function createVideoHandler(editor, currentPageId, isCreateModal) {
  return () => {
      const choice = prompt('1: YouTube/Vimeo URLを入力\n2: 動画ファイルをアップロード\n\n番号を入力してください (1 または 2):');

      if (choice === '1') {
          const url = prompt('YouTube または Vimeo の URL を入力してください:');
          if (!url) return;

          const size = prompt('動画のサイズを選択してください:\n1: 小 (420x236)\n2: 中 (560x315) - デフォルト\n3: 大 (840x472)\n\n番号を入力してください (1, 2, または 3):');

          let width = 560, height = 315;
          if (size === '1') { width = 420; height = 236; }
          else if (size === '3') { width = 840; height = 472; }

          let embedUrl = url;
          const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
          const youtubeMatch = url.match(youtubeRegex);
          if (youtubeMatch) {
              const videoId = youtubeMatch[1];
              try {
                  const urlObj = new URL(url);
                  const siParam = urlObj.searchParams.get('si');
                  embedUrl = `https://www.youtube.com/embed/${videoId}${siParam ? `?si=${siParam}` : ''}`;
              } catch (e) {
                  embedUrl = `https://www.youtube.com/embed/${videoId}`;
              }
          }

          const vimeoRegex = /vimeo\.com\/(\d+)/;
          const vimeoMatch = url.match(vimeoRegex);
          if (vimeoMatch) {
              embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
          }

          insertVideo(editor, embedUrl, width, height);
      } else if (choice === '2') {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/mp4,video/webm,video/ogg,video/quicktime';
          input.click();

          input.onchange = async () => {
              const file = input.files[0];
              if (!file) return;

              if (file.size > 250 * 1024 * 1024) {
                  alert('動画ファイルサイズは250MB以下にしてください');
                  return;
              }

              const pageId = isCreateModal ? 'temp' : (currentPageId || '');
              if (!pageId && !isCreateModal) {
                  alert('ページIDが取得できません。ページを再読み込みしてください。');
                  return;
              }

              const formData = new FormData();
              formData.append('video', file);
              formData.append('page_id', pageId);

              const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

              try {
                  const response = await fetch('/api/upload-video/', {
                      method: 'POST',
                      headers: { 'X-CSRFToken': csrfToken },
                      body: formData
                  });

                  const data = await response.json();

                  if (data.success) {
                      insertVideo(editor, data.url);
                  } else {
                      alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                  }
              } catch (error) {
                  alert('動画のアップロードに失敗しました');
              }
          };
      }
  };
}

function insertImage(editor, url) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const img = document.createElement('img');
  img.src = url;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.display = 'inline-block'; // インライン要素として表示
  img.style.verticalAlign = 'middle'; // テキストとの配置を調整

  range.insertNode(img);
  range.setStartAfter(img);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  editor.updatePlaceholder();
}

function insertVideo(editor, url, width = 560, height = 315) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.width = width;
  iframe.height = height;
  iframe.frameBorder = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.style.border = 'none';
  // レスポンシブ対応: 最大幅を100%に設定
  iframe.style.maxWidth = '100%';
  iframe.style.height = 'auto';
  // アスペクト比を維持するために、aspect-ratioを使用
  iframe.style.aspectRatio = `${width} / ${height}`;

  range.insertNode(iframe);
  range.setStartAfter(iframe);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  editor.updatePlaceholder();
}