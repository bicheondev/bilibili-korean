/**
 * collect.cjs
 * Bilibili 전체 페이지 자동 탐색 크롤러
 * - URL 패턴 기반 유형 분류 (같은 유형은 최대 N개만)
 * - 인터랙션(hover/click/scroll) 후 스냅샷
 * - 텍스트 노드 + 속성(placeholder, aria-label, title) 추출
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── 설정 ──────────────────────────────────────────────────────────────────────
const BROWSERS_PATH = 'C:\\Users\\CKIRUser\\Downloads\\pw-browsers';
const OUTPUT_DIR    = path.resolve('./output');
const MAX_PER_TYPE  = 2;   // 같은 페이지 유형 최대 수집 수
const MAX_TOTAL     = 200; // 전체 최대 페이지 수
const CONCURRENCY   = 3;   // 동시 탭 수

// URL 패턴 → 유형 분류
const URL_PATTERNS = [
  { type: 'home',            re: /^https:\/\/(www\.)?bilibili\.com\/?$/ },
  { type: 'video',           re: /bilibili\.com\/video\/BV/ },
  { type: 'bangumi_play',    re: /bilibili\.com\/bangumi\/play/ },
  { type: 'bangumi_media',   re: /bilibili\.com\/bangumi\/media/ },
  { type: 'live',            re: /live\.bilibili\.com\/\d/ },
  { type: 'space',           re: /space\.bilibili\.com\/\d/ },
  { type: 'search_all',      re: /search\.bilibili\.com\/all/ },
  { type: 'search_video',    re: /search\.bilibili\.com\/video/ },
  { type: 'search_bangumi',  re: /search\.bilibili\.com\/bangumi/ },
  { type: 'search_live',     re: /search\.bilibili\.com\/live/ },
  { type: 'search_user',     re: /search\.bilibili\.com\/upuser/ },
  { type: 'ranking',         re: /bilibili\.com\/ranking/ },
  { type: 'channel',         re: /bilibili\.com\/v\// },
  { type: 'game_detail',     re: /bilibili\.com\/game\/detail/ },
  { type: 'game_center',     re: /game\.bilibili\.com/ },
  { type: 'read_article',    re: /bilibili\.com\/read\/cv/ },
  { type: 'read_home',       re: /bilibili\.com\/read\/home/ },
  { type: 'blackboard',      re: /bilibili\.com\/blackboard/ },
  { type: 'dynamic',         re: /bilibili\.com\/opus|t\.bilibili\.com/ },
  { type: 'topic',           re: /bilibili\.com\/v\/topic/ },
  { type: 'festival',        re: /bilibili\.com\/festival/ },
  { type: 'account',         re: /account\.bilibili\.com/ },
  { type: 'member',          re: /member\.bilibili\.com/ },
  { type: 'manga',           re: /manga\.bilibili\.com/ },
  { type: 'show',            re: /show\.bilibili\.com/ },
  { type: 'mall',            re: /mall\.bilibili\.com/ },
  { type: 'message',         re: /message\.bilibili\.com/ },
];

// 씨앗 URL (크롤링 시작점)
const SEED_URLS = [
  'https://www.bilibili.com',
  'https://www.bilibili.com/video/BV1GJ411x7h7',
  'https://www.bilibili.com/bangumi/play/ep199612',
  'https://www.bilibili.com/bangumi/media/md28220578',
  'https://live.bilibili.com/1',
  'https://space.bilibili.com/2',
  'https://search.bilibili.com/all?keyword=anime',
  'https://search.bilibili.com/video?keyword=anime',
  'https://search.bilibili.com/bangumi?keyword=anime',
  'https://search.bilibili.com/live?keyword=anime',
  'https://search.bilibili.com/upuser?keyword=anime',
  'https://www.bilibili.com/ranking',
  'https://www.bilibili.com/ranking/video/1',
  'https://www.bilibili.com/v/douga',
  'https://www.bilibili.com/v/game',
  'https://www.bilibili.com/v/music',
  'https://www.bilibili.com/v/dance',
  'https://www.bilibili.com/v/tech',
  'https://www.bilibili.com/v/life',
  'https://www.bilibili.com/v/knowledge',
  'https://www.bilibili.com/v/food',
  'https://www.bilibili.com/v/fashion',
  'https://www.bilibili.com/v/sports',
  'https://www.bilibili.com/v/car',
  'https://www.bilibili.com/v/animal',
  'https://www.bilibili.com/game/detail/20',
  'https://game.bilibili.com',
  'https://www.bilibili.com/read/home',
  'https://www.bilibili.com/read/cv1',
  'https://www.bilibili.com/blackboard/activity-list.html',
  'https://manga.bilibili.com',
  'https://show.bilibili.com',
  'https://mall.bilibili.com',
  'https://message.bilibili.com',
  'https://account.bilibili.com/account/home',
  'https://member.bilibili.com',
];

// 인터랙션 시나리오 (유형별)
const INTERACTIONS = {
  '*': [
    { name: 'nav_user_hover', async fn(page) {
      const el = await page.$('.nav-user-center, .header-avatar-wrap, .bili-avatar');
      if (el) { await el.hover(); await page.waitForTimeout(600); }
    }},
    { name: 'nav_bangumi_hover', async fn(page) {
      const el = await page.$('a[href*="bangumi"], [data-fnid="bangumi"]');
      if (el) { await el.hover(); await page.waitForTimeout(600); }
    }},
    { name: 'nav_game_hover', async fn(page) {
      const el = await page.$('a[href*="game.bilibili"], [data-fnid="game"]');
      if (el) { await el.hover(); await page.waitForTimeout(600); }
    }},
    { name: 'search_focus', async fn(page) {
      const el = await page.$('.nav-search-input, #nav-searchform input');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'search_suggest', async fn(page) {
      const el = await page.$('.nav-search-input, #nav-searchform input');
      if (el) {
        await el.click();
        await el.type('a', { delay: 100 });
        await page.waitForTimeout(800);
      }
    }},
    { name: 'login_modal', async fn(page) {
      const el = await page.$('.header-login-entry, .login-btn, [data-target="login"], .nav-login-btn');
      if (el) { await el.click(); await page.waitForTimeout(1000); }
    }},
    { name: 'login_modal_close', async fn(page) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }},
  ],
  video: [
    { name: 'share_panel', async fn(page) {
      const el = await page.$('.share-wrap, [data-id="share"], .video-share-wrap');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'more_menu', async fn(page) {
      const el = await page.$('.video-toolbar-right .more, .more-short-button');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'coin_panel', async fn(page) {
      const el = await page.$('.video-coin, [data-id="coin"]');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'collect_panel', async fn(page) {
      const el = await page.$('.video-collect, [data-id="collect"]');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'quality_menu', async fn(page) {
      const el = await page.$('.bpx-player-ctrl-quality, .squirtle-quality-wrap');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'player_setting', async fn(page) {
      const el = await page.$('.bpx-player-ctrl-setting, .squirtle-setting-wrap');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'danmaku_setting', async fn(page) {
      const el = await page.$('.bpx-player-dm-setting, .squirtle-dm-setting');
      if (el) { await el.click(); await page.waitForTimeout(600); }
    }},
    { name: 'tab_intro', async fn(page) {
      const el = await page.$('[data-id="introduction"]');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'tab_episodes', async fn(page) {
      const el = await page.$('[data-id="episodes"]');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'desc_expand', async fn(page) {
      const el = await page.$('.toggle-btn, .desc-info-text .toggle');
      if (el) { await el.click(); await page.waitForTimeout(300); }
    }},
    { name: 'comment_sort', async fn(page) {
      const el = await page.$('.sort-item, .comment-sort-btn');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'report_menu', async fn(page) {
      const el = await page.$('.report-btn, [data-id="report"]');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
  ],
  bangumi_play: [
    { name: 'ep_list_hover', async fn(page) {
      const el = await page.$('.ep-list-wrap, .section-list');
      if (el) { await el.hover(); await page.waitForTimeout(500); }
    }},
    { name: 'follow_hover', async fn(page) {
      const el = await page.$('.follow-btn, .bangumi-follow-btn');
      if (el) { await el.hover(); await page.waitForTimeout(500); }
    }},
    { name: 'tab_intro', async fn(page) {
      const el = await page.$('.tab-intro, [data-id="intro"]');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'tab_comment', async fn(page) {
      const el = await page.$('.tab-reply, [data-id="reply"]');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
  ],
  space: [
    { name: 'tab_video',      async fn(page) { await clickTab(page, 0); } },
    { name: 'tab_dynamic',    async fn(page) { await clickTab(page, 1); } },
    { name: 'tab_collection', async fn(page) { await clickTab(page, 2); } },
    { name: 'tab_subscribe',  async fn(page) { await clickTab(page, 3); } },
  ],
  search_all: [
    { name: 'filter_open', async fn(page) {
      const el = await page.$('.filter-wrap, .vui_filter, .search-filter');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'order_by', async fn(page) {
      const el = await page.$('.order-wrap, .vui_select');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
  ],
  live: [
    { name: 'gift_panel', async fn(page) {
      const el = await page.$('.gift-wrap, .gift-btn');
      if (el) { await el.click(); await page.waitForTimeout(500); }
    }},
    { name: 'follow_hover', async fn(page) {
      const el = await page.$('.follow-btn, .room-info-follow');
      if (el) { await el.hover(); await page.waitForTimeout(500); }
    }},
  ],
};

async function clickTab(page, idx) {
  const tabs = await page.$$('.channel-list li, .nav-tab-bar li, [role="tab"]');
  if (tabs[idx]) {
    await tabs[idx].click();
    await page.waitForTimeout(800);
  }
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function classifyUrl(url) {
  for (const { type, re } of URL_PATTERNS) {
    if (re.test(url)) return type;
  }
  return null;
}

function normalizeBilibiliUrl(url) {
  try {
    const u = new URL(url);
    // bilibili 도메인만
    if (!u.hostname.endsWith('bilibili.com')) return null;
    // 불필요 쿼리 제거
    ['from', 'spm_id_from', 'vd_source', 'search_source', 'share_source', 'timestamp'].forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}

async function extractLinks(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map(a => a.href)
      .filter(h => h.startsWith('http'))
  );
}

async function extractAllTexts(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // 1. 텍스트 노드 (중국어 포함)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (!t || seen.has(t)) continue;
      if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) continue;
      const p = node.parentElement;
      if (!p) continue;
      const tag = p.tagName.toLowerCase();
      if (['script','style','noscript'].includes(tag)) continue;

      // 셀렉터 생성
      let selector = tag;
      if (p.id) selector = `#${p.id}`;
      else if (p.className && typeof p.className === 'string') {
        const cls = p.className.trim().split(/\s+/).filter(c => !/^(is-|has-|active|selected|disabled|visible|hidden)/.test(c)).slice(0,2);
        if (cls.length) selector = `${tag}.${cls.join('.')}`;
      }

      seen.add(t);
      results.push({ text: t, selector, type: 'textContent', tag, fullClass: p.className });
    }

    // 2. placeholder 속성
    document.querySelectorAll('[placeholder]').forEach(el => {
      const t = el.getAttribute('placeholder').trim();
      if (!t || seen.has(t)) return;
      if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) return;
      seen.add(t);
      let selector = el.tagName.toLowerCase();
      if (el.id) selector = `#${el.id}`;
      else if (el.name) selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
      results.push({ text: t, selector, type: 'placeholder' });
    });

    // 3. aria-label
    document.querySelectorAll('[aria-label]').forEach(el => {
      const t = el.getAttribute('aria-label').trim();
      if (!t || seen.has(t)) return;
      if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) return;
      seen.add(t);
      let selector = el.tagName.toLowerCase();
      if (el.id) selector = `#${el.id}`;
      else if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).slice(0,2);
        if (cls.length) selector = `${el.tagName.toLowerCase()}.${cls.join('.')}`;
      }
      results.push({ text: t, selector, type: 'aria-label' });
    });

    // 4. title 속성
    document.querySelectorAll('[title]').forEach(el => {
      const t = el.getAttribute('title').trim();
      if (!t || seen.has(t)) return;
      if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) return;
      seen.add(t);
      let selector = el.tagName.toLowerCase();
      if (el.id) selector = `#${el.id}`;
      results.push({ text: t, selector, type: 'title' });
    });

    // 5. data-title, data-text 류
    document.querySelectorAll('[data-title],[data-text],[data-placeholder]').forEach(el => {
      ['data-title','data-text','data-placeholder'].forEach(attr => {
        const t = (el.getAttribute(attr) || '').trim();
        if (!t || seen.has(t)) return;
        if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) return;
        seen.add(t);
        results.push({ text: t, selector: el.tagName.toLowerCase(), type: attr });
      });
    });

    return results;
  });
}

async function extractCssContent(page) {
  // :before/:after CSS content에서 중국어 텍스트 추출
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    [...document.styleSheets].forEach(sheet => {
      try {
        [...sheet.cssRules].forEach(rule => {
          if (rule.selectorText && (rule.selectorText.includes('::before') || rule.selectorText.includes('::after') || rule.selectorText.includes(':before') || rule.selectorText.includes(':after'))) {
            const content = rule.style?.content;
            if (!content) return;
            const t = content.replace(/['"]/g, '').trim();
            if (!t || seen.has(t)) return;
            if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) return;
            seen.add(t);
            results.push({ text: t, selector: rule.selectorText, type: 'css_content' });
          }
        });
      } catch (_) {}
    });
    return results;
  });
}

async function snapshot(page, dir, name) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  fs.mkdirSync(dir, { recursive: true });
  try {
    await page.screenshot({ path: path.join(dir, `${safe}.png`), fullPage: false, timeout: 5000 });
  } catch (_) {}
  const html = await page.content();
  fs.writeFileSync(path.join(dir, `${safe}.html`), html, 'utf-8');
  return html;
}

// ── 메인 크롤러 ───────────────────────────────────────────────────────────────
(async () => {
  process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_PATH;
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: `${BROWSERS_PATH}\\chromium-1223\\chrome-win64\\chrome.exe`,
  });

  // 상태 관리
  const visited    = new Set();          // 방문한 URL
  const typeCounts = {};                 // 유형별 수집 수
  const queue      = [...SEED_URLS];    // 탐색 큐
  const allEntries = [];                 // 전체 수집 결과

  let total = 0;

  async function processUrl(url) {
    const normalized = normalizeBilibiliUrl(url);
    if (!normalized || visited.has(normalized)) return;

    const type = classifyUrl(normalized);
    if (!type) return;

    typeCounts[type] = typeCounts[type] || 0;
    if (typeCounts[type] >= MAX_PER_TYPE) return;

    visited.add(normalized);
    typeCounts[type]++;
    total++;

    const dir = path.join(OUTPUT_DIR, type, String(typeCounts[type]));
    console.log(`  [${total}/${MAX_TOTAL}] ${type}#${typeCounts[type]} → ${normalized}`);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9' },
    });
    const page = await context.newPage();

    // 미디어 파일 차단 (속도)
    await page.route('**/*.{mp4,mp3,flv,m4s,webm}', r => r.abort());

    const pageEntries = [];

    try {
      try {
        await page.goto(normalized, { waitUntil: 'networkidle', timeout: 25000 });
      } catch (_) {
        await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
      }

      // 초기 스냅샷
      await snapshot(page, dir, '01_initial');

      // 스크롤 (lazy load)
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let y = 0;
          const id = setInterval(() => {
            y += 600;
            window.scrollTo(0, y);
            if (y >= document.body.scrollHeight) { clearInterval(id); resolve(); }
          }, 100);
        });
      });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await snapshot(page, dir, '02_scrolled');

      // 텍스트 + 속성 추출
      let entries = await extractAllTexts(page);
      let cssEntries = await extractCssContent(page);
      entries = [...entries, ...cssEntries];

      // 인터랙션
      const interactions = [...(INTERACTIONS['*'] || []), ...(INTERACTIONS[type] || [])];
      let iIdx = 0;
      for (const interaction of interactions) {
        try {
          await interaction.fn(page);
          await page.waitForTimeout(500);
          await snapshot(page, dir, `03_${iIdx++}_${interaction.name}`);
          const extra = await extractAllTexts(page);
          const extraCss = await extractCssContent(page);
          entries = [...entries, ...extra, ...extraCss];
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        } catch (_) {}
      }

      // 탭/버튼 클릭
      const clickables = await page.$$('button, [role="tab"], .tab-item, [role="menuitem"], .bili-tabs__item');
      let cIdx = 0;
      for (const el of clickables.slice(0, 15)) {
        try {
          const text = (await el.textContent()).trim();
          if (!text) continue;
          await el.scrollIntoViewIfNeeded();
          await el.click({ timeout: 2000 });
          await page.waitForTimeout(600);
          await snapshot(page, dir, `04_tab_${cIdx++}_${text.slice(0,8)}`);
          const extra = await extractAllTexts(page);
          entries = [...entries, ...extra];
          await page.keyboard.press('Escape');
        } catch (_) {}
      }

      // 중복 제거
      const seen = new Set();
      const unique = entries.filter(e => {
        const key = `${e.text}::${e.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // pageType 메타 추가
      unique.forEach(e => { e.pageType = type; e.url = normalized; });
      pageEntries.push(...unique);

      // texts.json 저장
      fs.writeFileSync(path.join(dir, 'texts.json'), JSON.stringify(unique, null, 2), 'utf-8');
      console.log(`    ✓ 텍스트 ${unique.length}개`);

      // 링크 추출 → 큐 추가
      const links = await extractLinks(page);
      for (const link of links) {
        const n = normalizeBilibiliUrl(link);
        if (n && !visited.has(n)) {
          const t = classifyUrl(n);
          if (t && (typeCounts[t] || 0) < MAX_PER_TYPE) {
            queue.push(n);
          }
        }
      }

    } catch (e) {
      console.log(`    ✗ 에러: ${e.message}`);
    }

    await context.close();
    allEntries.push(...pageEntries);
  }

  // 큐 처리
  while (queue.length > 0 && total < MAX_TOTAL) {
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map(url => processUrl(url)));
  }

  // ── 전체 번역 맵 초안 생성 ──
  const translationMap = {};
  for (const entry of allEntries) {
    const key = `${entry.text}::${entry.type}`;
    if (!translationMap[key]) {
      translationMap[key] = {
        selector: entry.selector,
        type: entry.type,
        zh: entry.text,
        ko: '',
        pageTypes: new Set(),
      };
    }
    translationMap[key].pageTypes.add(entry.pageType);
  }

  // Set → Array 직렬화
  const mapArray = Object.values(translationMap).map(e => ({
    ...e,
    pageTypes: [...e.pageTypes],
  }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'translation-map-draft.json'),
    JSON.stringify(mapArray, null, 2),
    'utf-8'
  );

  console.log(`\n✅ 수집 완료`);
  console.log(`   방문 페이지: ${visited.size}개`);
  console.log(`   총 텍스트 항목: ${mapArray.length}개`);
  console.log(`   → output/translation-map-draft.json`);

  await browser.close();
})();
