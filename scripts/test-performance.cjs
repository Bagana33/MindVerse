// Run with: node --test scripts/test-performance.cjs (no database or network writes).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const { cachedFetch, clearCache, invalidateCache } = require('../lib/fetchCache.ts');
const server = require('../lib/serverCache.ts');
const avatars = require('../lib/avatars.ts');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function loadWithMocks(filename, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}

beforeEach(() => { clearCache(); server.invalidateServerCache(); });

test('simultaneous GETs use one fetch and preserve body, status and headers', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('partial', {
    status: 206, statusText: 'Partial Content', headers: { etag: 'v1', 'content-type': 'text/plain' },
  }));
  const responses = await Promise.all([cachedFetch('/test'), cachedFetch('/test'), cachedFetch('/test')]);
  assert.equal(mock.mock.callCount(), 1);
  for (const response of responses) {
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('etag'), 'v1');
    assert.equal(await response.text(), 'partial');
  }
  assert.equal(await (await cachedFetch('/test')).text(), 'partial');
  assert.equal(mock.mock.callCount(), 1);
});

test('HTTP errors and no-store responses are returned without being cached', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response('retry', { status: 503 });
  });
  assert.equal((await cachedFetch('/failure')).status, 503);
  assert.equal((await cachedFetch('/failure')).status, 503);
  assert.equal(calls, 2);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response('private', { headers: { 'cache-control': 'private, no-store' } });
  });
  await cachedFetch('/private');
  await cachedFetch('/private');
  assert.equal(calls, 4);
});

test('mutations, explicit no-store and caller cancellation bypass shared fetch', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('ok'));
  const signal = new AbortController().signal;
  for (const options of [{ method: 'POST' }, { cache: 'no-store' }, { signal }]) {
    await cachedFetch('/test', options);
    await cachedFetch('/test', options);
  }
  assert.equal(mock.mock.callCount(), 6);
  assert.equal(mock.mock.calls[4].arguments[1].signal, signal);
});

test('request headers distinguish credentials and equivalent Headers objects deduplicate', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('ok'));
  await cachedFetch('/test', { headers: new Headers({ authorization: 'one' }) });
  await cachedFetch('/test', { headers: { authorization: 'one' } });
  await cachedFetch('/test', { headers: { authorization: 'two' } });
  assert.equal(mock.mock.callCount(), 2);
});

test('invalidated in-flight responses cannot replace a newer client response', async t => {
  const old = deferred();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => ++calls === 1 ? old.promise : Promise.resolve(new Response('new')));
  const oldRequest = cachedFetch('/posts');
  await Promise.resolve();
  invalidateCache('/posts');
  assert.equal(await (await cachedFetch('/posts')).text(), 'new');
  old.resolve(new Response('old'));
  assert.equal(await (await oldRequest).text(), 'old');
  assert.equal(await (await cachedFetch('/posts')).text(), 'new');
  assert.equal(calls, 2);
});

test('client entries expire at TTL and a failed fetch does not poison retries', async t => {
  let now = 100;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 2) throw new Error('offline');
    return new Response(String(calls));
  });
  await cachedFetch('/test');
  now += 15_000;
  await assert.rejects(cachedFetch('/test'), /offline/);
  assert.equal(await (await cachedFetch('/test')).text(), '3');
});

test('server coalesces concurrent loaders and retries rejected loads', async () => {
  let calls = 0;
  const loader = async () => { calls++; return ['post']; };
  await Promise.all([server.getOrLoadCached('posts', loader), server.getOrLoadCached('posts', loader)]);
  assert.equal(calls, 1);
  server.invalidateServerCache('posts');
  await assert.rejects(server.getOrLoadCached('posts', async () => { throw new Error('unavailable'); }));
  assert.deepEqual(await server.getOrLoadCached('posts', loader), ['post']);
  assert.equal(calls, 2);
});

test('server invalidation and direct writes defeat older pending loaders', async () => {
  const old = deferred();
  const loading = server.getOrLoadCached('posts:page', () => old.promise);
  await Promise.resolve();
  server.invalidateServerCache('posts');
  server.setCached('posts:page', 'fresh');
  old.resolve('stale');
  await loading;
  assert.equal(server.getCached('posts:page'), 'fresh');
});

test('server cache expires on the TTL boundary and caps retained entries', t => {
  let now = 100;
  t.mock.method(Date, 'now', () => now);
  server.setCached('expiring', 'value', 100);
  now += 100;
  assert.equal(server.getCached('expiring'), null);
  for (let i = 0; i < 251; i++) server.setCached(`item:${i}`, i);
  assert.equal(server.getCached('item:0'), null);
  assert.equal(server.getCached('item:250'), 250);
});

test('inline avatars become stable versioned URLs and unsafe formats are rejected', () => {
  const source = 'data:image/png;base64,aGVsbG8=';
  const url = avatars.getPublicAvatarUrl('user@example.test', source);
  assert.match(url, /^\/api\/avatars\?email=user%40example.test&v=[a-f0-9]{16}$/);
  assert.equal(url, avatars.getPublicAvatarUrl('user@example.test', source));
  assert.equal(avatars.getPublicAvatarUrl('user', 'https://example.test/avatar.png'), 'https://example.test/avatar.png');
  assert.equal(avatars.getPublicAvatarUrl('user', 'data:image/svg+xml;base64,aGVsbG8='), undefined);
  assert.equal(avatars.decodeAvatarData('data:text/html;base64,aGVsbG8='), null);
  assert.equal(avatars.getPublicAvatarUrl('user@example.test'), '/api/avatars?email=user%40example.test');
});

test('avatar endpoint serves small WebP thumbnails and conditional cache responses', async () => {
  const png = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ab22ff' } }).png().toBuffer();
  const url = avatars.getPublicAvatarUrl('user@example.test', `data:image/png;base64,${png.toString('base64')}`);
  const route = loadWithMocks('app/api/avatars/route.ts', {
    sharp, '../../../lib/supabase': { supabase: { from() { throw new Error('cached source should avoid query'); } } },
    '../../../lib/avatars': avatars, '../../../lib/serverCache': server,
  });
  const response = await route.GET(new Request(`https://example.test${url}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 96);
  assert.equal(metadata.height, 96);
  assert.ok(bytes.length < png.length);
  const unchanged = await route.GET(new Request(`https://example.test${url}`, { headers: { 'if-none-match': response.headers.get('etag') } }));
  assert.equal(unchanged.status, 304);
  assert.equal((await route.GET(new Request('https://example.test/api/avatars?email=user&v=invalid'))).status, 400);
});

test('current avatar URL lazily queries once and serves a cached placeholder or remote redirect', async () => {
  let queries = 0;
  let currentSource = null;
  const query = {
    select() { return this; }, eq() { return this; }, abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this; },
    async maybeSingle() { queries++; return { data: { avatar_url: currentSource }, error: null }; },
  };
  const route = loadWithMocks('app/api/avatars/route.ts', {
    sharp, '../../../lib/supabase': { supabase: { from() { return query; } } },
    '../../../lib/avatars': avatars, '../../../lib/serverCache': server,
  });
  const request = new Request('https://example.test/api/avatars?email=user');
  const placeholder = await route.GET(request);
  assert.equal(placeholder.status, 200);
  assert.equal(placeholder.headers.get('cache-control'), 'public, max-age=60, stale-while-revalidate=120');
  assert.equal((await sharp(Buffer.from(await placeholder.arrayBuffer())).metadata()).format, 'webp');
  await route.GET(request);
  assert.equal(queries, 1);
  server.invalidateServerCache('avatar:');
  currentSource = 'https://images.example.test/avatar.jpg';
  const redirected = await route.GET(request);
  assert.equal(redirected.status, 307);
  assert.equal(redirected.headers.get('location'), currentSource);
});

test('post response caches the shared read but applies visibility per session and supports shared IDs', async () => {
  let session = null;
  let calls = 0;
  let args;
  const route = loadWithMocks('app/api/posts/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '../../../lib/session': { getSessionFromCookies: async () => session },
    '../../../lib/posts': { getPostsPage: async (...values) => {
      calls++; args = values;
      return [{ id: 'public', visibility: 'PUBLIC' }, { id: 'private', visibility: 'PRIVATE', authorEmail: 'owner' }];
    } },
    '../../../lib/serverCache': server,
    '../../../lib/notifications': {}, '../../../lib/users': {}, '../../../lib/comments': {}, '../../../lib/ai-critique': {},
  });
  const publicResponse = await route.GET(new Request('https://example.test/api/posts'));
  assert.equal(publicResponse.headers.get('cache-control'), 'private, no-store');
  assert.equal(publicResponse.headers.get('vary'), 'Cookie');
  assert.equal((await publicResponse.json()).posts.length, 1);
  session = { email: 'owner' };
  assert.equal((await (await route.GET(new Request('https://example.test/api/posts'))).json()).posts.length, 2);
  assert.equal(calls, 1);
  await route.GET(new Request('https://example.test/api/posts?id=shared-post'));
  assert.deepEqual(args, [1, undefined, undefined, undefined, 'shared-post']);
  assert.equal((await route.GET(new Request('https://example.test/api/posts?before=invalid'))).status, 400);
});

function postStore() {
  const tables = {
    posts: [{ id: 'post-1', title: 'Original', description: 'Original description', text: 'Original description', author_email: 'owner@example.test', created_at: '2026-01-01T00:00:00Z', image_data: 'https://example.test/original.png', visibility: 'PUBLIC' }],
    reactions: [{ post_id: 'post-1', user_email: 'reader@example.test', type: 'love' }],
    comments: [{ post_id: 'post-1', content: 'Keep this comment' }],
    users: [{ email: 'owner@example.test', name: 'Owner', grade: '11' }],
  };
  const writes = [];
  const supabase = { from(table) {
    const filters = []; let changes; let deleting = false;
    const run = () => {
      const matches = tables[table].filter(row => filters.every(filter => filter(row)));
      if (changes) { writes.push({table,changes}); matches.forEach(row => Object.assign(row, changes)); }
      if (deleting) tables[table] = tables[table].filter(row => !matches.includes(row));
      return {data: matches, error: null};
    };
    return {
      select() {return this;}, order() {return this;}, limit() {return this;}, abortSignal() {return this;},
      eq(key,value) {filters.push(row=>row[key]===value);return this;},
      in(key,values) {filters.push(row=>values.includes(row[key]));return this;},
      update(value) {changes=value;return this;}, delete() {deleting=true;return this;},
      insert() {throw new Error('Editing must never insert replacement posts');},
      async maybeSingle() {const result=run();return {...result,data:result.data[0]||null};},
      then(resolve,reject) {return Promise.resolve(run()).then(resolve,reject);},
    };
  }};
  const posts = loadWithMocks('lib/posts.ts', {'./supabase': {supabase}, './avatars': avatars});
  return {posts,tables,writes};
}

test('editing a post preserves its ID, date, ownership, reactions and comments', async () => {
  const {posts,tables,writes} = postStore();
  const result = await posts.updatePostContent('post-1','owner@example.test',{title:'Updated title',description:'Updated description',imageUrl:'https://example.test/new.png'});
  assert.equal(result.id,'post-1'); assert.equal(result.createdAt,'2026-01-01T00:00:00Z');
  assert.equal(result.authorEmail,'owner@example.test'); assert.equal(result.points,1);
  assert.equal(result.commentCount,1); assert.equal(result.reactions[0].type,'LOVE');
  assert.equal(tables.comments[0].content,'Keep this comment'); assert.equal(tables.posts.length,1);
  assert.deepEqual(Object.keys(writes[0].changes).sort(),['description','image_data','text','title']);
});

test('post ownership is enforced by the database write predicate', async () => {
  const {posts,tables} = postStore();
  const before=JSON.stringify(tables);
  assert.equal(await posts.updatePostContent('post-1','stranger@example.test',{title:'Bad edit',description:'Unauthorized change'}),null);
  assert.equal(JSON.stringify(tables),before);
  assert.equal(await posts.deletePost('post-1','stranger@example.test'),false);
  assert.equal(JSON.stringify(tables),before);
});

test('post edit preserves omitted artwork and can explicitly remove it', async () => {
  const {posts,tables} = postStore();
  await posts.updatePostContent('post-1','owner@example.test',{title:'Updated title',description:'Updated description'});
  assert.equal(tables.posts[0].image_data,'https://example.test/original.png');
  await posts.updatePostContent('post-1','owner@example.test',{title:'Updated title',description:'Updated description',imageUrl:null});
  assert.equal(tables.posts[0].image_data,null);
});

test('PATCH rejects unauthenticated and invalid edits before touching storage', async () => {
  let session=null; let updates=0;
  const route=loadWithMocks('app/api/posts/route.ts',{
    'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
    '../../../lib/session':{getSessionFromCookies:async()=>session},
    '../../../lib/posts':{updatePostContent:async()=>{updates++;return {id:'post-1'};}},
    '../../../lib/serverCache':server,'../../../lib/notifications':{},'../../../lib/users':{},'../../../lib/comments':{},'../../../lib/ai-critique':{},
  });
  const request=body=>new Request('https://example.test/api/posts?id=post-1',{method:'PATCH',body:JSON.stringify(body)});
  assert.equal((await route.PATCH(request({title:'Valid title',description:'Valid description'}))).status,401);
  session={email:'owner@example.test'};
  assert.equal((await route.PATCH(request({title:'x',description:'bad'}))).status,400);
  assert.equal(updates,0);
  assert.equal((await route.PATCH(request({title:'Valid title',description:'Valid description'}))).status,200);
  assert.equal(updates,1);
});
