/* Avian Ascent — portrait emoji/HTML map.
 *
 * Legacy keys; the UI prefers `renderBirdIconHTML` sprite output but
 * falls back to `PORTRAITS[birdKey]` when no sprite is registered.
 * Mutated at runtime by sprite registration code in game.js (see the
 * `globalThis.PORTRAITS` reassignments). Therefore declared with `var`
 * (not `const`) so legacy mutation paths still work transparently.
 */
(function () {
  'use strict';
  /** @type {Object<string, string>} */
  var portraits = {
    robin: '',
    sparrow: '',
    phainopepla: '',
    crow: '',
    goose: '',
    kookaburra: '',
    toucan: '',
    peregrine: '',
    secretary: '',
    lyrebird: '',
    shoebill: '',
    harpy: '',
    flamingo: '',
    baldEagle: '',
    macaw: '',
    snowyOwl: '',
    raven: '',
    swan: '',
    hummingbird: '',
    kiwi: '',
    penguin: '',
    ostrich: '',
    seagull: '',
    magpie: '',
    blackCockatoo: '',
    emu: '',
  };
  globalThis.PORTRAITS = portraits;
})();
