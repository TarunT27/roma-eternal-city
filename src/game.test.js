import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, tick, build, getStats, saveGame, loadGame, SAVE_KEY } from './game.js';

test('pause freezes the city, speed advances it, and long frame gaps are bounded', () => {
  const paused = { ...initialState(), paused: true };
  assert.equal(tick(paused, 1), paused);
  assert.equal(tick({ ...initialState(), speed: 3 }, 0.5).elapsed, 1.5);
  assert.equal(tick(initialState(), 900).elapsed, 1);
  assert.equal(tick(initialState(), -1).elapsed, 0);
  assert.equal(tick(initialState(), NaN).elapsed, 0);
});

test('placement cannot overspend, overlap, or escape the aligned city grid', () => {
  const poor = { ...initialState(), coins: 79 };
  assert.equal(build(poor, 'farm', 0, 0).state, poor);
  assert.match(build(poor, 'farm', 0, 0).error, /1 more denarii/);
  const first = build(initialState(), 'domus', 0, 0);
  assert.equal(first.error, null);
  assert.equal(first.state.coins, 1080);
  assert.equal(first.state.buildings.length, 1);
  assert.ok(build(first.state, 'farm', 0, 0).error);
  for (const [x, z] of [[1, 0], [48, 0], [-32, 0], [0, 40], [NaN, 0]]) {
    assert.ok(build(first.state, 'farm', x, z).error);
  }
  assert.ok(build(first.state, 'unknown', 8, 0).error);
});

test('the campaign can finish within 90 seconds and awards its bonus only once', () => {
  let state = initialState();
  for (const [type, x] of [['domus', 0], ['domus', 8], ['baths', 16]]) {
    state = build(state, type, x, 0).state;
  }
  assert.equal(getStats(state).capacity, 440);
  assert.equal(state.happiness, 80);
  for (let second = 0; second < 79; second += 1) state = tick(state, 1);
  assert.equal(state.population, 398);
  assert.equal(state.won, false);
  const beforeVictory = state;
  const regularIncome = getStats(state).coinRate;
  state = tick(state, 1);
  assert.equal(state.population, 400);
  assert.equal(state.won, true);
  assert.equal(state.rewardClaimed, true);
  assert.equal(state.glory, 10);
  assert.ok(Math.abs(state.coins - beforeVictory.coins - regularIncome - 500) < 1e-9);
  const afterVictory = tick(state, 1);
  assert.equal(afterVictory.glory, 10);
  assert.ok(Math.abs(afterVictory.coins - state.coins - getStats(state).coinRate) < 1e-9);
  const extraBuilding = build(afterVictory, 'farm', 24, 0).state;
  assert.equal(extraBuilding.coins, afterVictory.coins - 80);
});

test('housing caps growth and food shortages recover without negative resources', () => {
  let state = initialState();
  for (let second = 0; second < 40; second += 1) state = tick(state, 1);
  assert.equal(state.population, 280);
  state = { ...state, population: 1000, food: 0.01, coins: 0 };
  for (let second = 0; second < 30; second += 1) {
    state = tick(state, 1);
    assert.ok(state.coins >= 0 && state.food >= 0 && state.happiness >= 0);
  }
  assert.equal(state.food, 0);
  assert.ok(state.happiness < 50);
  state = { ...state, coins: 1000 };
  for (const x of [0, 8, 16]) state = build(state, 'farm', x, 0).state;
  for (let second = 0; second < 30; second += 1) state = tick(state, 1);
  assert.ok(state.food > 0);
  assert.equal(state.happiness, 72);
});

test('small frame steps preserve fractional immigration and immutable state', () => {
  const original = initialState();
  let state = original;
  for (let frame = 0; frame < 120; frame += 1) state = tick(state, 1 / 60);
  assert.ok(state.population >= 243 && state.population <= 244);
  assert.equal(original.population, 240);
  assert.equal(original.coins, 1200);
  assert.deepEqual(original.buildings, []);
});

test('saving survives blocked storage and rejects corrupt or malformed state', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    } });
    assert.equal(loadGame(), null);
    const state = build(initialState(), 'baths', 0, 0).state;
    assert.equal(saveGame(state), true);
    assert.deepEqual(loadGame(), state);
    const { glory, ...olderSave } = state;
    memory.set(SAVE_KEY, JSON.stringify({ version: 1, state: olderSave }));
    assert.equal(loadGame().glory, 0);
    memory.set(SAVE_KEY, JSON.stringify({ version: 1, state: { ...olderSave, won: true, rewardClaimed: true } }));
    assert.equal(loadGame().glory, 10);
    memory.set(SAVE_KEY, '{broken JSON');
    assert.equal(loadGame(), null);
    for (const malformed of [null, {}, { ...state, coins: -1 }, { ...state, speed: 0 }, { ...state, glory: -1 },
      { ...state, population: 2.5 }, { ...state, won: true },
      { ...state, buildings: [...state.buildings, ...state.buildings] },
      { ...state, buildings: [{ id: 'x', type: 'domus', x: 5, z: 0 }] }]) {
      memory.set(SAVE_KEY, JSON.stringify({ version: 1, state: malformed }));
      assert.equal(loadGame(), null);
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled'); } });
    assert.equal(loadGame(), null);
    assert.equal(saveGame(state), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
