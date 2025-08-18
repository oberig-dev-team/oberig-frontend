import React from 'react';

const API_BASE = import.meta.env.VITE_API_URL as string;

type Props = {
  amountUAH: number;                // сума в гривнях (199.00)
  productName: string;              // назва послуги
  client?: { firstName?: string; phone?: string; email?: string }; // опц.
  onSuccessRedirect?: string;       // куди перейти після Approved
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

const PayWfpWidget: React.FC<Props> = ({ amountUAH, productName, client, onSuccessRedirect = '/pay/success' }) => {
  const [loading, setLoading] = React.useState(false);

  const startPayment = async () => {
    try {
      setLoading(true);

      // 1) тягнемо підписані поля з твого бекенда
      const qs = new URLSearchParams({
        amount: amountUAH.toFixed(2),
        name: productName || 'Послуга',
      });
      const r = await fetch(`${API_BASE}/api/payments/wfp/create/?${qs.toString()}`, {
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`Create failed: ${r.status}`);
      const { fields, order_id } = await r.json();

      // 2) підключаємо віджет
      await loadWfpScript();
      // @ts-ignore
      const Wayforpay = (window as any).Wayforpay;
      const wfp = new Wayforpay();

      // 3) конвертуємо поля під формат віджета
      const payData: any = {
        // підписані сервером значення
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

      // (необов’язково) дані клієнта — показуються у формі WFP
      if (client?.firstName) payData.clientFirstName = client.firstName;
      if (client?.email)     payData.clientEmail = client.email;
      if (client?.phone)     payData.clientPhone = client.phone;

      if (order_id) sessionStorage.setItem('orderRef', order_id);

      const onApproved = () => {
        window.location.href = onSuccessRedirect;
      };
      const onDeclined = () => {
        alert('Оплату відхилено. Спробуйте іншу картку/пізніше.');
      };
      const onPending = () => {
        // очікує підтвердження 3-DS або банку
      };

      // 4) запускаємо попап-віджет
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
      disabled={loading}
      className="w-full bg-yellow-400 text-slate-800 px-8 py-3 rounded font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-60"
    >
      {loading ? 'Відкриваємо віджет…' : 'Оплатити через WayForPay'}
    </button>
  );
};

export default PayWfpWidget;
