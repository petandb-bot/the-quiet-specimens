import * as T from 'three';
import { clamp } from '../core/random';
import { photoByteLimit } from './world/image-settings';

export { defaultImage } from './world/image-settings';
export type { ImageSettings } from './world/image-settings';
import type { ImageSettings } from './world/image-settings';

export function imageFrame(viewAspect: number, imageAspect: number, s: ImageSettings) {
  const ratio = viewAspect / imageAspect;
  const x = Math.min(1, ratio) / Math.max(1, s.scale);
  const y = Math.min(1, 1 / ratio) / Math.max(1, s.scale);
  return {
    x, y,
    offsetX: clamp((1 - x) * (.5 + clamp(s.x, -1, 1) * .5), 0, 1 - x),
    offsetY: clamp((1 - y) * (clamp(s.horizon) + clamp(s.y, -1, 1) * .5), 0, 1 - y),
  };
}

export class PhotoEnvironment {
  readonly tint = new T.Color();
  private pixels?: T.CanvasTexture;
  private imageAspect = 1;
  private request = 0;
  private uniforms = {
    photo: { value: null as T.Texture | null },
    crop: { value: new T.Vector4(1, 1, 0, 0) },
    blur: { value: new T.Vector2() },
  };
  private mesh = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: this.uniforms,
    vertexShader: `
      varying vec2 imageUv;
      void main() {
        imageUv = uv;
        gl_Position = vec4(position.xy, 0.999, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 imageUv;
      uniform sampler2D photo;
      uniform vec4 crop;
      uniform vec2 blur;
      void main() {
        vec2 uv = imageUv * crop.xy + crop.zw;
        vec3 color = texture2D(photo, uv).rgb * 0.28;
        color += texture2D(photo, uv + vec2(blur.x, 0.0)).rgb * 0.12;
        color += texture2D(photo, uv - vec2(blur.x, 0.0)).rgb * 0.12;
        color += texture2D(photo, uv + vec2(0.0, blur.y)).rgb * 0.12;
        color += texture2D(photo, uv - vec2(0.0, blur.y)).rgb * 0.12;
        color += texture2D(photo, uv + blur).rgb * 0.06;
        color += texture2D(photo, uv - blur).rgb * 0.06;
        color += texture2D(photo, uv + vec2(blur.x, -blur.y)).rgb * 0.06;
        color += texture2D(photo, uv + vec2(-blur.x, blur.y)).rgb * 0.06;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));

  constructor(scene: T.Scene) {
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  get loaded() { return Boolean(this.pixels); }

  apply(aspect: number, settings: ImageSettings, observe: boolean) {
    this.mesh.visible = observe && this.loaded && settings.mode === 'Backdrop';
    const frame = imageFrame(aspect, this.imageAspect, settings);
    this.uniforms.crop.value.set(frame.x, frame.y, frame.offsetX, frame.offsetY);
    this.uniforms.blur.value.set(.034 * settings.blur / this.imageAspect, .034 * settings.blur);
  }

  async load(file: Blob) {
    if (file.size > photoByteLimit) throw new Error('Choose an image smaller than 20 MB.');
    if (file.type === 'image/svg+xml') throw new Error('Choose a raster photo such as JPEG, PNG or WebP.');
    const request = ++this.request;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      try { await image.decode(); } catch {
        if (request !== this.request) return false;
        throw new Error('This image could not be decoded.');
      }
      if (request !== this.request) return false;
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000) {
        throw new Error('Choose a photo smaller than 60 megapixels.');
      }
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image canvas unavailable.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixelY = Math.floor(canvas.height * .62);
      const pixels = context.getImageData(0, pixelY, canvas.width, Math.max(1, Math.floor(canvas.height * .20))).data;
      let red = 0, green = 0, blue = 0, count = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        red += pixels[i]; green += pixels[i + 1]; blue += pixels[i + 2]; count++;
      }
      this.tint.setRGB(red / count / 255, green / count / 255, blue / count / 255, T.SRGBColorSpace);
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      this.pixels?.dispose();
      this.pixels = texture;
      this.uniforms.photo.value = texture;
      this.imageAspect = canvas.width / canvas.height;
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  clear() {
    this.request++;
    this.mesh.visible = false;
    this.pixels?.dispose();
    this.pixels = undefined;
    this.uniforms.photo.value = null;
  }
}
