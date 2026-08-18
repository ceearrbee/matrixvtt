/**
 * gm-controls.js - NPC preset data. Consumed by the Templates sub-panel
 * of the GM sidebar tab (`src/ui/gm/panels/TemplatesPanel.jsx`).
 */

export function npcTemplates() {
  return [
    { name: 'Goblin',      cr: '1/4', hp_max: 7,  ac: 15, speed: 30, attributes: { str:8, dex:14, con:10, int:10, wis:8, cha:8  }, actions: [{ name:'Scimitar', attack_bonus:4, damage:'1d6+2', damage_type:'slashing', description:'Melee attack' }] },
    { name: 'Kobold',      cr: '1/8', hp_max: 5,  ac: 12, speed: 30, attributes: { str:7, dex:15, con:9,  int:8,  wis:7,  cha:8  }, actions: [{ name:'Dagger',   attack_bonus:4, damage:'1d4+2', damage_type:'piercing', description:'Melee attack' }] },
    { name: 'Orc',         cr: '1/2', hp_max: 15, ac: 13, speed: 30, attributes: { str:16, dex:12, con:16, int:7,  wis:11, cha:10 }, actions: [{ name:'Greataxe', attack_bonus:5, damage:'1d12+3', damage_type:'slashing', description:'Melee attack' }] },
    { name: 'Skeleton',    cr: '1/4', hp_max: 13, ac: 13, speed: 30, attributes: { str:10, dex:14, con:15, int:6,  wis:8,  cha:5  }, actions: [{ name:'Shortsword', attack_bonus:4, damage:'1d6+2', damage_type:'piercing', description:'Melee attack' }] },
    { name: 'Zombie',      cr: '1/4', hp_max: 22, ac: 8,  speed: 20, attributes: { str:13, dex:6,  con:16, int:3,  wis:6,  cha:5  }, actions: [{ name:'Slam', attack_bonus:3, damage:'1d6+1', damage_type:'bludgeoning', description:'Melee attack' }] },
    { name: 'Wolf',        cr: '1/4', hp_max: 11, ac: 13, speed: 40, attributes: { str:12, dex:15, con:12, int:3,  wis:12, cha:6  }, actions: [{ name:'Bite', attack_bonus:4, damage:'2d4+2', damage_type:'piercing', description:'Knock prone on hit (DC11 STR)' }] },
    { name: 'Bandit',      cr: '1/8', hp_max: 11, ac: 12, speed: 30, attributes: { str:11, dex:12, con:12, int:10, wis:10, cha:10 }, actions: [{ name:'Scimitar', attack_bonus:3, damage:'1d6+1', damage_type:'slashing', description:'Melee attack' }] },
    { name: 'Guard',       cr: '1/8', hp_max: 11, ac: 16, speed: 30, attributes: { str:13, dex:12, con:12, int:10, wis:11, cha:10 }, actions: [{ name:'Spear', attack_bonus:3, damage:'1d6+1', damage_type:'piercing', description:'Melee/ranged attack' }] },
    { name: 'Giant Spider', cr: '1',  hp_max: 26, ac: 14, speed: 30, attributes: { str:14, dex:16, con:12, int:2,  wis:11, cha:4  }, actions: [{ name:'Bite', attack_bonus:5, damage:'1d8+3', damage_type:'piercing', description:'+ poison (DC11 CON, 2d8)' }] },
    { name: 'Ogre',        cr: '2',   hp_max: 59, ac: 11, speed: 40, attributes: { str:19, dex:8,  con:16, int:5,  wis:7,  cha:7  }, actions: [{ name:'Greatclub', attack_bonus:6, damage:'2d8+4', damage_type:'bludgeoning', description:'Melee attack' }] },
    { name: 'Troll',       cr: '5',   hp_max: 84, ac: 15, speed: 30, attributes: { str:18, dex:13, con:20, int:7,  wis:9,  cha:7  }, actions: [{ name:'Claw', attack_bonus:7, damage:'2d6+4', damage_type:'slashing', description:'Melee attack; regenerates 10 HP/turn' }] },
    { name: 'Young Dragon', cr: '7',  hp_max: 178,ac: 18, speed: 40, attributes: { str:23, dex:10, con:21, int:14, wis:11, cha:19 }, actions: [{ name:'Bite', attack_bonus:10, damage:'2d10+6', damage_type:'piercing', description:'Melee attack' }, { name:'Fire Breath', attack_bonus:0, damage:'12d6', damage_type:'fire', description:'30ft cone, DC17 DEX halves' }] },
  ];
}
