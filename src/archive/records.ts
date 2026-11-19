import {
  actions, discoveryOptions, engines, fishForms, materials, origins, patterns, plans, schemaVersion,
} from '../core/model';
import type { Genome, Specimen } from '../core/model';
import { behaviorBounds, morphBounds, normalizeGenome, soundBounds } from '../genesis/genome';

type UnknownRecord = Record<string, unknown>;
const isObject = (input: unknown): input is UnknownRecord =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
const oneOf = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value);
const string = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const numbers = (value: UnknownRecord, keys: string[]) =>
  keys.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
const error = () => new Error('This file does not contain a valid specimen genome.');

export function validateGenome(input: unknown): Genome {
  if (!isObject(input)) throw error();
  if (input.schemaVersion !== schemaVersion) throw new Error('This genome version is unsupported.');
  const { morphology: m, behavior: b, sound: s } = input;
  if (!isObject(m) || !isObject(b) || !isObject(s)) throw error();
  const valid = string(input.seed, 64) && string(input.generatorVersion, 32) && oneOf(input.origin, origins)
    && typeof input.generation === 'number' && Number.isSafeInteger(input.generation) && input.generation >= 1 && input.generation <= 1_000_000
    && Array.isArray(input.lineage) && input.lineage.length <= 2 && input.lineage.every(value => string(value, 64))
    && (input.choices === undefined || (Array.isArray(input.choices) && input.choices.length === 3
      && input.choices.every((choice, i) => oneOf(choice, discoveryOptions[i]))))
    && (m.formSeed === undefined || string(m.formSeed, 64))
    && (m.fishForm === undefined || (m.plan === 'FISH' && oneOf(m.fishForm, fishForms)))
    && oneOf(m.plan, plans) && oneOf(m.material, materials) && oneOf(m.accentMaterial, materials) && oneOf(m.pattern, patterns)
    && typeof m.anomalous === 'boolean' && Array.isArray(m.palette) && m.palette.length === 3
    && m.palette.every(c => typeof c === 'string' && /^#[a-f0-9]{6}$/i.test(c))
    && numbers(m, Object.keys(morphBounds)) && numbers(b, Object.keys(behaviorBounds)) && oneOf(b.preferred, actions)
    && numbers(s, Object.keys(soundBounds)) && oneOf(s.engine, engines) && Array.isArray(s.pitches)
    && s.pitches.length >= 1 && s.pitches.length <= 12 && s.pitches.every(x => typeof x === 'number' && Number.isFinite(x));
  if (!valid) throw error();
  const genome = input as unknown as Genome;
  return normalizeGenome({ ...genome, morphology: { ...genome.morphology, formSeed: genome.morphology.formSeed ?? genome.seed } });
}

function migrate(input: unknown): unknown {
  if (!isObject(input)) throw error();
  if (input.format === 'quiet-specimen') {
    if (input.version !== 1) throw new Error('This specimen file version is unsupported.');
    return input.specimen;
  }
  // Original unwrapped specimen records share the same genome schema.
  return input;
}

export function validateRecord(raw: unknown): Specimen {
  const input = migrate(raw);
  if (!isObject(input)) throw error();
  const { id, name, discoveredAt, user } = input;
  if (!string(id, 64) || !/^QS-[a-z0-9-]+$/i.test(id) || !string(name, 64)
    || !string(discoveredAt, 40) || !Number.isFinite(Date.parse(discoveredAt))) throw error();
  const metadata = isObject(user) ? user : {};
  const thumbnail = metadata.thumbnail;
  return {
    id, name: name.trim(), discoveredAt, genome: validateGenome(input.genome),
    user: {
      favorite: metadata.favorite === true,
      thumbnail: typeof thumbnail === 'string' && thumbnail.length < 350_000
        && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(thumbnail) ? thumbnail : undefined,
    },
  };
}

export function serialize(record: Specimen) {
  return JSON.stringify({ format: 'quiet-specimen', version: 1, specimen: record }, null, 2);
}

export function deserialize(source: string) {
  if (source.length > 450_000) throw new Error('The specimen file is too large.');
  let raw: unknown;
  try { raw = JSON.parse(source); }
  catch { throw new Error('This file is not valid JSON.'); }
  return validateRecord(raw);
}
