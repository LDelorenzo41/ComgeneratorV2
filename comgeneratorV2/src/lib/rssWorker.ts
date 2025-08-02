// Ce code doit être déployé sur Cloudflare Workers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const RSS_FEEDS = [
  {
    url: 'https://www.cafepedagogique.net/feed/',
    source: 'Café Pédagogique'
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
          title,
          link,
          description: description || 'Aucune description disponible',
          pubDate: pubDate || new Date().toISOString()
        });
      }
    }

    if (items.length === 0) {
      throw new Error('No valid items found in XML');
    }

    return items;
  } catch (error) {
    console.error('XML parsing error:', error);
    throw new Error(`Erreur lors de l'analyse du flux RSS: ${error.message}`);
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
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

    const contentType = response.headers.get('content-type');
    if (!contentType || (!contentType.includes('xml') && !contentType.includes('text/html'))) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRSSFeed(feed) {
  try {
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
      }
    );

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response');
    }

    const items = parseXML(text);
    return {
      status: 'fulfilled',
      value: items.map(item => ({
        ...item,
        source: feed.source
      }))
    };
  } catch (error) {
    console.error(`Failed to fetch ${feed.source}:`, error);
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
    const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
    const results = await Promise.all(feedPromises);

    const articles = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .flat()
      .filter(article => article && article.title && article.link)
      .sort((a, b) => parseDate(b.pubDate) - parseDate(a.pubDate))
      .slice(0, 10);

    if (articles.length === 0) {
      throw new Error('Aucun article disponible pour le moment');
    }

    return new Response(JSON.stringify(articles), {
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300',
      }
    });
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error.message || 'Une erreur est survenue lors de la récupération des articles'
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