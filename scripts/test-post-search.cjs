// Run: node --test scripts/test-post-search.cjs. Uses the actual PostgREST URL builder;
// the transport is mocked, so no credentials or database writes are involved.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PostgrestClient } = require('@supabase/postgrest-js');
const root = path.resolve(__dirname, '..');
const columns = ['title', 'description', 'text', 'author_email'];

function loadPosts(client) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/posts.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === './supabase') return { supabase: client };
    if (id === './avatars') return { getPublicAvatarUrl: () => undefined };
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}

// Parse the quoted-value portion of the documented PostgREST OR grammar. This
// rejects additional predicates, unterminated values and unescaped delimiters.
function parseSearch(filter) {
  assert.ok(filter.startsWith('(') && filter.endsWith(')'));
  let position = 1;
  const values = [];
  for (let index = 0; index < columns.length; index++) {
    const prefix = `${columns[index]}.imatch."`;
    assert.equal(filter.slice(position, position + prefix.length), prefix);
    position += prefix.length;
    let value = '', closed = false;
    while (position < filter.length) {
      const char = filter[position++];
      if (char === '"') { closed = true; break; }
      if (char === '\\') {
        assert.ok(['"', '\\'].includes(filter[position]), 'only PostgREST string escapes are permitted');
        value += filter[position++];
      } else value += char;
    }
    assert.ok(closed, 'quoted filter value is terminated');
    values.push(value);
    assert.equal(filter[position++], index === columns.length - 1 ? ')' : ',');
  }
  assert.equal(position, filter.length, 'user input cannot add OR predicates');
  return values;
}

const queries = [
  'hello,(test)', 'He said "hello"', '100%', '%', '_', '*', 'a_b', 'a*b',
  'C:\\work\\', 'a.b:c', '"),title.neq.null,or(title.eq."x',
  '(?i).*|^$', '***=literal', ' Өнгө, (дизайн) ', 'line one\nline two',
];
for (const input of queries) {
  test(`search treats ${JSON.stringify(input)} as literal text in exactly four predicates`, async () => {
    let calls = 0;
    const client = new PostgrestClient('https://example.test/rest/v1', {
      fetch: async (url, options) => {
        calls++;
        assert.equal(options.method, 'GET');
        const parsed = new URL(url);
        const patterns = parseSearch(parsed.searchParams.get('or'));
        assert.deepEqual(patterns, columns.map(() => `***=${input.trim()}`));
        assert.equal(parsed.searchParams.get('limit'), '7');
        assert.equal(parsed.searchParams.get('created_at'), 'lt.2026-09-15T00:00:00Z');
        // ***= means PostgreSQL literal mode. Punctuation-only searches must
        // match that punctuation, never become a wildcard matching every row.
        const needle = patterns[0].slice(4).toLocaleLowerCase();
        assert.ok(`prefix ${input.trim()} suffix`.toLocaleLowerCase().includes(needle));
        assert.equal('unrelated plain sentence'.includes(needle), false);
        return new Response('[]', { headers: { 'content-type': 'application/json' } });
      },
    });
    assert.deepEqual(await loadPosts(client).getPostsPage(7, '2026-09-15T00:00:00Z', undefined, input), []);
    assert.equal(calls, 1);
  });
}

test('blank search keeps the regular feed; impossible NUL search returns no matches without a request', async () => {
  let calls = 0;
  const client = new PostgrestClient('https://example.test/rest/v1', {
    fetch: async url => {
      calls++;
      assert.equal(new URL(url).searchParams.has('or'), false);
      return new Response('[]', { headers: { 'content-type': 'application/json' } });
    },
  });
  const posts = loadPosts(client);
  await posts.getPostsPage(7, undefined, undefined, '   ');
  assert.equal(calls, 1);
  assert.deepEqual(await posts.getPostsPage(7, undefined, undefined, '\0'), []);
  assert.equal(calls, 1);
});
