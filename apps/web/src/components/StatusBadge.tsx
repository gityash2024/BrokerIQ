const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  TRIAL: 'bg-blue-50 text-blue-700 border-blue-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  EXPIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  PAST_DUE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  PAUSED: 'bg-purple-50 text-purple-700 border-purple-200',
  HEALTHY: 'bg-green-50 text-green-700 border-green-200',
  WARNING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  DOWN: 'bg-red-50 text-red-700 border-red-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

const dotColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  TRIAL: 'bg-blue-500',
  SUSPENDED: 'bg-red-500',
  HEALTHY: 'bg-green-500',
  WARNING: 'bg-yellow-500',
  DOWN: 'bg-red-500',
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  const dot = dotColors[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${style}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {status}
    </span>
  );
}
