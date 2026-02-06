import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { parse } from 'https://deno.land/x/xml@2.1.3/mod.ts';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';

// Fonction utilitaire pour nettoyer HTML
function cleanHtml(html) {
  if (!html) return '';
  try {
    html = html.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  } catch  {
    return html;
  }
}

// Fonction utilitaire pour parser la date
function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  try {
    const cleanDate = dateStr.replace(/^[a-z]{3},\s*/i, '').replace(/\s+\([^)]+\)/g, '').replace(/\s+[a-z]{3}(\s+|$)/i, ' ').trim();
    const date = new Date(cleanDate);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch  {
    return new Date().toISOString();
  }
}

// Fonction pour extraire une image
async function extractImageFromContent(content, link) {
  try {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    if (!doc) return null;
    const mediaContent = doc.querySelector('media\\:content, content');
    if (mediaContent?.getAttribute('url')) {
      return mediaContent.getAttribute('url');
    }
    const img = doc.querySelector('img');
    if (img?.getAttribute('src')) {
      const src = img.getAttribute('src');
      return src.startsWith('http') ? src : new URL(src, new URL(link).origin).href;
    }
    return null;
  } catch  {
    return null;
  }
}

// Fonction pour récupérer un flux RSS avec limite
async function fetchRSSFeed(feed) {
  try {
    console.log(`Fetching feed from ${feed.url}`);
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS-Reader/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    
    if (!response.ok) {
      console.warn(`Feed ${feed.name} returned ${response.status}: ${response.statusText}`);
      if (response.status === 404) {
        console.warn(`Feed ${feed.name} not found (404), skipping...`);
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    
    if (!xmlText || xmlText.trim().length === 0) {
      console.warn(`Feed ${feed.name} returned empty content`);
      return [];
    }
    
    const parsed = parse(xmlText);
    const channel = parsed.rss?.channel;
    
    if (!channel) {
      console.warn(`Feed ${feed.name} has invalid RSS format`);
      return [];
    }
    
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    
    if (!items || items.length === 0) {
      console.warn(`Feed ${feed.name} has no items`);
      return [];
    }
    
    // 🎯 LIMITE : Seulement les 10 articles les plus récents par flux
    const limitedItems = items
      .filter((item) => item && typeof item === 'object')
      .slice(0, 10);
    
    const articles = await Promise.all(limitedItems.map(async (item) => {
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const description = Array.isArray(item.description) ? item.description[0] : item.description;
      const link = Array.isArray(item.link) ? item.link[0] : item.link;
      const pubDate = Array.isArray(item.pubDate) ? item.pubDate[0] : item.pubDate;
      const content = Array.isArray(item['content:encoded']) ? item['content:encoded'][0] : item['content:encoded'];
      const imageUrl = await extractImageFromContent(content || description || '', String(link || ''));
      
      return {
        title: cleanHtml(String(title || '')),
        description: cleanHtml(String(description || '')),
        link: String(link || '').trim(),
        source: feed.name,
        feed_id: feed.id,
        pub_date: parseDate(String(pubDate || '')),
        image_url: imageUrl
      };
    }));
    
    const validArticles = articles.filter((a) => a.title && a.link);
    console.log(`Feed ${feed.name}: ${validArticles.length} valid articles extracted (limited to 10)`);
    return validArticles;
    
  } catch (err) {
    console.error(`Error fetching ${feed.name} (${feed.url}):`, err.message);
    return [];
  }
}

// Headers CORS communs
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handler principal avec CORS
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // =====================================================
  // ✅ SÉCURITÉ : Vérification de l'authentification JWT
  // =====================================================
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Configuration serveur manquante' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseServiceKey
    }
  });

  if (!userResponse.ok) {
    return new Response(JSON.stringify({ error: 'Token invalide ou expiré' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authUser = await userResponse.json();
  console.log(`[fetch-rss] Utilisateur authentifié: ${authUser.id}`);
  // =====================================================
  // FIN VÉRIFICATION JWT
  // =====================================================

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 1️⃣ Charger SEULEMENT les flux actifs
    console.log('Fetching active feeds...');
    const { data: feeds, error: feedsError } = await supabaseClient
      .from('rss_feeds')
      .select('id, name, url')
      .eq('is_active', true);
      
    if (feedsError) {
      console.error('Error fetching feeds:', feedsError);
      throw feedsError;
    }
    
    if (!feeds || feeds.length === 0) {
      console.log('No active feeds found');
      return new Response(JSON.stringify({
        success: true,
        message: 'Aucun flux actif trouvé',
        feeds_processed: 0,
        articles_processed: 0
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    console.log(`Found ${feeds.length} active feeds`);
    
    // 2️⃣ Récupérer les articles (max 10 par flux)
    const results = await Promise.all(feeds.map((f) => fetchRSSFeed(f)));
    const articles = results.flat();
    
    console.log(`Collected ${articles.length} articles total`);
    
    if (articles.length === 0) {
      console.log('No articles collected from active feeds');
      return new Response(JSON.stringify({
        success: true,
        message: 'Aucun article récupéré',
        feeds_processed: feeds.length,
        articles_processed: 0
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // 3️⃣ UPSERT : Insérer/Mettre à jour les articles (évite les doublons)
    console.log('Upserting articles...');
    const { error: upsertError } = await supabaseClient
      .from('articles')
      .upsert(articles, { 
        onConflict: 'link,feed_id',
        ignoreDuplicates: false 
      });
      
    if (upsertError) {
      console.error('Error upserting articles:', upsertError);
      throw upsertError;
    }
    
    // 4️⃣ Nettoyage automatique : Supprimer les articles de plus de 30 jours
    console.log('Cleaning articles older than 30 days...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { error: cleanupError } = await supabaseClient
      .from('articles')
      .delete()
      .lt('pub_date', thirtyDaysAgo.toISOString());
    
    if (cleanupError) {
      console.warn('Error cleaning old articles:', cleanupError);
    } else {
      console.log('Old articles cleaned successfully');
    }
    
    // 5️⃣ Limiter le nombre total d'articles (sécurité)
    console.log('Checking total article count...');
    const { count } = await supabaseClient
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total articles in database: ${count}`);
    
    if (count && count > 500) {
      console.log('Limiting to 500 most recent articles...');
      
      // Récupérer les IDs des 500 articles les plus récents
      const { data: articlesToKeep } = await supabaseClient
        .from('articles')
        .select('id')
        .order('pub_date', { ascending: false })
        .limit(500);
      
      if (articlesToKeep && articlesToKeep.length === 500) {
        const idsToKeep = articlesToKeep.map(a => a.id);
        
        const { error: limitError } = await supabaseClient
          .from('articles')
          .delete()
          .not('id', 'in', `(${idsToKeep.map(id => `'${id}'`).join(',')})`);
          
        if (limitError) {
          console.warn('Error limiting articles:', limitError);
        } else {
          console.log('Articles successfully limited to 500 most recent');
        }
      }
    }
    
    // 6️⃣ Statistiques finales
    const { count: finalCount } = await supabaseClient
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    console.log('RSS update completed successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: `Flux RSS mis à jour avec succès`,
      feeds_processed: feeds.length,
      articles_processed: articles.length,
      total_articles_in_db: finalCount || 0,
      optimizations_applied: [
        'Limite de 10 articles par flux',
        'Suppression des articles > 30 jours',
        'Limitation totale à 500 articles max',
        'Prévention des doublons via UPSERT'
      ]
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      details: err.toString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
