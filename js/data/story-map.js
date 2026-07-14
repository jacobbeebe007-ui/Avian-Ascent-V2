/**
 * Built-in story overworld map used by Blackstone Forest and Map Forge.
 * Runs begin on the intro world (startMapId), then enter the main navigator.
 */
(function (global) {
  'use strict';

  const STORY_MAP = {
    schemaVersion: 2,
    id: 'story-blackstone',
    name: 'Blackstone Forest',
    createdAt: '2026-06-23T00:00:00.000Z',
    mapWidth: 1536,
    mapHeight: 1024,
    backgroundDataUrl: 'assets/overworld_map.png',
    pathReveal: true,
    maxStage: 20,
    startMapId: 'intro',
    worlds: {
      intro: {
        name: 'Leaving the Nest',
        worldIndex: 0,
        backgroundDataUrl: 'assets/overworld_map.png',
        nodes: [
          { id: 0, type: 'start', name: 'Nest Edge', x: 768, y: 860, stage: 0, terrain: 'Nest Periphery' },
          {
            id: 1,
            type: 'stage',
            name: 'First Flight',
            x: 768,
            y: 700,
            subStage: 1,
            terrain: 'Old Farmstead',
            portraitBird: 'sparrow',
            clearRewards: [{ type: 'shinies', min: 5, max: 12, chance: 100 }],
          },
          {
            id: 2,
            type: 'stage',
            name: 'Yard Bound',
            x: 768,
            y: 540,
            subStage: 2,
            terrain: 'Overgrown Yard',
            portraitBird: 'crow',
            clearRewards: [{ type: 'shinies', min: 8, max: 16, chance: 100 }],
          },
          {
            id: 3,
            type: 'overworld',
            name: 'Path to Blackstone',
            x: 768,
            y: 360,
          },
        ],
      },
    },
    nodes: [
      { id: 0, type: 'start', name: 'The Barn', x: 1211, y: 764, stage: 0, terrain: 'Old Farmstead' },
      { id: 1, type: 'stage', name: 'Barn Gate', x: 1086, y: 825, stage: 1, terrain: 'Overgrown Yard', portraitBird: 'sparrow' },
      { id: 2, type: 'stage', name: 'Riverside Crossing', x: 922, y: 853, stage: 2, terrain: 'River Ford', portraitBird: 'crow' },
      { id: 3, type: 'stage', name: 'Whitewater Rocks', x: 750, y: 861, stage: 3, terrain: 'River Rapids', portraitBird: 'magpie' },
      { id: 4, type: 'stage', name: 'The Crags', x: 601, y: 835, stage: 4, terrain: 'Rocky Outcrop', portraitBird: 'goose' },
      { id: 5, type: 'shop', name: 'Stork Emporium', x: 500, y: 812 },
      { id: 6, type: 'stage', name: 'Ruined Mill', x: 409, y: 791, stage: 5, terrain: 'Collapsed Mill', portraitBird: 'kookaburra' },
      { id: 7, type: 'stage', name: 'Forest Road', x: 429, y: 671, stage: 6, terrain: 'Darkwood Path', portraitBird: 'flamingo' },
      { id: 8, type: 'stage', name: 'Mossy Track', x: 578, y: 656, stage: 7, terrain: 'Ancient Trail', portraitBird: 'snowyOwl' },
      { id: 9, type: 'stage', name: 'The Stone Bridge', x: 738, y: 617, stage: 8, terrain: 'Stone Bridge', portraitBird: 'baldEagle' },
      { id: 10, type: 'stage', name: 'Far Bank', x: 924, y: 600, stage: 9, terrain: 'Bridge Crossing', portraitBird: 'raven' },
      { id: 11, type: 'boss', name: 'Forest Keep', x: 1171, y: 469, stage: 10, terrain: 'Abandoned Keep' },
      { id: 12, type: 'shop', name: 'Stork Emporium', x: 1078, y: 448 },
      { id: 13, type: 'stage', name: 'Ashwood Glen', x: 851, y: 476, stage: 11, terrain: 'Ashen Forest', portraitBird: 'cassowary' },
      { id: 14, type: 'stage', name: 'Ridgeline Path', x: 603, y: 486, stage: 12, terrain: 'Highland Ridge', portraitBird: 'swan' },
      { id: 15, type: 'stage', name: 'Dark Hollow', x: 439, y: 415, stage: 13, terrain: 'Shadow Hollow', portraitBird: 'shoebill' },
      { id: 16, type: 'shop', name: 'Stork Emporium', x: 353, y: 337 },
      { id: 17, type: 'stage', name: 'Fog Pass', x: 564, y: 361, stage: 14, terrain: 'Mountain Pass', portraitBird: 'kiwi' },
      { id: 18, type: 'stage', name: 'Cathedral Approach', x: 677, y: 319, stage: 15, terrain: 'Castle Road', portraitBird: 'hummingbird' },
      { id: 19, type: 'stage', name: 'Outer Ramparts', x: 806, y: 337, stage: 16, terrain: 'Castle Walls', portraitBird: 'harpyEagle' },
      { id: 20, type: 'stage', name: 'Inner Court', x: 782, y: 265, stage: 17, terrain: 'Outer Courtyard', portraitBird: 'raven' },
      { id: 21, type: 'stage', name: 'High Spire', x: 701, y: 233, stage: 18, terrain: 'Castle Spire', portraitBird: 'snowyOwl' },
      { id: 22, type: 'stage', name: 'Throne Gate', x: 766, y: 184, stage: 19, terrain: 'Throne Approach', portraitBird: 'baldEagle' },
      { id: 23, type: 'boss', name: "Blakiston's Court", x: 792, y: 82, stage: 20, terrain: 'Castle Throne', final: true },
    ],
  };

  function cloneStoryMap(map) {
    return JSON.parse(JSON.stringify(map));
  }

  global.AVIAN_STORY_MAP_DEFAULT = STORY_MAP;
  global.cloneStoryMap = cloneStoryMap;
  global.cloneDefaultStoryMap = function () {
    return cloneStoryMap(STORY_MAP);
  };
})(typeof window !== 'undefined' ? window : globalThis);
