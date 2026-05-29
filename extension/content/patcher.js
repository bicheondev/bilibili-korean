/**
 * content/patcher.js
 * 셀렉터 + type 기반 정확 치환 엔진
 *
 * 지원 type:
 *   textContent  — 텍스트 노드 직접 교체
 *   placeholder  — input/textarea placeholder 속성
 *   aria-label   — aria-label 속성
 *   title        — title 속성
 *   css_content  — ::before / ::after CSS content (injected <style>)
 *   data-title   — data-title 속성
 *   data-text    — data-text 속성
 */

// CSS content 치환용 injected style 관리
let styleEl = null;
const cssRules = new Map(); // selector → ko

function ensureStyleEl() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = '__bilibili-ko-style__';
    document.head?.appendChild(styleEl);
  }
}

function rebuildCssRules() {
  ensureStyleEl();
  const rules = [...cssRules.entries()]
    .map(([sel, ko]) => `${sel} { content: "${ko}" !important; }`)
    .join('\n');
  styleEl.textContent = rules;
}

/**
 * 빠른 텍스트 조회 맵 생성
 * { zh텍스트 → { ko, type, selector }[] }
 */
export function buildTextMap(selectors) {
  const map = new Map();
  for (const entry of selectors) {
    if (!map.has(entry.zh)) map.set(entry.zh, []);
    map.get(entry.zh).push(entry);
  }
  return map;
}

/**
 * 단일 엘리먼트에 패치 적용
 */
function patchElement(el, entry) {
  const { type, zh, ko } = entry;

  switch (type) {
    case 'textContent': {
      // 텍스트 노드 순회 (React 리렌더 후에도 재적용 가능하도록 텍스트노드 직접 교체)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent.trim() === zh
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      });
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === zh) {
          node.textContent = node.textContent.replace(zh, ko);
        }
      }
      // el 자체가 텍스트만 가진 경우
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
        if (el.textContent.trim() === zh) el.textContent = ko;
      }
      break;
    }
    case 'placeholder':
      if (el.getAttribute('placeholder') === zh) el.setAttribute('placeholder', ko);
      break;
    case 'aria-label':
      if (el.getAttribute('aria-label') === zh) el.setAttribute('aria-label', ko);
      break;
    case 'title':
      if (el.getAttribute('title') === zh) el.setAttribute('title', ko);
      break;
    case 'data-title':
      if (el.getAttribute('data-title') === zh) el.setAttribute('data-title', ko);
      break;
    case 'data-text':
      if (el.getAttribute('data-text') === zh) el.setAttribute('data-text', ko);
      break;
    case 'data-placeholder':
      if (el.getAttribute('data-placeholder') === zh) el.setAttribute('data-placeholder', ko);
      break;
    case 'css_content':
      // ::before / ::after 는 DOM 엘리먼트가 아니므로 injected style로 처리
      cssRules.set(entry.selector, ko);
      rebuildCssRules();
      break;
  }
}

/**
 * selectors 배열 전체를 DOM에 적용
 */
export function patch(selectors, _textMap) {
  for (const entry of selectors) {
    if (entry.type === 'css_content') {
      cssRules.set(entry.selector, entry.ko);
      continue;
    }
    try {
      const els = document.querySelectorAll(entry.selector);
      for (const el of els) {
        patchElement(el, entry);
      }
    } catch (_) {
      // 잘못된 셀렉터 무시
    }
  }
  if (cssRules.size) rebuildCssRules();
}

/**
 * 새로 삽입된 노드에 패치 적용 (observer에서 호출)
 */
export function patchNode(node, selectors, textMap) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  for (const entry of selectors) {
    if (entry.type === 'css_content') continue;
    try {
      // 삽입된 노드 자체가 셀렉터와 매칭되거나, 자식 중에 매칭되는 경우
      if (node.matches?.(entry.selector)) {
        patchElement(node, entry);
      }
      const children = node.querySelectorAll(entry.selector);
      for (const el of children) {
        patchElement(el, entry);
      }
    } catch (_) {}
  }
}
