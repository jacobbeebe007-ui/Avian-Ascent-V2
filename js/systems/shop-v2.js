/* Avian Ascent — Stork Shop v2 (combat rewrite).
 *
 * Shop offer composition (per visit):
 *   - 3 healing items (from game.js SHOP_HEALING_ITEMS).
 *   - Mutation stock (Avian.mutations.rollMutationStock).
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var shop = Object.create(null);

  shop.findById = function findById(id) {
    return null;
  };

  Avian.shop = shop;
})();
