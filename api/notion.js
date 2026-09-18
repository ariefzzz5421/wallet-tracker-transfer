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

function sameId(a = '', b = '') {
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

function unwrapRecord(record) {
  return record?.value ?? record;
}

function getRecordById(map, id) {
  if (!map || !id) return undefined;
  for (const [key, record] of Object.entries(map)) {
    const value = unwrapRecord(record);
    if (sameId(key, id) || sameId(value?.id, id)) return record;
  }
  return undefined;
}

function findCollectionInstance(recordMap, requestedViewId) {
  const instances = Object.values(recordMap.block || {})
    .map(unwrapRecord)
    .filter(value =>
      value
      && (value.type === 'collection_view' || value.type === 'collection_view_page')
      && value.collection_id
    );

  for (const value of instances) {
    const matchedView = (value.view_ids || []).find(id => sameId(id, requestedViewId));
    if (matchedView) return { collectionId: value.collection_id, viewId: matchedView };
  }

  const first = instances[0];
  if (first) {
    return {
      collectionId: first.collection_id,
      viewId: first.view_ids?.[0] || requestedViewId,
    };
  }

  const collectionId = Object.keys(recordMap.collection || {})[0];
  return collectionId ? { collectionId, viewId: requestedViewId } : null;
}

function isCollectionRow(record, collectionId) {
  const value = unwrapRecord(record);
  if (!value || value.type !== 'page' || !value.properties) return false;
  return value.parent_table === 'collection'
    || sameId(value.parent_id, collectionId)
    || sameId(value.collection_id, collectionId);
}

function rowFromBlock(block, schema) {
  const props = unwrapRecord(block)?.properties;
  if (!props || typeof props !== 'object') return null;
  const row = {};
  for (const [propertyId, value] of Object.entries(props)) {
    const columnName = schema?.[propertyId]?.name || propertyId;
    const text = plainText(value);
    if (text) row[columnName] = text;
  }
  return Object.keys(row).length ? row : null;
}

function summarizeRecordMap(recordMap = {}) {
  const blockTypes = {};
  for (const record of Object.values(recordMap.block || {})) {
    const type = unwrapRecord(record)?.type || 'unknown';
    blockTypes[type] = (blockTypes[type] || 0) + 1;
  }
  return {
    keys: Object.keys(recordMap),
    blockCount: Object.keys(recordMap.block || {}).length,
    collectionCount: Object.keys(recordMap.collection || {}).length,
    collectionViewCount: Object.keys(recordMap.collection_view || {}).length,
    collectionQueryCount: Object.keys(recordMap.collection_query || {}).length,
    blockTypes,
  };
}

function summarizeCollectionResponse(value = {}) {
  return {
    keys: Object.keys(value || {}),
    recordMap: summarizeRecordMap(value?.recordMap || {}),
    resultKeys: Object.keys(value?.result || {}),
    reducerKeys: Object.keys(value?.result?.reducerResults || {}),
    blockIdCount: collectBlockIds(value?.result).size,
  };
}

function collectRows(mergedBlocks, schema, collectionId, resultBlockIds) {
  const orderedIds = [];
  const seen = new Set();

  const pushId = id => {
    if (!id || seen.has(id) || !mergedBlocks[id]) return;
    seen.add(id);
    orderedIds.push(id);
  };

  for (const id of resultBlockIds) pushId(id);

  for (const [id, record] of Object.entries(mergedBlocks)) {
    if (isCollectionRow(record, collectionId)) pushId(id);
  }

  return orderedIds
    .map(id => rowFromBlock(mergedBlocks[id], schema))
    .filter(Boolean);
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
    const instance = findCollectionInstance(recordMap, viewId);
    if (!instance?.collectionId || !instance?.viewId) {
      throw new Error('Public Notion collection metadata was not found.');
    }

    const collectionId = instance.collectionId;
    const collectionViewId = instance.viewId;
    const collectionRecord = unwrapRecord(getRecordById(recordMap.collection, collectionId));
    const schema = collectionRecord?.schema || {};
    const collectionView = unwrapRecord(getRecordById(recordMap.collection_view, collectionViewId));
    const query = collectionView?.query2 || collectionView?.query || {};

    const modernLoader = {
      type: 'reducer',
      reducers: {
        collection_group_results: {
          type: 'results',
          limit: 2000,
          loadContentCover: true,
        },
        'table:uncategorized:title:count': {
          type: 'aggregation',
          aggregation: {
            property: 'title',
            aggregator: 'count',
          },
        },
      },
      ...query,
      searchQuery: '',
      userTimeZone: 'Asia/Jakarta',
    };

    const modernCollection = await notionPost('queryCollection', {
      collection: { id: collectionId },
      collectionView: { id: collectionViewId },
      loader: modernLoader,
    });
    let collection = modernCollection;
    let protocol = 'modern';

    const modernHasData =
      Object.keys(modernCollection?.recordMap?.block || {}).length > 0
      || collectBlockIds(modernCollection?.result).size > 0;

    if (!modernHasData) {
      const viewType = ['table', 'board'].includes(collectionView?.type)
        ? collectionView.type
        : 'table';

      collection = await notionPost('queryCollection', {
        collectionId,
        collectionViewId,
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
      protocol = 'legacy';
    }

    const mergedBlocks = {
      ...(recordMap.block || {}),
      ...(collection?.recordMap?.block || {}),
    };
    const mergedCollection = {
      ...(recordMap.collection || {}),
      ...(collection?.recordMap?.collection || {}),
    };
    const liveSchema = unwrapRecord(getRecordById(mergedCollection, collectionId))?.schema || schema;
    const blockIds = [...collectBlockIds(collection?.result)];
    const rows = collectRows(mergedBlocks, liveSchema, collectionId, blockIds);

    const pageTitle = plainText(
      unwrapRecord(getRecordById(recordMap.block, pageId))?.properties?.title
      || collectionRecord?.name
      || unwrapRecord(getRecordById(mergedCollection, collectionId))?.name
    );

    const debug = String(req.query?.debug || '') === '1'
      ? {
          page: summarizeRecordMap(recordMap),
          instance,
          collectionViewType: collectionView?.type || null,
          queryKeys: Object.keys(query || {}),
          modern: summarizeCollectionResponse(modernCollection),
          selectedProtocol: protocol,
          selected: summarizeCollectionResponse(collection),
          mergedBlockCount: Object.keys(mergedBlocks).length,
          resultBlockIdCount: blockIds.length,
          schemaColumns: Object.values(liveSchema || {}).map(column => column?.name).filter(Boolean),
        }
      : undefined;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({
      packId,
      title: pageTitle || '',
      rowCount: rows.length,
      rows,
      source: 'public-notion',
      extraction: rows.length ? 'query-v2+recordMap' : 'empty',
      ...(debug ? { debug } : {}),
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Could not read this public Notion database right now.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
