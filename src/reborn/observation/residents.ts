import type { GardenSpecimen } from '../genome';
import type { MotionPose } from '../motion';

export function activityLabel(pose?: MotionPose) {
  if (!pose) return 'Outside the garden';
  if (pose.moment) return pose.moment;
  if (pose.social) return pose.social === 'Imitation' ? 'Copying' : pose.social;
  if (pose.phase === 'Act') return pose.gesture;
  if (pose.phase === 'Explore' && pose.intent !== 'Explore') return pose.intent;
  return { Rest: 'Resting', Recover: 'Recovering', Hesitate: 'Hesitating', Explore: 'Exploring' }[pose.phase];
}

export class ResidentBrowser {
  private rows = new Map<string, { button: HTMLButtonElement; activity: HTMLElement }>();

  constructor(private list: HTMLElement, private image: (item: GardenSpecimen) => string, private select: (item: GardenSpecimen) => void) {}

  update(items: readonly GardenSpecimen[], selected: string, pose: (id: string) => MotionPose | undefined) {
    const keys = items.map(item => item.genome.seed);
    if (keys.length !== this.rows.size || keys.some(key => !this.rows.has(key))) {
      this.rows.clear();
      this.list.replaceChildren();
      for (const item of items) {
        const button = document.createElement('button');
        const text = document.createElement('span'), name = document.createElement('strong'), details = document.createElement('small');
        const activity = document.createElement('span'), picture = document.createElement('img');
        button.type = 'button';
        button.className = 'resident-row';
        picture.alt = '';
        picture.width = 52; picture.height = 37;
        const url = this.image(item);
        if (url) picture.src = url;
        name.textContent = item.name;
        details.textContent = item.genome.plan;
        details.append(' · ', activity);
        text.append(name, details);
        button.append(picture, text);
        button.addEventListener('click', () => this.select(item));
        this.list.append(button);
        this.rows.set(item.genome.seed, { button, activity });
      }
    }
    for (const [key, row] of this.rows) {
      const label = activityLabel(pose(key));
      if (row.activity.textContent !== label) row.activity.textContent = label;
      row.button.setAttribute('aria-pressed', String(key === selected));
    }
  }
}
