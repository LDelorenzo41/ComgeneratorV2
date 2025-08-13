import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Gestion CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    console.log('🚀 === NOUVEAU DEPLOIEMENT AVEC DEBUG ===');
    // Configuration Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not found');
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });
    // Configuration Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Récupération des données de la requête
    const body = await req.json();
    const priceId = body.priceId;
    const userId = body.userId;
    console.log('📋 DONNÉES REÇUES:');
    console.log('   priceId:', priceId);
    console.log('   userId:', userId);
    if (!priceId || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing priceId or userId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Vérification que l'utilisateur existe
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'User not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ✅ MAPPING HARDCODÉ AVEC LE NOUVEAU PRICE ID
    const productMapping = new Map();
    // Ajout forcé des Price IDs exacts
    productMapping.set('price_1RvCvoJ3he5yh4f3AfRNYZko', {
      tokens: 200000,
      bankAccess: false,
      productType: 'professor_200k'
    });
    productMapping.set('price_1RvD4rJ3he5yh4f35QfXb1gP', {
      tokens: 200000,
      bankAccess: true,
      productType: 'professor_200k_bank'
    });
    productMapping.set('price_1RvD6mJ3he5yh4f35Y6HuHZl', {
      tokens: 400000,
      bankAccess: false,
      productType: 'principal_400k'
    });
    // ✅ NOUVEAU PRICE ID AJOUTÉ
    productMapping.set('price_1RvZD0J3he5yh4f3dP4OwHIe', {
      tokens: 400000,
      bankAccess: true,
      productType: 'principal_400k_bank'
    });
    console.log('🗺️ MAPPING COMPLET:');
    console.log('   Taille du mapping:', productMapping.size);
    console.log('   Price IDs disponibles:', Array.from(productMapping.keys()));
    console.log('   Price ID recherché:', priceId);
    console.log('   Price ID trouvé?', productMapping.has(priceId));
    const productInfo = productMapping.get(priceId);
    if (!productInfo) {
      console.error('❌ PRICE ID INTROUVABLE!');
      console.error('   Price ID reçu:', priceId);
      console.error('   Price IDs dans le mapping:', Array.from(productMapping.keys()));
      return new Response(JSON.stringify({
        error: 'Invalid price ID',
        debug: {
          receivedPriceId: priceId,
          availablePriceIds: Array.from(productMapping.keys()),
          mappingSize: productMapping.size
        }
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('✅ PRODUCT INFO TROUVÉ:', productInfo);
    // Création de la session Stripe Checkout
    console.log('🎫 Création de la session Stripe...');
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: [
        'card'
      ],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${Deno.env.get('VITE_APP_URL')}/buy-tokens/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_APP_URL')}/buy-tokens`,
      metadata: {
        userId: userId,
        tokens: productInfo.tokens.toString(),
        bankAccess: productInfo.bankAccess.toString(),
        productType: productInfo.productType
      }
    });
    console.log('✅ SESSION STRIPE CRÉÉE:', session.id);
    // Enregistrement de la transaction en base
    const { error: transactionError } = await supabase.from('transactions').insert({
      user_id: userId,
      stripe_session_id: session.id,
      amount_cents: session.amount_total || 0,
      tokens_purchased: productInfo.tokens,
      bank_access_granted: productInfo.bankAccess,
      product_type: productInfo.productType,
      status: 'pending'
    });
    if (transactionError) {
      console.error('❌ Erreur sauvegarde transaction:', transactionError);
    } else {
      console.log('✅ Transaction sauvegardée');
    }
    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
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
