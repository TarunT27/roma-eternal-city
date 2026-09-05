export const BUILDINGS = [
  { id: 'domus', name: 'Domus', cost: 120, description: 'Welcoming homes for a growing Roman city.', benefit: '+80 housing' },
  { id: 'farm', name: 'Farm', cost: 80, description: 'Fields of golden grain to feed your people.', benefit: '+5 grain / sec' },
  { id: 'market', name: 'Market', cost: 160, description: 'A lively trading place for merchants and citizens.', benefit: '+6 denarii / sec' },
  { id: 'baths', name: 'Baths', cost: 200, description: 'A place to bathe, gather, and enjoy city life.', benefit: '+8 happiness' },
  { id: 'temple', name: 'Temple', cost: 260, description: 'A marble sanctuary at the heart of the community.', benefit: '+12 happiness' },
];

export const SAVE_KEY = 'roma-eternal-city-save-v1';
const BUILDING_BY_ID = new Map(BUILDINGS.map((building) => [building.id, building]));

export function initialState() {
  return {
    coins: 1200,
    population: 240,
    food: 180,
    happiness: 72,
    elapsed: 0,
    speed: 1,
    paused: false,
    buildings: [],
    won: false,
    rewardClaimed: false,
    glory: 0,
    immigrationProgress: 0,
  };
}

export function getStats(state) {
  const counts = { domus: 0, farm: 0, market: 0, baths: 0, temple: 0 };
  for (const building of state.buildings) {
    if (building.type in counts) counts[building.type] += 1;
  }
  return {
    capacity: 280 + counts.domus * 80,
    coinRate: 5 + state.population * 0.016 + counts.market * 6,
    foodRate: 8 + counts.farm * 5 - state.population * 0.022,
    happinessTarget: Math.min(100, 72 + counts.baths * 8 + counts.temple * 12) - (state.food <= 0 ? 25 : 0),
    counts,
  };
}

function awardVictory(state) {
  const completed = state.buildings.length >= 3 && state.population >= 400 && state.happiness >= 80;
  if (!completed || state.rewardClaimed) return state;
  return { ...state, won: true, rewardClaimed: true, coins: state.coins + 500, glory: (state.glory ?? 0) + 10 };
}

export function tick(state, realSeconds) {
  if (state.paused || !Number.isFinite(realSeconds) || realSeconds <= 0) return state;
  const speed = [1, 2, 3].includes(state.speed) ? state.speed : 1;
  const seconds = Math.min(realSeconds, 1) * speed;
  const stats = getStats(state);
  const food = Math.max(0, state.food + stats.foodRate * seconds);
  const next = {
    ...state,
    coins: Math.max(0, state.coins + stats.coinRate * seconds),
    food,
    elapsed: state.elapsed + seconds,
  };

  const happinessTarget = getStats(next).happinessTarget;
  const difference = happinessTarget - state.happiness;
  next.happiness = Math.abs(difference) < 0.05
    ? happinessTarget
    : Math.max(0, Math.min(100, state.happiness + difference * (1 - Math.exp(-seconds * 0.6))));

  if (food > 0 && next.happiness >= 45 && state.population < stats.capacity) {
    const progress = (state.immigrationProgress || 0) + seconds * 2;
    const arrivals = Math.min(Math.floor(progress), stats.capacity - state.population);
    next.population = state.population + arrivals;
    next.immigrationProgress = next.population >= stats.capacity ? 0 : progress - arrivals;
  } else {
    next.immigrationProgress = 0;
  }
  return awardVictory(next);
}

function validTile(x, z) {
  return Number.isInteger(x) && Number.isInteger(z)
    && x % 8 === 0 && z % 8 === 0
    && x >= -24 && x <= 40 && z >= -32 && z <= 32;
}

export function build(state, type, x, z) {
  const definition = BUILDING_BY_ID.get(type);
  if (!definition) return { state, error: 'Choose a building from the construction menu.' };
  if (!validTile(x, z)) return { state, error: 'Choose a marked plot inside the city.' };
  if (state.buildings.some((building) => building.x === x && building.z === z)) {
    return { state, error: 'This plot already has a building.' };
  }
  if (state.coins < definition.cost) {
    return { state, error: `You need ${Math.ceil(definition.cost - state.coins)} more denarii.` };
  }
  const existingIds = new Set(state.buildings.map((building) => building.id));
  let idNumber = state.buildings.length + 1;
  while (existingIds.has(`building-${idNumber}`)) idNumber += 1;
  const boost = type === 'baths' ? 8 : type === 'temple' ? 12 : 0;
  const next = {
    ...state,
    coins: state.coins - definition.cost,
    happiness: Math.min(100, state.happiness + boost),
    buildings: [...state.buildings, { id: `building-${idNumber}`, type, x, z }],
  };
  return { state: awardVictory(next), error: null };
}

function validatedState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const key of ['coins', 'population', 'food', 'happiness', 'elapsed']) {
    if (!Number.isFinite(value[key]) || value[key] < 0) return null;
  }
  if (!Number.isInteger(value.population) || value.happiness > 100 || ![1, 2, 3].includes(value.speed)) return null;
  if (typeof value.paused !== 'boolean' || typeof value.won !== 'boolean' || typeof value.rewardClaimed !== 'boolean') return null;
  if (value.won !== value.rewardClaimed) return null;
  if (!Array.isArray(value.buildings) || value.buildings.length > 81) return null;
  const ids = new Set();
  const tiles = new Set();
  const buildings = [];
  for (const building of value.buildings) {
    if (!building || typeof building !== 'object' || typeof building.id !== 'string' || !building.id || building.id.length > 100) return null;
    if (!BUILDING_BY_ID.has(building.type) || !validTile(building.x, building.z)) return null;
    const tile = `${building.x},${building.z}`;
    if (ids.has(building.id) || tiles.has(tile)) return null;
    ids.add(building.id);
    tiles.add(tile);
    buildings.push({ id: building.id, type: building.type, x: building.x, z: building.z });
  }
  const immigrationProgress = value.immigrationProgress ?? 0;
  if (!Number.isFinite(immigrationProgress) || immigrationProgress < 0 || immigrationProgress >= 1) return null;
  const glory = value.glory ?? (value.rewardClaimed ? 10 : 0);
  if (!Number.isInteger(glory) || glory < 0) return null;
  return {
    coins: value.coins,
    population: value.population,
    food: value.food,
    happiness: value.happiness,
    elapsed: value.elapsed,
    speed: value.speed,
    paused: value.paused,
    buildings,
    won: value.won,
    rewardClaimed: value.rewardClaimed,
    glory,
    immigrationProgress,
  };
}

export function saveGame(state) {
  try {
    const cleanState = validatedState(state);
    if (!cleanState || !globalThis.localStorage) return false;
    globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: cleanState }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    if (!globalThis.localStorage) return null;
    const raw = globalThis.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1) return null;
    return validatedState(data.state);
  } catch {
    return null;
  }
}
