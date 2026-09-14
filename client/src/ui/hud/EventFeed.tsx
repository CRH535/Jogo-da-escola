import { ArrowRight, Crosshair, Zap } from 'lucide-react';
import type { FeedEntry } from '@neon-strike/shared/hud';

export function EventFeed({ events }: { events: readonly FeedEntry[] }) {
  return <ol className="hud-feed" aria-label="Feed de eliminações" aria-live="polite" aria-relevant="additions">
    {events.map((event) => <li key={event.id} data-event-id={event.id} data-kind={event.attacker.kind}>
      {event.attacker.kind === 'environment' ? <Zap className="feed-kind" aria-hidden="true" /> : <Crosshair className="feed-kind" aria-hidden="true" />}
      <span className="feed-actor">{event.attacker.name}</span><ArrowRight aria-hidden="true" />
      <span className="sr-only">eliminou</span><span className="feed-victim">{event.victim.name}</span>
    </li>)}
  </ol>;
}
