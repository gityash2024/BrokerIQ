'use client';
import { api } from './api';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function load(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Razorpay load नहीं हुआ'));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout for an order created by the API and verifies the signature server-side. */
export async function payWithRazorpay(order: { keyId: string; orderId: string; amount: number; currency: string; name: string; description: string; prefill?: any }): Promise<boolean> {
  await load();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: '#4f46e5' },
      handler: async (r: any) => {
        try {
          await api('/billing/verify', { method: 'POST', body: r });
          resolve(true);
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve(false) },
    });
    rzp.open();
  });
}
