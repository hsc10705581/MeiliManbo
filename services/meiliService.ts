import { Resource } from "../types";

const MEILI_HOST = '/meili-api';
// 注意：在生产环境中，密钥应该通过后端代理或更安全的方式处理。
// 这里沿用之前 docker-compose 中配置的 masterKey。
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

    // 无论创建成功还是已存在，都尝试更新设置
    await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILI_API_KEY}`
      },
      body: JSON.stringify({
        searchableAttributes: ['name', 'metadata.description', 'metadata.category', 'metadata.tags'],
        filterableAttributes: ['metadata.category', 'metadata.rating', 'metadata.tags', 'id'],
        sortableAttributes: ['createdAt', 'metadata.fileSize', 'metadata.rating', 'updatedAt'],
        // 增加最大分页限制，确保能拉取所有数据作为数据库使用
        pagination: { maxTotalHits: 10000 }
      })
    });
  } catch (e) {
    console.warn("MeiliSearch 初始化/连接失败。", e);
  }
};

// 获取所有资源 (模拟数据库的 SELECT * FROM resources)
export const getAllResources = async (): Promise<Resource[]> => {
  try {
    const response = await fetch(`${MEILI_HOST}/indexes/${INDEX_NAME}/documents?limit=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MEILI_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // MeiliSearch 返回的是 results 数组
      return (data.results || data) as Resource[];
    }
    return [];
  } catch (e) {
    console.error("无法从 MeiliSearch 拉取数据", e);
    return [];
  }
};

export const syncToMeili = async (resources: Resource[]) => {
  // 注意：MeiliSearch 的 /documents 接口就是 upsert (插入或更新)
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
    console.error("同步数据失败", e);
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
  } catch (e) {
    console.error("删除数据失败", e);
  }
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
  } catch (e) {
    console.error("批量删除失败", e);
  }
};

// 搜索并返回完整对象
export const searchInMeili = async (query: string): Promise<Resource[]> => {
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
        limit: 200, // 增加搜索返回限制
        attributesToRetrieve: ['*'] // 关键：获取所有字段，而不仅仅是 ID
      })
    });
    
    const data = await response.json();
    
    // 将 hits 转换为 Resource 对象，并附加搜索分数以便前端排序
    return data.hits ? data.hits.map((hit: any) => ({
      ...hit,
      // 如果需要保留 rankingScore 可以放在临时属性里，这里直接返回完整 Resource 结构
      // searchScore: hit._rankingScore 
    })) : [];
  } catch (e) {
    console.error("搜索失败", e);
    return [];
  }
};