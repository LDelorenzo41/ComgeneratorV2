// Code mis à jour pour votre Cloudflare Worker
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 🔥 TOUS VOS FLUX RSS
const RSS_FEEDS = [
  {
    url: 'https://www.cafepedagogique.net/feed/',
    source: 'Café Pédagogique'
  },
  {
    url: 'https://www.vousnousils.fr/feed',
    source: 'VousNousIls'
  },
  {
    url: 'https://eduscol.education.fr/rss/actualites-numerique.xml',
    source: 'Éduscol Numérique'
  },
  {
    url: 'https://eduscol.education.fr/rss/actualites.xml',
    source: 'Éduscol'
  },
  {
    url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Éducation%20Physique%20et%20Sportive',
    source: 'Édubase EPS'
  }
];

function parseXML(xmlText) {
  function getTagContent(xml, tag) {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is');
    const match = xml.match(regex);
    if (match && match[1]) {
      return match[1].replace(/<!\[CDATA\[(.*?)\]\]>/is, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
    return '';
  }

  try {
    if (!xmlText || typeof xmlText !== 'string') {
      throw new Error('Invalid XML input');
    }

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [];
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];
      const title = getTagContent(itemContent, 'title');
      const link = getTagContent(itemContent, 'link');
      const description = getTagContent(itemContent, 'description');
      const pubDate = getTagContent(itemContent, 'pubDate');

      if (title && link) {
        items.push({
          title: cleanHtml(title),
          link,
          description: cleanHtml(description) || 'Aucune description disponible',
          pubDate: pubDate || new Date().toISOString()
        });
      }
    }

    return items;
  } catch (error) {
    console.error('XML parsing error:', error);
    throw new Error(`Erreur lors de l'analyse du flux RSS: ${error.message}`);
  }
}

// 🧹 Fonction pour nettoyer le HTML
function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Supprime les balises HTML
    .replace(/&nbsp;/g, ' ') // Remplace les espaces insécables
    .replace(/&amp;/g, '&') // Décode les entités HTML communes
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRSSFeed(feed) {
  try {
    console.log(`🔄 Fetching ${feed.source}...`);
    
    const response = await fetchWithTimeout(
      feed.url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS-Reader/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        cf: {
          cacheTtl: 300,
          cacheEverything: true,
        },
      },
      15000 // 15 secondes timeout
    );

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response');
    }

    const items = parseXML(text);
    console.log(`✅ ${feed.source}: ${items.length} articles`);
    
    return {
      status: 'fulfilled',
      value: items.slice(0, 10).map(item => ({ // Limite à 10 articles par flux
        ...item,
        source: feed.source
      }))
    };
  } catch (error) {
    console.error(`❌ Failed to fetch ${feed.source}:`, error);
    return {
      status: 'rejected',
      reason: error.message
    };
  }
}

function parseDate(dateStr) {
  if (!dateStr) return 0;

  try {
    const cleanDate = dateStr.trim()
      .replace(/^[a-z]{3},\s*/i, '')
      .replace(/\s+\([^)]+\)/g, '')
      .replace(/\s+[a-z]{3}(\s+|$)/i, ' ')
      .replace(/\s+GMT[+-]\d{4}/, '')
      .replace(/\s+GMT\s*$/, '')
      .replace(/\s+[+-]\d{4}\s*$/, '')
      .trim();

    const timestamp = Date.parse(cleanDate);
    if (!isNaN(timestamp)) {
      return timestamp;
    }

    const date = new Date(cleanDate);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch (e) {
    console.error('Date parsing error:', dateStr, e);
    return 0;
  }
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    console.log(`📡 Processing ${RSS_FEEDS.length} RSS feeds...`);
    
    // Récupérer tous les flux en parallèle avec gestion des erreurs
    const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
    const results = await Promise.allSettled(feedPromises);

    // Collecter tous les articles réussis
    const allArticles = [];
    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        allArticles.push(...result.value.value);
        successCount++;
      } else {
        errorCount++;
        console.error(`❌ Feed ${RSS_FEEDS[index].source} failed:`, result.reason);
      }
    });

    // Trier par date et limiter le nombre total
    const sortedArticles = allArticles
      .filter(article => article && article.title && article.link)
      .sort((a, b) => parseDate(b.pubDate) - parseDate(a.pubDate))
      .slice(0, 50); // Maximum 50 articles au total

    console.log(`📊 Results: ${successCount} successful feeds, ${errorCount} failed, ${sortedArticles.length} total articles`);

    if (sortedArticles.length === 0) {
      throw new Error('Aucun article disponible pour le moment');
    }

    return new Response(JSON.stringify(sortedArticles), {
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300', // Cache 5 minutes
      }
    });
  } catch (error) {
    console.error('❌ Worker error:', error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error.message || 'Une erreur est survenue lors de la récupération des articles',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        }
      }
    );
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});