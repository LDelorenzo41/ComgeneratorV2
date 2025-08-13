import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature'
};
Deno.serve(async (req)=>{
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
    // Récupération du body
    const body = await req.text();
    console.log('📝 Body received:', body.substring(0, 200) + '...');
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
      error: 'Webhook handler failed',
      details: error.message
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
    // ✅ AJOUT : Vérifier si cette session a déjà été traitée
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
        console.log(`   Already added: ${existingTransaction.tokens_purchased} tokens`);
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
    // ✅ CORRECTION MAJEURE : Logique has_bank_access corrigée
    let newBankAccess;
    if (bankAccess === true) {
      // Plan AVEC banque → Activer l'accès
      newBankAccess = true;
      console.log('🏦 Plan avec banque → Activation accès banque');
    } else {
      // Plan SANS banque → Désactiver l'accès (même si l'utilisateur l'avait avant)
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
    // 3. ✅ CORRECTION : Créer la transaction avec vérification user_id
    try {
      // Vérifier si l'user_id existe dans profiles (on a déjà currentProfile)
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
          console.error(`   User ID used: ${userId}`);
          console.error('   But tokens were added successfully to profile');
        }
      } else {
        console.error(`❌ User ${userId} not found in profiles table`);
      }
    } catch (error) {
      console.error('❌ Transaction save error:', error);
      console.error('   But tokens were added successfully to profile');
    }

    console.log('✅ Payment processed successfully!');
    console.log(`   User: ${userId}`);
    console.log(`   Tokens added: ${tokens}`);
    console.log(`   New total: ${newTokens}`);
    console.log(`   Bank access: ${currentProfile.has_bank_access} → ${newBankAccess}`);
    console.log(`   Plan type: ${bankAccess ? 'AVEC banque' : 'SANS banque'}`);
  } catch (error) {
    console.error('💥 Error processing checkout session:', error);
    throw error;
  }
}