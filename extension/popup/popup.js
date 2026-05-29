const statusEl = document.getElementById('status');
const toggle   = document.getElementById('enabled');

chrome.storage.local.get('enabled', ({ enabled }) => {
  toggle.checked = enabled !== false;
  statusEl.textContent = toggle.checked ? '번역 활성화됨' : '번역 비활성화됨';
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  statusEl.textContent = toggle.checked ? '번역 활성화됨' : '번역 비활성화됨';
});
