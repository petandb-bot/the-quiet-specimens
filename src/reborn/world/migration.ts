import { defaultEnvironment } from '../environment/settings';
import type { WorldDocument } from './document';

// B4.2 adds optional settings to schema 1. The original geometry and placements remain data.
export function migrateWorld(world: WorldDocument): WorldDocument {
  return world.environment ? world : { ...world, environment: defaultEnvironment(world.land.seed) };
}
