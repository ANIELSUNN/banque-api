const API_BASE = 'http://localhost:3000';

async function requestJson(path, options = {}) {
  const isJsonBody = options.body && !(options.headers && options.headers['Content-Type']);

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Une erreur est survenue');
  }

  return data;
}

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type || ''}`.trim();
}
