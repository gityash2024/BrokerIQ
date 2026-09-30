'use client';
import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { reportClientError } from '@/lib/report-error';
import { Button } from '@/components/ui/button';

/** Friendly fallback when a page crashes; the error is reported to Admin → Health → Errors. */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
  }, [error]);
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10">
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold">कुछ गड़बड़ हो गई</h1>
        <p className="mt-2 text-muted">यह page अभी ठीक से नहीं खुल पाया। हमारी team को अपने-आप खबर मिल गई है। दोबारा कोशिश करें।</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => retry()}>
            <RefreshCw className="size-4" /> दोबारा कोशिश करें
          </Button>
          <Button variant="secondary" href="/">
            Home पर जाएँ
          </Button>
        </div>
      </div>
    </div>
  );
}
