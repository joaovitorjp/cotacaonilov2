import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');
    let topic = url.searchParams.get('type') || url.searchParams.get('topic');

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        paymentId = body?.data?.id ?? paymentId;
        topic = body?.type ?? topic;
      } catch {}
    }

    console.log('Webhook MP:', { topic, paymentId });

    if (topic !== 'payment' || !paymentId) {
      return new Response('ok', { headers: corsHeaders });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` },
    });
    const payment = await mpRes.json();
    console.log('Payment status:', payment.status, 'ref:', payment.external_reference);

    if (payment.status === 'approved' && payment.external_reference) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await admin.from('subscriptions').upsert({
        user_id: payment.external_reference,
        status: 'active',
        mp_payment_id: String(paymentId),
        paid_at: new Date().toISOString(),
        amount: payment.transaction_amount ?? 69.90,
      }, { onConflict: 'user_id' });
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (e: any) {
    console.error(e);
    return new Response('error', { status: 200, headers: corsHeaders });
  }
});
