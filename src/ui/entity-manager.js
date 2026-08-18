/**
 * entity-manager.js - barrel re-export for character / NPC lifecycle.
 *   - entity/selection.js  : selectCharacterById / selectNPCById
 *   - entity/forms.js      : create / update from a modal form
 *   - entity/ownership.js  : claim / unclaim + token ownership sync
 *   - entity/deletion.js   : confirm + remove + orphan sweep
 *   - entity/placement.js  : drop sheet onto map, create NPC from template
 */

export { selectCharacterById, selectNPCById } from './entity/selection.js';
export {
  createCharacter, updateCharacter, createNPC, updateNPC,
} from './entity/forms.js';
export { claimCharacter, unclaimCharacter, assignNPCController, releaseNPCController } from './entity/ownership.js';
export { deleteCharacter, deleteNPC } from './entity/deletion.js';
export { placeSheetOnMap, createNPCFromTemplate } from './entity/placement.js';
