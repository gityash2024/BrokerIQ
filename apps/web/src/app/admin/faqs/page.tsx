'use client';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';

export default function Page() {
  return (
    <AdminCrud
      title="FAQs"
      subtitle="Help page, broker landing और app में दिखते हैं (category से group होते हैं)"
      endpoint="/admin/faqs"
      searchKeys={['question', 'category']}
      itemTitle={(i) => i?.question}
      defaults={{ category: 'general', sortOrder: 0, isActive: true }}
      columns={[
        { key: 'question', label: 'Question', render: (r) => <span className="font-medium">{r.question}</span> },
        { key: 'category', label: 'Category', render: (r) => <Badge>{r.category}</Badge> },
        { key: 'sortOrder', label: 'Order' },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? '✅' : '—') },
      ]}
      fields={[
        { key: 'question', label: 'Question', required: true, wide: true },
        { key: 'answer', label: 'Answer', type: 'textarea', required: true },
        { key: 'category', label: 'Category', type: 'select', options: ['general', 'buyers', 'owners', 'brokers', 'payments', 'app'].map((v) => ({ value: v, label: v })) },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
      ]}
      toBody={({ question, answer, category, sortOrder, isActive }) => ({ question, answer, category: category || 'general', sortOrder: sortOrder ?? 0, isActive: !!isActive })}
    />
  );
}
