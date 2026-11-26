const attempts: readonly WebGLContextAttributes[] = [
  { alpha: false, antialias: true, powerPreference: 'high-performance' },
  { alpha: false, antialias: true },
  { alpha: false, antialias: false },
];

export function openWebGL2(factory = () => document.createElement('canvas')) {
  for (const options of attempts) {
    const canvas = factory();
    try {
      const context = canvas.getContext('webgl2', options);
      if (context) return { canvas, context, antialias: options.antialias };
    } catch {
      // A browser can throw during context negotiation.
    }
  }
  throw new Error('WebGL 2 could not start. Enable graphics acceleration in your browser or try another browser.');
}
