import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destination } from '../extension/model.js';
test('web addresses open directly', () => { assert.equal(destination('example.com'),'https://example.com/'); assert.equal(destination('http://localhost:3000'),'http://localhost:3000/'); });
test('queries and unsafe schemes become search queries', () => { for (const q of ['hello world','javascript:alert(1)','file:///tmp/test']) assert.equal(destination(q),`https://www.google.com/search?q=${encodeURIComponent(q)}`); });
test('empty input does not navigate', () => assert.equal(destination('   '),null));
