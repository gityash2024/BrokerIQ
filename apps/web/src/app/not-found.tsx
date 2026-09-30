import { SiteHeader } from '@/components/site/header';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <div className="container-x grid min-h-[70vh] place-items-center text-center">
        <div>
          <p className="font-display text-8xl font-extrabold text-gradient">404</p>
          <h1 className="mt-4 font-display text-2xl font-bold">यह page नहीं मिला</h1>
          <p className="mt-2 text-muted">हो सकता है property sold हो गई हो या link बदल गया हो।</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button href="/">Home</Button>
            <Button href="/rent" variant="secondary">
              Properties खोजें
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
