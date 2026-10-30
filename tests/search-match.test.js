import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPage, queryVariants } from '../extension/search-match.js';
const page={title:'GitHub — Project Café',url:'https://github.com/team/project'};
test('wrong Russian keyboard layout finds an English domain',()=>{
  assert.ok(queryVariants('пшерги').includes('github'));
  assert.equal(matchPage(page,'пшерги').kind,'layout');
});
test('English layout can find a Russian title without changing original text',()=>{
  assert.ok(queryVariants('ghbdtn').includes('привет'));
  assert.equal(matchPage({title:'Привет мир',url:'https://example.com'},'ghbdtn').kind,'layout');
});
test('small spelling errors and transpositions match longer words',()=>{
  assert.equal(matchPage(page,'githbu').kind,'typo');
  assert.equal(matchPage(page,'githb').kind,'typo');
  assert.equal(matchPage(page,'ghhub'),null);
});
test('short queries do not fuzzy-match unrelated words',()=>{
  assert.equal(matchPage({title:'cat',url:'https://cat.example'},'cut'),null);
});
test('accent-insensitive multiword title and URL matching works',()=>{
  assert.ok(matchPage(page,'cafe team'));
});
test('exact domains rank above title and path mentions',()=>{
  const direct=matchPage(page,'github');
  const incidental=matchPage({title:'GitHub tips',url:'https://notes.example/github'},'github');
  assert.ok(direct.score>incidental.score);
});
