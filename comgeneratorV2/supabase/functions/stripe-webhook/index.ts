import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature'
};

// Vérification manuelle de la signature Stripe via Web Crypto API
async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',').reduce((acc: Record<string, string>, part: string) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) return false;

  // Vérifier que l'événement n'est pas trop vieux (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp) > 300) return false;

  // Calculer le HMAC-SHA256
  const payload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === sig;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  }
  try {
    console.log('🔔 Webhook received!');
    // Configuration Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not found');
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });

    // Vérification de la signature Stripe
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing stripe-signature header', {
        status: 400,
        headers: corsHeaders
      });
    }
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not found');
    }
    const body = await req.text();
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error('❌ Webhook signature verification failed');
      return new Response('Webhook signature verification failed', {
        status: 400,
        headers: corsHeaders
      });
    }
    console.log('✅ Signature verified');

    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error('❌ Failed to parse JSON:', err);
      return new Response('Invalid JSON', {
        status: 400,
        headers: corsHeaders
      });
    }
    console.log('🎯 Event type:', event.type);
    // Traitement des événements
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event.data.object);
    } else {
      console.log('ℹ️ Unhandled event type:', event.type);
    }
    return new Response(JSON.stringify({
      received: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 Webhook error:', error);
    return new Response(JSON.stringify({
      error: 'Webhook handler failed'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

async function handleCheckoutSessionCompleted(session) {
  console.log('🔄 Processing checkout session:', session.id);
  try {
    // Configuration Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    // Vérifier si cette session a déjà été traitée
    console.log('🔍 Checking if session already processed:', session.id);
    const transactionCheckResponse = await fetch(`${supabaseUrl}/rest/v1/transactions?stripe_session_id=eq.${session.id}&select=status,tokens_purchased`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    });
    if (transactionCheckResponse.ok) {
      const existingTransactions = await transactionCheckResponse.json();
      const existingTransaction = existingTransactions[0];
      if (existingTransaction?.status === 'completed') {
        console.log('⚠️ Session already processed, skipping to avoid duplicate tokens');
        return;
      }
    }
    // Récupération des métadonnées
    const userId = session.metadata?.userId;
    const tokens = parseInt(session.metadata?.tokens || '0');
    const bankAccess = session.metadata?.bankAccess === 'true';
    console.log('📊 Session data:', {
      userId,
      tokens,
      bankAccess
    });
    if (!userId || !tokens) {
      throw new Error(`Missing metadata: userId=${userId}, tokens=${tokens}`);
    }
    // 1. Récupérer le profil actuel
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=tokens,has_bank_access`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    });
    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch profile: ${profileResponse.status}`);
    }
    const profiles = await profileResponse.json();
    const currentProfile = profiles[0];
    if (!currentProfile) {
      throw new Error(`Profile not found for user ${userId}`);
    }
    const newTokens = (currentProfile.tokens || 0) + tokens;
    let newBankAccess;
    if (bankAccess === true) {
      newBankAccess = true;
      console.log('🏦 Plan avec banque → Activation accès banque');
    } else {
      newBankAccess = false;
      console.log('🚫 Plan sans banque → Désactivation accès banque');
    }
    console.log(`💰 Updating tokens: ${currentProfile.tokens} + ${tokens} = ${newTokens}`);
    console.log(`🏦 Bank access: ${currentProfile.has_bank_access} → ${newBankAccess}`);
    // 2. Mettre à jour le profil
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        tokens: newTokens,
        has_bank_access: newBankAccess
      })
    });
    if (!updateResponse.ok) {
      throw new Error(`Failed to update profile: ${updateResponse.status}`);
    }
    // 3. Créer la transaction
    try {
      if (currentProfile) {
        console.log('🆕 Creating new transaction record');
        const createResponse = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            stripe_session_id: session.id,
            amount_cents: session.amount_total || 0,
            tokens_purchased: tokens,
            bank_access_granted: bankAccess,
            status: 'completed',
            created_at: new Date().toISOString()
          })
        });

        if (createResponse.ok) {
          console.log('✅ Transaction created successfully');
        } else {
          const errorText = await createResponse.text();
          console.error('❌ Failed to create transaction:', errorText);
        }
      }
    } catch (error) {
      console.error('❌ Transaction save error:', error);
    }

    console.log('✅ Payment processed successfully!');
    console.log(`   User: ${userId}`);
    console.log(`   Tokens added: ${tokens}`);
    console.log(`   New total: ${newTokens}`);
  } catch (error) {
    console.error('💥 Error processing checkout session:', error);
    throw error;
  }
}
