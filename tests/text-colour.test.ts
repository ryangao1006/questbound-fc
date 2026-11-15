import test from 'node:test';import assert from 'node:assert/strict';
import {readableClubInk,colourContrast} from '../lib/text-colour.ts';
import {createFootballWorldRoster} from '../lib/football-data.ts';
test('all roster club badge letters have readable contrast without changing kit colours',()=>{for(const club of createFootballWorldRoster().clubs){const [bg,preferred]=club.colors;const ink=readableClubInk(bg,preferred);assert.ok(colourContrast(bg,ink)>=4.5,club.name);assert.equal(club.colors[0],bg)}});
test('readable brand colours are kept; low-contrast pairs choose a safe ink',()=>{assert.equal(readableClubInk('#ffffff','#123456'),'#123456');assert.equal(readableClubInk('#ffffff','#ffff00'),'#000000');assert.equal(readableClubInk('#000','#fff'),'#fff')});
