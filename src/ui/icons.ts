const shapes = {
  chamber: '<circle cx="12" cy="12" r="3"/><path d="M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx=".7"/><rect x="14" y="4" width="6" height="6" rx=".7"/><rect x="4" y="14" width="6" height="6" rx=".7"/><rect x="14" y="14" width="6" height="6" rx=".7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.3" cy="8.1" r="1.4"/><path d="m21 17-5.5-5.5-9.5 9.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.1 5.9L8 16l2.1-5.9L16 8Z"/>',
  mutate: '<path d="M5 3c0 11 14 7 14 18M19 3c0 11-14 7-14 18M5.5 6h13m-13 12h13M8.4 9h7.2m-7.2 6h7.2"/>',
  save: '<path d="M6 4h12v17l-6-3.8L6 21V4Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  edit: '<path d="m4 20 4-.8L19.1 8.1l-3.2-3.2L4.8 16 4 20ZM14.7 6.1l3.2 3.2M17 4l1-1a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-1 1"/>',
  expand: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  action: '<path d="m13 2-8 12h6l-1 8 9-12h-6l0-8Z"/>',
  volume: '<path d="M4 9v6h4l4 4V5L8 9H4Zm11.5 0a4.1 4.1 0 0 1 0 6m2.2-8.3a7.2 7.2 0 0 1 0 10.6"/>',
  mute: '<path d="M4 9v6h4l4 4V5L8 9H4Zm12 1 4 4m0-4-4 4"/>',
  play: '<path d="m8 5 12 7-12 7V5Z"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1"/>',
  upload: '<path d="M4 15v5h16v-5M12 16V4m-4 4 4-4 4 4"/>',
  download: '<path d="M4 15v5h16v-5M12 4v12m-4-4 4 4 4-4"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 .1 7M20 4v5h-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 3v6m4-6v6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  minus: '<path d="M5 12h14"/>',
};
export type Icon = keyof typeof shapes;
export function icon(name: Icon, className = ''): string {
  return `<svg class="icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]}</svg>`;
}
