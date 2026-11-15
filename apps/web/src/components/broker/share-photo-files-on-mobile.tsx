'use client';

import { useState } from 'react';
import { Images } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SharePhotoFilesOnMobile({ appUrl, count }: { appUrl: string; count: number }) {
  const [help, setHelp] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => {
        const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (mobile) window.location.assign(appUrl);
        setHelp(true);
      }}>
        <Images className="size-4" /> Share all photos ({count})
      </Button>
      <p className="text-xs text-muted" role={help ? 'status' : undefined}>
        {help ? 'Open this property in the BrokerIQ mobile app to share image files and choose the recipient.' :
          'Image files are shared from the BrokerIQ mobile app.'}
      </p>
    </>
  );
}
