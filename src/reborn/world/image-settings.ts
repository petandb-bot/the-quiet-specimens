export interface ImageSettings {
  mode: 'Backdrop' | 'Atmosphere';
  scale: number; x: number; y: number; horizon: number; blur: number; color: number; ground: number;
}
export const defaultImage: ImageSettings = {
  mode: 'Backdrop', scale: 1, x: 0, y: 0, horizon: .5, blur: .09, color: .52, ground: .73,
};
