const statusEl = document.getElementById('net-status');
const responseEl = document.getElementById('response');

function setStatus(text, isLoading = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle('text-accent', isLoading);
  statusEl.classList.toggle('text-slate-500', !isLoading);
}

function show(obj) {
  if (!responseEl) return;
  responseEl.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

async function callGet(path) {
  setStatus('Loading...', true);
  show('');
  try {
    const res = await fetch(path, { cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    show({ status: res.status, body });
  } catch (err) {
    show({ error: err.message });
  }
  setStatus('Ready');
}

async function callPost(path, data) {
  setStatus('Loading...', true);
  show('');
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    show({ status: res.status, body });
  } catch (err) {
    show({ error: err.message });
  }
  setStatus('Ready');
}

async function copyToClipboard() {
  if (!responseEl || !responseEl.textContent) return;
  try {
    await navigator.clipboard.writeText(responseEl.textContent);
    const copyBtn = document.getElementById('copy-response');
    if (copyBtn) {
      const originalLabel = copyBtn.getAttribute('aria-label');
      copyBtn.setAttribute('aria-label', 'Copied!');
      copyBtn.classList.add('text-accent');
      setTimeout(() => {
        copyBtn.setAttribute('aria-label', originalLabel);
        copyBtn.classList.remove('text-accent');
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setStatus('Ready');

  // GET buttons
  document.getElementById('btn-tools')?.addEventListener('click', () => callGet('/mcp/tools/list'));
  document.getElementById('btn-resources')?.addEventListener('click', () => callGet('/mcp/resources/list'));
  document.getElementById('btn-prompts')?.addEventListener('click', () => callGet('/mcp/prompts/list'));
  document.getElementById('btn-health')?.addEventListener('click', () => callGet('/mcp/health'));

  // Copy button
  document.getElementById('copy-response')?.addEventListener('click', copyToClipboard);

  // POST form
  const postForm = document.getElementById('post-form');
  postForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    let endpoint = document.getElementById('post-endpoint').value.trim();
    const bodyText = document.getElementById('post-body').value.trim();
    let json = {};
    try {
      json = bodyText ? JSON.parse(bodyText) : {};
    } catch (err) {
      show({ error: 'Invalid JSON: ' + err.message });
      return;
    }
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }
    callPost(endpoint, json);
  });
});
