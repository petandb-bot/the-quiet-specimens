import { expect, it, vi } from 'vitest';
import { Mesh, Scene, ShaderMaterial, Texture } from 'three';
import { defaultImage, PhotoEnvironment } from '../src/reborn/photo';

it('loads photo resources locally, frees replacements, and ignores a decode cleared in flight', async () => {
  let finish = () => {};
  let next = 1;
  class LocalImage {
    src = '';
    naturalWidth = 440;
    naturalHeight = 240;
    decode() {
      expect(this.src).toMatch(/^blob:/);
      return new Promise<void>(resolve => { finish = resolve; });
    }
  }
  const createObjectURL = vi.fn(() => 'blob:photo-' + next++);
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('Image', LocalImage);
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray([100, 60, 20, 255]) }),
      }),
    }),
  });
  try {
    const scene = new Scene();
    const photo = new PhotoEnvironment(scene);
    const file = { size: 100, type: 'image/png' } as File;
    const mesh = scene.children[0] as Mesh;
    const material = mesh.material as ShaderMaterial;
    const first = photo.load(file);
    finish();
    await expect(first).resolves.toBe(true);
    const original = material.uniforms.photo.value as Texture;
    const disposeOriginal = vi.fn();
    original.addEventListener('dispose', disposeOriginal);
    photo.apply(16 / 9, defaultImage, true);
    expect(mesh.visible).toBe(true);
    photo.apply(16 / 9, { ...defaultImage, mode: 'Atmosphere' }, true);
    expect(mesh.visible).toBe(false);
    expect(photo.loaded).toBe(true);

    const second = photo.load(file);
    finish();
    await expect(second).resolves.toBe(true);
    expect(disposeOriginal).toHaveBeenCalledOnce();
    const replacement = material.uniforms.photo.value as Texture;
    const disposeReplacement = vi.fn();
    replacement.addEventListener('dispose', disposeReplacement);

    const pending = photo.load(file);
    photo.clear();
    finish();
    await expect(pending).resolves.toBe(false);
    expect(photo.loaded).toBe(false);
    expect(material.uniforms.photo.value).toBeNull();
    expect(disposeReplacement).toHaveBeenCalledOnce();
    expect(revokeObjectURL.mock.calls).toEqual([['blob:photo-1'], ['blob:photo-2'], ['blob:photo-3']]);

    await expect(photo.load({ size: 30 * 1024 * 1024, type: 'image/jpeg' } as File)).rejects.toThrow('20 MB');
    await expect(photo.load({ size: 100, type: 'image/svg+xml' } as File)).rejects.toThrow('raster photo');
    expect(createObjectURL).toHaveBeenCalledTimes(3);
  } finally {
    vi.unstubAllGlobals();
  }
});
