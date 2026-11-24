import { freshSeed, hashText, random } from '../../core/random';
import type { Finish, WorldObject } from '../world/document';

export const finishColors: Record<Exclude<Finish, 'Original'>, string> = {
  Chalk: '#dfd9c5', Oxide: '#b34b2c', Mineral: '#313646', Jade: '#48716a',
};

const original = ['#ad5b40', '#506e86', '#c1a15c', '#485b51', '#d4c9af'] as const;
const palettes = [
  ['#ad5b40', '#495c70', '#ddab6b', '#52645c', '#e1ceb1'],
  ['#4c7a86', '#587064', '#d59d63', '#486273', '#d1dfd2'],
  ['#a78849', '#705b46', '#b96d59', '#687368', '#ebd1a3'],
  ['#5d7964', '#596d7f', '#c29b69', '#3f5e57', '#d0d8bb'],
  ['#78658d', '#525d7a', '#c89176', '#555363', '#ded0de'],
  ['#526076', '#686a70', '#c2a277', '#445564', '#d2d9d9'],
] as const;

export function artifactColors(object: WorldObject) {
  const modern = object.appearance === 2;
  const colors: string[] = [...(modern ? palettes[hashText('artifact/color/2/' + object.seed) % palettes.length] : original)];
  const identity = modern ? 0 : object.distant ? 3 : object.kind === 'arch' ? 0 : object.kind === 'ring' ? 1 : legacyIdentity(object);
  if (object.finish !== 'Original') colors.fill(finishColors[object.finish], 0, 4);
  return { colors, identity };
}

function legacyIdentity(object: WorldObject) {
  return (object.sourceForm ?? Math.floor(random('artifact/1/' + object.seed).range(0, 20))) % 4;
}

export function primaryColor(object: WorldObject) {
  const { colors, identity } = artifactColors(object);
  return colors[identity];
}

export function rollAppearance(object: WorldObject, prefix = freshSeed()) {
  const color = primaryColor(object);
  const roll = { appearance: 2 as const, finish: 'Original' as const, seed: prefix };
  for (let attempt = 1; primaryColor({ ...object, ...roll }) === color; attempt++) {
    roll.seed = prefix + '-' + attempt;
  }
  return roll;
}
