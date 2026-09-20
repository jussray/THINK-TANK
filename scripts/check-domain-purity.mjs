import fs from 'node:fs';
import path from 'node:path';

const root = 'app/domain';
const forbidden = [
  { label: 'window', pattern: /\bwindow\b/ },
  { label: 'document', pattern: /\bdocument\b/ },
  { label: 'fetch', pattern: /\bfetch\s*\(/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'Date.now', pattern: /\bDate\.now\s*\(/ },
  { label: 'new Date', pattern: /\bnew\s+Date\s*\(/ },
  { label: 'Math.random', pattern: /\bMath\.random\s*\(/ },
  { label: 'store import', pattern: /(?:from\s+|import\s*\()["'][^"']*\/stores\// },
  { label: 'runtime import', pattern: /(?:from\s+|import\s*\()["'][^"']*\/runtime\// },
  { label: 'provider import', pattern: /(?:from\s+|import\s*\()["'][^"']*\/providers\// },
  { label: 'billing import', pattern: /(?:from\s+|import\s*\()["'][^"']*\/billing\// }
];

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.isFile() && /\.[cm]?[jt]s$/.test(entry.name) ? [full] : [];
  });
}

const failures = [];
for (const file of filesUnder(root)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) failures.push(`${file}: forbidden domain dependency: ${rule.label}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Domain purity boundary OK.');
