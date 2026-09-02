import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { findMentionedUsers } from '../src/common/mentions';

test('findMentionedUsers matches first-name mentions', () => {
  const users = [
    { id: '1', first_name: 'Maic', last_name: 'Sebakara' },
    { id: '2', first_name: 'Annie', last_name: 'Bwiza' },
  ];
  const mentioned = findMentionedUsers('Hey @Maic can you review this?', users, '3');
  assert.equal(mentioned.length, 1);
  assert.equal(mentioned[0].id, '1');
  assert.equal(findMentionedUsers('Hey @Maic', users, '1').length, 0);
});
