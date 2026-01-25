import { Resource, SearchHit } from "../types";

const MEILI_HOST = '/meili-api';
const MEILI_API_KEY = 'masterKey_YourSecureKey';
const INDEX_NAME = 'resources';

export const initMeili = async () => {
  try {
    const res = await fetch(`${MEILI_HOST}/indexes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILI_API_KEY}`
      },
      body: JSON.stringify({ uid: INDEX_NAME, primaryKey: 'id' })
    });

    if (res.ok || res.status === 409) {
      await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MEILI_API_KEY}`
        },
        body: JSON.stringify({
          searchableAttributes: ['name', 'metadata.description', 'metadata.category', 'metadata.tags'],
          filterableAttributes: ['metadata.category', 'metadata.rating', 'metadata.tags'],
          sortableAttributes: ['createdAt', 'metadata.fileSize', 'metadata.rating'],
          rankingRules: [
            "words",
            "typo",
            "proximity",
            "attribute",
            "exactness"
          ]
        })
      });
    }
  } catch (e) {
    console.warn("MeiliSearch 连接失败。", e);
  }
};

export const syncToMeili = async (resources: Resource[]) => {
  if (!resources || resources.length === 0) return true;
  try {
    const response = await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILI_API_KEY}`
      },
      body: JSON.stringify(resources)
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

export const deleteFromMeili = async (id: string) => {
  try {
    await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/documents/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${MEILI_API_KEY}`
      }
    });
  } catch (e) {}
};

export const batchDeleteFromMeili = async (ids: string[]) => {
  try {
    await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/documents/delete-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILI_API_KEY}`
      },
      body: JSON.stringify(ids)
    });
  } catch (e) {}
};

export const searchInMeili = async (query: string): Promise<SearchHit[]> => {
  if (!query.trim()) return [];
  try {
    const response = await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILI_API_KEY}`
      },
      body: JSON.stringify({ 
        q: query, 
        limit: 100,
        showRankingScore: true,
        attributesToRetrieve: ['id']
      })
    });
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) return [];

    const data = await response.json();
    return data.hits ? data.hits.map((hit: any) => ({
      id: hit.id,
      score: hit._rankingScore || 0
    })) : [];
  } catch (e) {
    return [];
  }
};