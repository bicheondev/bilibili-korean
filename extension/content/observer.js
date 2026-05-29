/**
 * content/observer.js
 * MutationObserver로 React/Vue 동적 DOM 변경 감지 후 재패치
 */

import { patchNode, patch } from './patcher.js';

// 디바운스: 짧은 시간에 대량 변경이 몰릴 때 한번만 처리
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function observe(selectors, textMap) {
  // 전체 재패치 (네비게이션 등 큰 변경 후)
  const fullRepatch = debounce(() => patch(selectors, textMap), 300);

  // 개별 노드 패치
  const nodeRepatch = debounce((nodes) => {
    for (const node of nodes) {
      patchNode(node, selectors, textMap);
    }
  }, 50);

  const pendingNodes = [];

  const observer = new MutationObserver((mutations) => {
    let bigChange = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 큰 변경 감지 (페이지 전환 등)
            if (node.tagName === 'BODY' || node.id === 'app' || node.id === '__next') {
              bigChange = true;
              break;
            }
            pendingNodes.push(node);
          }
        }
      } else if (mutation.type === 'characterData') {
        // 텍스트 노드 직접 변경
        const el = mutation.target.parentElement;
        if (el) pendingNodes.push(el);
      }
      if (bigChange) break;
    }

    if (bigChange) {
      fullRepatch();
    } else if (pendingNodes.length) {
      nodeRepatch([...pendingNodes]);
      pendingNodes.length = 0;
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Bilibili는 SPA라 popstate/pushState 감지도 필요
  const origPushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    origPushState(...args);
    setTimeout(() => fullRepatch(), 800);
  };
  window.addEventListener('popstate', () => setTimeout(() => fullRepatch(), 800));
}
