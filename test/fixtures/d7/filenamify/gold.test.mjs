// gold.test.mjs — the INDEPENDENT GOLD for D7 Task 1 (the D5 standing arbiter). These are the maintainer's
// own regression assertions from sindresorhus/filenamify PR #46, ported verbatim from ava to node:test.
// Written to the workdir only AFTER the worker finishes — never visible to it. The NUL.tar.gz / COM1.log /
// LPT9.csv cases are FRESH: the prose lists ONLY CON.txt, so passing means getting the CONVENTION right
// (suffix before the extension, case-insensitive, correct base for multi-dot names), not memorizing examples.
import test from 'node:test';
import assert from 'node:assert/strict';
import filenamify from './impl.mjs';

test('reserved names WITH an extension get the suffix before the extension', () => {
	assert.equal(filenamify('CON.txt'), 'CON!.txt');
	assert.equal(filenamify('con.txt'), 'con!.txt');
	assert.equal(filenamify('NUL.tar.gz'), 'NUL!.tar.gz'); // multi-dot: base is the FIRST segment, not the last
	assert.equal(filenamify('COM1.log'), 'COM1!.log');
	assert.equal(filenamify('LPT9.csv'), 'LPT9!.csv');
});

test('bare reserved and non-reserved names keep their existing behavior (regression guard)', () => {
	assert.equal(filenamify('con'), 'con!');
	assert.equal(filenamify('Com'), 'Com'); // "Com" is not a reserved device name
	assert.equal(filenamify('COM1'), 'COM1!');
	assert.equal(filenamify('hello.txt'), 'hello.txt');
});
