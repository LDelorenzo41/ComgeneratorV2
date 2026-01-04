// supabase/functions/send-newsletter/index.ts
// Edge Function pour l'envoi de newsletters via Resend
// Accessible uniquement aux administrateurs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { Resend } from 'https://esm.sh/resend@2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface NewsletterRequest {
  subject: string;
  html: string;
  audienceType: 'ALL' | 'LOW_TOKENS' | 'HIGH_TOKENS';
  tokenThreshold?: number;
  mode: 'test' | 'real';
}

interface Recipient {
  user_id: string;
  email: string;
}

// Footer de désabonnement à ajouter automatiquement
const getUnsubscribeFooter = (userId: string, baseUrl: string) => `
<hr style="margin-top: 40px; border: none; border-top: 1px solid #e5e7eb;">
<p style="font-size: 12px; color: #777; margin-top: 20px; text-align: center;">
  Vous recevez cet email car vous utilisez ProfAssist et avez accepté de recevoir des informations.
  <br><br>
  <a href="${baseUrl}/unsubscribe?token=${userId}" style="color: #3b82f6; text-decoration: underline;">
    Se désabonner de la newsletter
  </a>
</p>
`;

// Fonction utilitaire pour attendre
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction d'envoi avec retry et backoff exponentiel
async function sendEmailWithRetry(
  resend: Resend,
  from: string,
  to: string,
  subject: string,
  html: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  let lastError: string = '';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { error: sendError } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (sendError) {
        // Si c'est une erreur de rate limit, on retry avec backoff
        if (sendError.statusCode === 429 || sendError.name === 'rate_limit_exceeded') {
          const waitTime = Math.pow(2, attempt + 1) * 500; // 1s, 2s, 4s
          console.log(`⏳ Rate limit hit for ${to}, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          await sleep(waitTime);
          lastError = sendError.message;
          continue;
        }
        // Autre erreur, on ne retry pas
        return { success: false, error: sendError.message };
      }

      return { success: true };
    } catch (err: any) {
      lastError = err.message;
      // En cas d'erreur réseau, on retry
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 500;
        console.log(`⏳ Error for ${to}, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await sleep(waitTime);
      }
    }
  }

  return { success: false, error: lastError };
}

Deno.serve(async (req: Request) => {
  // Gestion CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const appUrl = 'https://profassist.net';


    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Créer le client Supabase avec service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Récupérer le token JWT de l'utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier l'utilisateur via le token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier si l'utilisateur est admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    // Vérifier aussi via ADMIN_EMAILS (fallback)
    const adminEmails = Deno.env.get('ADMIN_EMAILS')?.split(',').map(e => e.trim()) || [];
    const isAdminByEmail = user.email && adminEmails.includes(user.email);
    const isAdminByProfile = profile?.is_admin === true;

    if (!isAdminByProfile && !isAdminByEmail) {
      console.log(`Access denied for user ${user.email}`);
      return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parser la requête
    const body: NewsletterRequest = await req.json();
    const { subject, html, audienceType, tokenThreshold, mode } = body;

    // Validation
    if (!subject || !html || !audienceType || !mode) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((audienceType === 'LOW_TOKENS' || audienceType === 'HIGH_TOKENS') && tokenThreshold === undefined) {
      return new Response(JSON.stringify({ error: 'Seuil de tokens requis pour ce type d\'audience' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📧 Newsletter request from ${user.email}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   Audience: ${audienceType}`);
    console.log(`   Threshold: ${tokenThreshold}`);

    let recipients: Recipient[] = [];

    if (mode === 'test') {
      // Mode test: envoyer uniquement à l'admin
      recipients = [{ user_id: user.id, email: user.email! }];
      console.log(`📧 Test mode: sending to ${user.email}`);
    } else {
      // Mode réel: construire la requête selon l'audience
      let query = supabase
        .from('profiles')
        .select('user_id')
        .eq('newsletter_subscription', true);

      if (audienceType === 'LOW_TOKENS' && tokenThreshold !== undefined) {
        query = query.lt('tokens', tokenThreshold);
      } else if (audienceType === 'HIGH_TOKENS' && tokenThreshold !== undefined) {
        query = query.gt('tokens', tokenThreshold);
      }
      // audienceType === 'ALL' : pas de filtre supplémentaire

      const { data: profilesData, error: queryError } = await query;

      if (queryError) {
        console.error('Query error:', queryError);
        throw new Error('Erreur lors de la récupération des destinataires');
      }

      // Récupérer les emails depuis auth.users
      if (profilesData && profilesData.length > 0) {
        const userIds = profilesData.map(p => p.user_id);
        
        // Utiliser l'API admin pour récupérer les emails
        for (const userId of userIds) {
          const { data: userData, error: userDataError } = await supabase.auth.admin.getUserById(userId);
          if (!userDataError && userData.user?.email) {
            recipients.push({
              user_id: userId,
              email: userData.user.email,
            });
          }
        }
      }

      console.log(`📧 Real mode: ${recipients.length} recipients`);
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Aucun destinataire correspondant aux critères',
        recipientCount: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Envoyer les emails via Resend avec rate limiting respecté
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const fromEmail = 'ProfAssist <contact-profassist@teachtech.fr>';

    console.log(`📧 Starting to send ${recipients.length} emails (with 550ms delay between each)...`);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Construire le HTML avec le footer de désabonnement
        const finalHtml = html + getUnsubscribeFooter(recipient.user_id, appUrl);

        // Envoyer avec retry automatique en cas de rate limit
        const result = await sendEmailWithRetry(
          resend,
          fromEmail,
          recipient.email,
          subject,
          finalHtml,
          3 // max 3 tentatives
        );

        if (result.success) {
          successCount++;
          console.log(`✅ [${i + 1}/${recipients.length}] Sent to ${recipient.email}`);
        } else {
          errorCount++;
          errors.push(`${recipient.email}: ${result.error}`);
          console.error(`❌ [${i + 1}/${recipients.length}] Failed: ${recipient.email} - ${result.error}`);
        }

      } catch (err: any) {
        console.error(`❌ [${i + 1}/${recipients.length}] Error sending to ${recipient.email}:`, err);
        errorCount++;
        errors.push(`${recipient.email}: ${err.message}`);
      }

      // Pause de 550ms entre chaque envoi pour respecter le rate limit de 2/sec
      // (500ms minimum + 50ms de marge de sécurité)
      if (i < recipients.length - 1) {
        await sleep(550);
      }
    }

    // Logger la campagne (mode réel uniquement)
    if (mode === 'real' && successCount > 0) {
      const { error: logError } = await supabase
        .from('newsletter_logs')
        .insert({
          subject,
          audience_type: audienceType,
          token_threshold: tokenThreshold,
          recipients_count: successCount,
          sent_by: user.id,
          status: errorCount === 0 ? 'sent' : 'partial',
        });

      if (logError) {
        console.error('Failed to log campaign:', logError);
      }
    }

    console.log(`📧 Newsletter complete: ${successCount} sent, ${errorCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: mode === 'test' 
        ? `Email de test envoyé à ${user.email}` 
        : `Newsletter envoyée à ${successCount} destinataires`,
      recipientCount: successCount,
      errorCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limiter à 10 erreurs
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Newsletter error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erreur lors de l\'envoi de la newsletter' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

