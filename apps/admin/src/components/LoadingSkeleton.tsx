export function LoadingSkeleton({ className = '' }: any) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className || 'h-8 w-full'}`}></div>;
}
