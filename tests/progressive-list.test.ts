import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetGroups,takeWithin} from '../lib/progressive-list.ts';

test('a row budget is spent in display order and never skips a row',()=>{
 const groups=[{key:'a',tasks:[1,2,3]},{key:'b',tasks:[4,5,6]},{key:'c',tasks:[]}];
 const {groups:shown,hidden}=budgetGroups(groups,4);
 assert.deepEqual(shown.map(group=>group.tasks),[[1,2,3],[4],[]]);
 assert.equal(hidden,2);
 assert.deepEqual(shown.map(group=>group.key),['a','b','c']);
});

test('a budget larger than the list renders everything and hides nothing',()=>{
 const groups=[{key:'a',tasks:[1]}];
 const {groups:shown,hidden}=budgetGroups(groups,50);
 assert.deepEqual(shown[0].tasks,[1]);
 assert.equal(hidden,0);
});

test('negative or zero budgets render no rows without dropping groups',()=>{
 const groups=[{key:'a',tasks:[1,2]},{key:'b',tasks:[3]}];
 const {groups:shown,hidden}=budgetGroups(groups,0);
 assert.deepEqual(shown.map(group=>group.tasks),[[],[]]);
 assert.equal(hidden,3);
 assert.deepEqual(takeWithin([1,2],-5),{taken:[],left:0,hidden:2});
});

test('a group is never mutated by budgeting',()=>{
 const groups=[{key:'a',tasks:[1,2,3]}];
 budgetGroups(groups,1);
 assert.deepEqual(groups[0].tasks,[1,2,3]);
});
