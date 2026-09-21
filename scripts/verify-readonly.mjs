import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:3000';
async function read(path) {
 const start = performance.now();
 const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
 const text = await response.text();
 assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
 const data = JSON.parse(text);
 assert.equal(data.ok, true, `${path}: unsuccessful body`);
 console.log(JSON.stringify({path,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text),cache:response.headers.get('cache-control')}));
 return {response,data};
}
const {response:postResponse,data:feed} = await read('/api/posts?limit=10');
assert.match(postResponse.headers.get('cache-control') || '', /private.*no-store/);
assert.equal(new Set(feed.posts.map(p=>p.id)).size, feed.posts.length);
assert(feed.posts.every(p=>!p.authorAvatarUrl?.startsWith('data:')));
if(feed.posts.length) {
 const first = feed.posts[0];
 const {data:shared} = await read(`/api/posts?id=${encodeURIComponent(first.id)}`);
 assert.equal(shared.posts.length,1);
 assert.equal(shared.posts[0].id,first.id);
 const {data:older} = await read(`/api/posts?limit=10&before=${encodeURIComponent(feed.posts.at(-1).createdAt)}`);
 assert(older.posts.every(p=>!feed.posts.some(existing=>existing.id===p.id)));
}
const {data:search} = await read('/api/posts?search=mindverse_no_matching_post_7f3b');
assert.equal(search.posts.length,0);
const {data:board} = await read('/api/leaderboard');
assert(Array.isArray(board.leaderboard));
assert(board.leaderboard.every(u=>!u.avatarUrl?.startsWith('data:')));
const {response:lessonResponse,data:lessons} = await read('/api/lessons');
assert(Array.isArray(lessons.lessons));
assert.match(lessonResponse.headers.get('cache-control') || '', /private.*no-store/);
await read('/api/contests');
console.log('PASS: read-only feed, shared link, pagination, search, leaderboard, lessons, contests');
