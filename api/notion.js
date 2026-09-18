const PACKS = {
  'notion-01': { pageId: '52c36ac9a1074b8897f7e413caa0597d', viewId: '23118e91dbb54d6f890090ac21fe5c42' },
  'notion-02': { pageId: '9a9f8e3b939c4005a90b86e065838b2b', viewId: '3cf2390761ca81fb9e99000c2db58f17' },
  'notion-03': { pageId: 'b8ca8c3741d74d709e6c8e17c254818d', viewId: '3c02390761ca816cb594000c92f2f6ce' },
  'notion-04': { pageId: '80f2d75809244415bae1ff4b48d78cf1', viewId: '5fa6abd7ba704cd6b67714325200408a' },
  'notion-05': { pageId: 'd0afecae9b1445fc8f73f1b44b43b75c', viewId: 'cd6f8615c95f4d9881688c70c0d23053' },
};

const SITE_BASE = 'https://uttermost-pumpkin-971.notion.site';

function dashed(id = '') {
  const clean = id.replace(/-/g, '');
  return clean.length === 32
    ? `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
    : id;
}

function plainText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!Array.isArray(value)) return '';
  return value.map(part => {
    if (typeof part === 'string' || typeof part === 'number') return String(part);
    if (!Array.isArray(part) || !part.length) return '';
    if (typeof part[0] === 'string' || typeof part[0] === 'number') return String(part[0]);
    return plainText(part);
  }).join('').trim();
}

async function notionPost(endpoint, body) {
  const origins = [
    `${SITE_BASE}/api/v3/${endpoint}`,
    `https://www.notion.so/api/v3/${endpoint}`,
  ];
  let lastError;
  for (const url of origins) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'user-agent': 'wallettranslate/1.0',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        lastError = new Error(`Notion ${endpoint} returned ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unable to reach Notion ${endpoint}`);
}

function collectBlockIds(value, out = new Set()) {
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectBlockIds(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'blockIds' && Array.isArray(item)) {
      for (const id of item) if (typeof id === 'string') out.add(id);
    } else {
      collectBlockIds(item, out);
    }
  }
  return out;
}

function rowFromBlock(block, schema) {
  const props = block?.value?.properties;
  if (!props || typeof props !== 'object') return null;
  const row = {};
  for (const [propertyId, value] of Object.entries(props)) {
    const columnName = schema?.[propertyId]?.name || propertyId;
    const text = plainText(value);
    if (text) row[columnName] = text;
  }
  return Object.keys(row).length ? row : null;
}

async function loadPublicPage(pageId) {
  try {
    return await notionPost('loadPageChunk', {
      pageId,
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    });
  } catch (firstError) {
    try {
      return await notionPost('loadCachedPageChunkV2', {
        page: { id: pageId },
        limit: 100,
        cursor: { stack: [] },
        chunkNumber: 0,
        verticalColumns: false,
      });
    } catch {
      throw firstError;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const packId = String(req.query?.pack || '');
  const pack = PACKS[packId];
  if (!pack) return res.status(404).json({ error: 'Unknown starter pack.' });

  try {
    const pageId = dashed(pack.pageId);
    const viewId = dashed(pack.viewId);

    const page = await loadPublicPage(pageId);

    const recordMap = page?.recordMap || {};
    const collectionId = Object.keys(recordMap.collection || {})[0]
      || Object.values(recordMap.block || {}).find(record => record?.value?.collection_id)?.value?.collection_id;

    if (!collectionId) throw new Error('Public Notion collection metadata was not found.');

    const collectionRecord = recordMap.collection?.[collectionId]?.value;
    const schema = collectionRecord?.schema || {};
    const collectionView = recordMap.collection_view?.[viewId]?.value;
    const viewType = ['table', 'board'].includes(collectionView?.type) ? collectionView.type : 'table';
    const query = collectionView?.query2 || collectionView?.query || {
      aggregations: [{ property: 'title', aggregator: 'count' }],
    };

    const collection = await notionPost('queryCollection', {
      collectionId,
      collectionViewId: viewId,
      query,
      loader: {
        type: viewType,
        limit: 2000,
        searchQuery: '',
        userTimeZone: 'Asia/Jakarta',
        userLocale: 'en',
        loadContentCover: true,
      },
    });

    const mergedBlocks = {
      ...(recordMap.block || {}),
      ...(collection?.recordMap?.block || {}),
    };
    const mergedCollection = {
      ...(recordMap.collection || {}),
      ...(collection?.recordMap?.collection || {}),
    };
    const liveSchema = mergedCollection?.[collectionId]?.value?.schema || schema;
    const blockIds = [...collectBlockIds(collection?.result)];

    const rows = blockIds
      .map(id => rowFromBlock(mergedBlocks[id], liveSchema))
      .filter(Boolean);

    const pageTitle = plainText(
      recordMap.block?.[pageId]?.value?.properties?.title
      || collectionRecord?.name
      || mergedCollection?.[collectionId]?.value?.name
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({
      packId,
      title: pageTitle || '',
      rowCount: rows.length,
      rows,
      source: 'public-notion',
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Could not read this public Notion database right now.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
