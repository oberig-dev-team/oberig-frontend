import React from 'react';

const API_BASE = import.meta.env.VITE_API_URL as string;

type Props = {
  amountUAH: number;
  productName: string;
  client?: { firstName?: string; phone?: string; email?: string };
  onSuccessRedirect?: string;
  disabled?: boolean; // НОВОЕ
};

function loadWfpScript(): Promise<void> {
  const id = 'wfp-script';
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://secure.wayforpay.com/server/pay-widget.js';
    s.id = id;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('WayForPay script load error'));
    document.body.appendChild(s);
  });
}

const PayWfpWidget: React.FC<Props> = ({
  amountUAH,
  productName,
  client,
  onSuccessRedirect = '/pay/success',
  disabled
}) => {
  const [loading, setLoading] = React.useState(false);

  const startPayment = async () => {
    if (disabled || !Number.isFinite(amountUAH) || amountUAH <= 0) {
      alert('Вкажіть суму або оберіть послугу.');
      return;
    }

    try {
      setLoading(true);

      const qs = new URLSearchParams({
        amount: amountUAH.toFixed(2),
        name: productName || 'Послуга',
      });

      const r = await fetch(`${API_BASE}/api/payments/wfp/create/?${qs.toString()}`);
      if (!r.ok) throw new Error(`Create failed: ${r.status}`);
      const { fields, order_id } = await r.json();

      await loadWfpScript();
      // @ts-ignore
      const Wayforpay = (window as any).Wayforpay;
      const wfp = new Wayforpay();

      const payData: any = {
        merchantAccount: fields.merchantAccount,
        merchantDomainName: fields.merchantDomainName,
        merchantSignature: fields.merchantSignature,
        merchantAuthType: fields.merchantAuthType || 'SimpleSignature',
        orderReference: fields.orderReference,
        orderDate: fields.orderDate,
        amount: fields.amount,
        currency: fields.currency,
        productName: fields['productName[]'],
        productCount: fields['productCount[]'],
        productPrice: fields['productPrice[]'],
        returnUrl: fields.returnUrl,
        serviceUrl: fields.serviceUrl,
        language: fields.language || 'UA',
      };

      if (client?.firstName) payData.clientFirstName = client.firstName;
      if (client?.email)     payData.clientEmail = client.email;
      if (client?.phone)     payData.clientPhone = client.phone;

      if (order_id) sessionStorage.setItem('orderRef', order_id);

      const onApproved = () => { window.location.href = onSuccessRedirect; };
      const onDeclined = () => { alert('Оплату відхилено. Спробуйте іншу картку/пізніше.'); };
      const onPending  = () => {};

      wfp.run(payData, onApproved, onDeclined, onPending);
    } catch (e) {
      console.error(e);
      alert('Помилка під час створення платежу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={startPayment}
      disabled={!!disabled || loading}
      className="w-full bg-yellow-400 text-slate-800 px-8 py-3 rounded font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-60"
    >
      {loading ? 'Відкриваємо віджет…' : 'Оплатити через WayForPay'}
    </button>
  );
};

export default PayWfpWidget;
