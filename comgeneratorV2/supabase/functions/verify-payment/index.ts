import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    console.log('🔍 Verify payment request received')

    // Configuration Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not found')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    })

    // Configuration Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    // Récupération des données
    const { sessionId, userId } = await req.json()

    if (!sessionId || !userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Session ID et User ID requis' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🔍 Verifying session ${sessionId} for user ${userId}`)

    // 1. Vérifier la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Paiement non confirmé' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Vérifier que la session appartient bien à cet utilisateur
    if (session.metadata?.userId !== userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Session non autorisée pour cet utilisateur' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Vérifier si cette session a déjà été traitée
    const transactionResponse = await fetch(`${supabaseUrl}/rest/v1/transactions?stripe_session_id=eq.${sessionId}&select=status,tokens_purchased`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    const transactions = await transactionResponse.json()
    const transaction = transactions[0]

    if (transaction?.status === 'completed') {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Tokens déjà ajoutés pour cette session',
        tokensAdded: transaction.tokens_purchased,
        alreadyProcessed: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Récupérer les métadonnées du paiement
    const tokens = parseInt(session.metadata?.tokens || '0')
    const bankAccess = session.metadata?.bankAccess === 'true'

    if (!tokens) {
      throw new Error('Métadonnées de tokens manquantes')
    }

    console.log(`💰 Processing payment: ${tokens} tokens, bank access: ${bankAccess}`)

    // 4. Récupérer le profil actuel
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=tokens,has_bank_access`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch profile: ${profileResponse.status}`)
    }

    const profiles = await profileResponse.json()
    const currentProfile = profiles[0]

    if (!currentProfile) {
      throw new Error(`Profile not found for user ${userId}`)
    }

    const newTokens = (currentProfile.tokens || 0) + tokens
    // Si l'achat inclut l'accès banque, on l'active, sinon on garde l'état actuel
    const newBankAccess = bankAccess ? true : currentProfile.has_bank_access

    console.log(`📊 Updating: ${currentProfile.tokens} + ${tokens} = ${newTokens}, bank: ${newBankAccess}`)

    // 5. Mettre à jour le profil utilisateur
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
    })

    if (!updateResponse.ok) {
      throw new Error(`Failed to update profile: ${updateResponse.status}`)
    }

    console.log('✅ Payment verification completed successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'Paiement vérifié et tokens ajoutés',
      tokensAdded: tokens,
      newTotal: newTokens,
      bankAccess: newBankAccess
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Verify payment error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Erreur lors de la vérification du paiement',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})