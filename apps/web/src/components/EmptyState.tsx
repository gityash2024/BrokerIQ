import { Inbox } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({ message, description, icon: Icon = Inbox, action, onAction }: any) {
  return (
    <div className="text-center py-16 px-6 bg-white border border-gray-200 border-dashed rounded-lg flex flex-col items-center justify-center">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
      {description && <p className="text-gray-500 mb-6 max-w-sm">{description}</p>}
      {action && <Button onClick={onAction}>{action}</Button>}
    </div>
  );
}
