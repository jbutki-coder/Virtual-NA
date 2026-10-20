import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFile(path.join(root, file), 'utf8');

async function serverContext(fetch) {
  const code = (await read('server.js')).replace(/^import .*;\r?\n/gm, '')
    .replace('fileURLToPath(import.meta.url)', JSON.stringify(path.join(root, 'server.js')));
  const app = { use() {}, get() {}, listen() {} };
  const express = Object.assign(() => app, { static() {} });
  const context = vm.createContext({express, cors: () => {}, fs, path, fileURLToPath: x => x, fetch,
    AbortController, setTimeout, clearTimeout, process, console: { warn() {} }});
  vm.runInContext(code, context);
  return context;
}

test('all shipped JSON files parse and US NA helplines are available', async () => {
  for (const file of ['helplines.json', 'international-helplines.json', 'custom-meetings.json', 'manifest.json']) {
    JSON.parse(await read('public/' + file));
  }
  const us = JSON.parse(await read('public/helplines.json'));
  assert.ok(us.some(h => h.name === 'Michigan Region NA Helpline'));
});

test('concurrent refreshes share work, preserve failures temporarily, and accept removals', async () => {
  let count = 0;
  let mode = 'success';
  const context = await serverContext(async () => {
    count++;
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mode === 'failure') throw new Error('offline');
    return {ok: true, headers: new Headers({'content-type':'application/json'}), text: async () => JSON.stringify(mode === 'empty' ? [] : [{meeting_name:'Test', venue_type:'2', virtual_meeting_link:'https://zoom.us/j/123', time_zone:'America/New_York'}])};
  });
  const [first] = await Promise.all([context.getRawMeetingsWithCache(true), context.getRawMeetingsWithCache(true)]);
  assert.equal(count, 6);
  assert.equal(first.sourceReport[0].ok, true);
  mode = 'failure';
  const failed = await context.getRawMeetingsWithCache(true);
  assert.equal(failed.sourceReport[0].stale, true);
  assert.equal(failed.meetings.length, first.meetings.length);
  vm.runInContext('for (const entry of sourceSnapshots.values()) entry.fetchedAt -= 25 * 60 * 60 * 1000', context);
  const expired = await context.getRawMeetingsWithCache(true);
  assert.equal(expired.sourceReport[0].stale, false);
  assert.equal(expired.meetings.length, first.meetings.length - 6);
  mode = 'empty';
  const removed = await context.getRawMeetingsWithCache(true);
  assert.equal(removed.sourceReport[0].ok, true);
  assert.equal(removed.meetings.length, first.meetings.length - 6);
});

test('expired cache returns promptly while refreshing in background', async () => {
  const context = await serverContext(() => new Promise(() => {}));
  vm.runInContext('cachedRawMeetings = [{name:"saved"}]; cachedAt = Date.now() - CACHE_TTL_MS - 1;', context);
  const result = await context.getRawMeetingsWithCache();
  assert.equal(result.meetings[0].name, 'saved');
  assert.equal(result.fromCache, true);
});

test('timezone conversion preserves expected local day and time', async () => {
  const context = await serverContext();
  const result = context.convertMeetingToTargetTimeZone({weekday:1, startTime:'00:30:00', sourceTimeZone:'America/New_York'}, 'America/Los_Angeles');
  assert.equal(result.weekday, 0);
  assert.equal(result.startTime, '21:30:00');
});

test('helpline selection requires an explicit choice and excludes non-NA referral', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'', hidden:false, textContent:'', options:[],
      replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; },
      add(option) { this.options.push(option); }, removeAttribute(name) { delete this[name]; }});
    return elements.get(id);
  };
  const context = vm.createContext({document:{getElementById:element, addEventListener() {}}, navigator:{},
    window:{location:{href:'unchanged'}}, Option: function(text,value){this.text=text;this.value=value;},
    fetch: async url => ({ok:true,json:async()=>JSON.parse(await read('public'+url))}), AbortSignal, Intl, console});
  const html = await read('public/index.html');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  const helplines = await context.loadHelplines();
  assert.ok(helplines.some(h => h.country === 'United States' && h.phone.startsWith('+1')));
  assert.ok(!helplines.some(h => h.isNA === false));
  await context.handleCallNaNow();
  assert.equal(context.window.location.href, 'unchanged');
  assert.equal(element('helplineCallLink').hidden, true);
  element('helplineCountry').value = 'United States';
  element('helplineCountry').onchange();
  element('helplineSelect').value = element('helplineSelect').options[1].value;
  element('helplineSelect').onchange();
  assert.match(element('helplineCallLink').href, /^tel:\+1/);
  element('helplineCountry').value = 'United Kingdom';
  element('helplineCountry').onchange();
  assert.equal(element('helplineCallLink').hidden, true);
  element('helplineSelect').value = element('helplineSelect').options[1].value;
  element('helplineSelect').onchange();
  assert.match(element('helplineCallLink').href, /^tel:\+44/);
});
