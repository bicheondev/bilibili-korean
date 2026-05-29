/**
 * analyze.cjs
 * 수집된 translation-map-draft.json을 정제해서
 * 확장 프로그램용 selectors.json 생성
 */

const fs = require('fs');
const path = require('path');

const DRAFT_PATH = path.resolve('./output/translation-map-draft.json');
const OUT_PATH   = path.resolve('./extension/locales/selectors.json');

// 번역이 없는 항목을 필터링하고 구조 정제
const draft = JSON.parse(fs.readFileSync(DRAFT_PATH, 'utf-8'));

// ko 값이 채워진 것만 통과 (초기엔 전부 빈 값 → 나중에 채우면 재실행)
const filled   = draft.filter(e => e.ko && e.ko.trim());
const unfilled = draft.filter(e => !e.ko || !e.ko.trim());

console.log(`전체: ${draft.length}개`);
console.log(`번역 완료: ${filled.length}개`);
console.log(`미번역: ${unfilled.length}개`);

// 확장 프로그램용 구조로 변환
const selectors = filled.map(e => ({
  selector: e.selector,
  type: e.type,       // textContent | placeholder | aria-label | title | css_content | data-title | ...
  zh: e.zh,
  ko: e.ko,
}));

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(selectors, null, 2), 'utf-8');

// 미번역 목록도 따로 저장
fs.writeFileSync(
  path.resolve('./output/untranslated.json'),
  JSON.stringify(unfilled, null, 2),
  'utf-8'
);

console.log(`\n✅ selectors.json 생성 완료`);
console.log(`   → extension/locales/selectors.json`);
