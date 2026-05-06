import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Sem autenticação');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('Usuário inválido');

    const origin = req.headers.get('origin') || 'https://cotacaonilov2.lovable.app';

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`,
      },
      body: JSON.stringify({
        items: [{
          title: 'Assinatura Vitalícia - Sistema de Cotações',
          quantity: 1,
          unit_price: 69.90,
          currency_id: 'BRL',
        }],
        payer: { email: user.email },
        external_reference: user.id,
        back_urls: {
          success: `${origin}/?pay=success`,
          failure: `${origin}/?pay=failure`,
          pending: `${origin}/?pay=pending`,
        },
        auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
      }),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP error:', data);
      throw new Error(data.message || 'Erro ao criar preferência');
    }

    // Salva/atualiza subscription pending
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await admin.from('subscriptions').upsert({
      user_id: user.id,
      status: 'pending',
      mp_preference_id: data.id,
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ init_point: data.init_point, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
