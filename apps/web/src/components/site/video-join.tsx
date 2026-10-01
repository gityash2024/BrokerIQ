import { Video } from 'lucide-react';
import { Button } from '../ui/button';

/** "Video call join करें" for VIDEO site visits (free Jitsi Meet room — opens in the browser or the Jitsi app). */
export function VideoJoin({ visit, size = 'sm' }: { visit: { mode?: string; meetingUrl?: string | null }; size?: 'xs' | 'sm' }) {
  if (visit.mode !== 'VIDEO' || !visit.meetingUrl) return null;
  return (
    <Button size={size} variant="primary" href={visit.meetingUrl} external>
      <Video className="size-4" /> Video call join करें
    </Button>
  );
}
