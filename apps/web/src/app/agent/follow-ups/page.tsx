'use client';

import React, { useState } from 'react';
import {
  CalendarCheck,
  Search,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
} from 'lucide-react';

interface FollowUpItem {
  id: string;
  clientName: string;
  phone: string;
  property: string;
  type: 'CALL' | 'SITE_VISIT' | 'WHATSAPP';
  dueDate: string;
  isOverdue: boolean;
  notes: string;
  completed: boolean;
}

const INITIAL_FOLLOW_UPS: FollowUpItem[] = [
  {
    id: 'fup-1',
    clientName: 'Rohit Agrawal',
    phone: '+91 98111 55667',
    property: 'SS Omnia - Shop G80',
    type: 'SITE_VISIT',
    dueDate: 'Today, 11:00 AM',
    isOverdue: false,
    notes: 'Walkthrough of ground floor retail shop. Client arriving by car from Cyber City.',
    completed: false,
  },
  {
    id: 'fup-2',
    clientName: 'Kavita Chawla',
    phone: '+91 98333 77889',
    property: 'Signature Signum-88A SCO',
    type: 'CALL',
    dueDate: 'Today, 04:00 PM',
    isOverdue: false,
    notes: 'Discuss F&B license permissions and roof rights on the SCO plot.',
    completed: false,
  },
  {
    id: 'fup-3',
    clientName: 'Gaurav Kapoor',
    phone: '+91 98114 56789',
    property: 'Sapphire Ninety - SF-12',
    type: 'SITE_VISIT',
    dueDate: 'Yesterday, 05:00 PM',
    isOverdue: true,
    notes: 'Reschedule missed inspection of bank-rented commercial unit.',
    completed: false,
  },
  {
    id: 'fup-4',
    clientName: 'Sameer Bansal',
    phone: '+91 98222 66778',
    property: 'SS Highpoint - Shop No-52',
    type: 'WHATSAPP',
    dueDate: 'Today, 02:30 PM',
    isOverdue: false,
    notes: 'Send scan copy of Vishal Mega Mart 9-year pre-lease deed.',
    completed: false,
  },
];

export default function AgentFollowUpsPage() {
  const [items, setItems] = useState<FollowUpItem[]>(INITIAL_FOLLOW_UPS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const markCompleted = (id: string, name: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, completed: true } : i))
    );
    showToast(`✅ Follow-up with ${name} marked completed!`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-teal-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <CalendarCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Client Follow-up Schedule</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Scheduled phone calls, property site visits, and WhatsApp updates with direct 1-tap triggers.
            </p>
          </div>
        </div>
      </div>

      {/* Follow-up Cards */}
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`p-5 rounded-2xl bg-gray-900/90 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl ${
              item.completed
                ? 'border-gray-800 opacity-50'
                : item.isOverdue
                ? 'border-red-500/40 bg-red-950/10'
                : 'border-gray-800 hover:border-teal-500/40'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                  item.isOverdue
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-teal-500/10 border border-teal-500/30 text-teal-400'
                }`}
              >
                {item.isOverdue ? <AlertTriangle size={18} /> : <Clock size={18} />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{item.clientName}</span>
                  <span className="text-[10px] font-semibold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                    {item.type}
                  </span>
                  {item.isOverdue && (
                    <span className="text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                      OVERDUE
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-300 font-medium mt-1">{item.property}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xl">{item.notes}</p>
                <p className="text-[11px] text-gray-500 font-mono mt-1">Due: {item.dueDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
              <a
                href={`tel:${item.phone}`}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-teal-600 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Phone size={13} />
                <span>Call</span>
              </a>

              <a
                href={`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello ${item.clientName}, following up regarding ${item.property}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <MessageSquare size={13} />
                <span>WhatsApp</span>
              </a>

              {!item.completed && (
                <button
                  type="button"
                  onClick={() => markCompleted(item.id, item.clientName)}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  <CheckCircle2 size={13} />
                  <span>Done</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
