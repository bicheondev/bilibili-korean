/**
 * push.cjs
 * 수집 완료 후 output/ 결과를 GitHub에 자동 push
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf-8' });
    if (out.trim()) console.log(out.trim());
  } catch (e) {
    console.error(e.message);
  }
}

const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

run('git add output/ extension/locales/');
run(`git commit -m "chore: collect ${timestamp}"`);
run('git push origin main');

console.log('\n✅ Push 완료');
