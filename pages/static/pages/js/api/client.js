export async function post(url, body, { asJson } = {}) {
  const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
  const headers = { 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' };
  const res = await fetch(url, { method: 'POST', headers, body });
  return asJson ? res.json() : res;
}
