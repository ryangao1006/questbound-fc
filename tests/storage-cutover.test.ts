import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyReadOnly} from '../lib/storage-cutover.ts';
test('the original planner remains writable until an explicit verified migration cutover',()=>{for(const flag of [undefined,'','0','false'])assert.equal(legacyReadOnly({PLANNER_READ_ONLY:flag}),false);assert.equal(legacyReadOnly({PLANNER_READ_ONLY:'1'}),true)});
