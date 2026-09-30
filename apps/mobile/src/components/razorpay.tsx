import { Modal, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { IconBtn, Txt } from '@/ui';

export interface RzpOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: Record<string, string>;
}

/** Razorpay Standard Checkout inside a WebView; the signature is verified by the API. */
export function RazorpayCheckout({ order, onClose, onPaid }: { order: RzpOrder | null; onClose: () => void; onPaid: () => void }) {
  const { c } = useTheme();
  if (!order) return null;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="background:#1E1B4B"><script>
var o=${JSON.stringify({ key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: order.name, description: order.description, prefill: order.prefill ?? {}, theme: { color: '#4F46E5' } })};
o.handler=function(r){window.ReactNativeWebView.postMessage(JSON.stringify({ok:true,r:r}))};
o.modal={ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({ok:false}))}};
var rzp=new Razorpay(o);
rzp.on('payment.failed',function(e){window.ReactNativeWebView.postMessage(JSON.stringify({ok:false,error:e.error&&e.error.description}))});
rzp.open();
</script></body></html>`;
  const onMessage = async (raw: string) => {
    const d = JSON.parse(raw);
    if (!d.ok) {
      if (d.error) showError(new Error(d.error));
      return onClose();
    }
    try {
      await post('/billing/verify', d.r);
      onPaid();
    } catch (e) {
      showError(e);
    } finally {
      onClose();
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1E1B4B' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
          <Txt v="bodyStrong" color="white">
            Secure payment · Razorpay
          </Txt>
          <IconBtn onPress={onClose}>
            <X size={22} color="#fff" />
          </IconBtn>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={(e) => onMessage(e.nativeEvent.data)}
          style={{ flex: 1, backgroundColor: c.bg }}
          javaScriptEnabled
        />
      </SafeAreaView>
    </Modal>
  );
}
