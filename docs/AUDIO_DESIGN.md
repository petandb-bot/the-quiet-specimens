# Audio design

Hollow Pulse uses a carrier and a decaying FM index. Thin Membrane uses a gradually exposed overtone and slow detune movement. Metallic Residue uses five slightly irregular, separately decaying partials. Soft Debris uses seeded, windowed noise through a moving resonant band-pass. The pitch vocabulary contains fractional intervals, and the scheduler permits gaps and silences.

The scheduler checks the audio clock every 35 ms and looks ahead by 140 ms. A slow biased cycle and each individual's genome govern event probability and intervals. Hover extends selected tones. Rest reduces probability. Dart, Startle, Inspect, and Display qualify for probabilistic accents with a five-second cooldown. An event must be at least 680 ms after the previous onset. The scheduler caps voices at four. Audition takes over scheduling for ten seconds and restores the previous listening state.

Each voice defines its own amplitude envelope and stereo placement. Voice sources and local nodes disconnect after the envelope. The shared graph uses a low-frequency high-pass to remove DC and a gently approached high-threshold peak guard. The master gain ramps on user changes. The app starts audio only after a user gesture. It releases outstanding notes when the document goes into the background and brings future onset scheduling back to the current audio clock on return.

The browser verification page renders all four graphs at 44.1 kHz and 48 kHz with four overlapping notes per graph. It checks RMS, absolute peak, and DC offset.
