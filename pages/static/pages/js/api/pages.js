import { post } from './client.js';

export async function createPage({ parentId, title, contentHtml }) {
    const form = new FormData();
    if (parentId) form.append('parent_id', parentId);
    form.append('title', title);
    form.append('content', contentHtml);
    const data = await post('/page/create/', form, { asJson: true });
    if (!data.success) throw new Error(data.error || 'create failed');
    return { pageId: data.page_id };
}

export function fetchPage(pageId) {
    return fetch(`/api/page/${pageId}/`).then(r => r.json());
}

export function updatePage(pageId, title, content, csrfToken) {
    return fetch(`/page/${pageId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({ 'title': title, 'content': content })
    }).then(r => r.json());
}

export function removePage(pageId, csrfToken) {
    return fetch(`/page/${pageId}/delete/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        }
    }).then(r => r.json());
}