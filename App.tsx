
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Resource, ViewMode, SearchHit } from './types';
import ResourceCard from './components/ResourceCard';
import ResourceForm from './components/ResourceForm';
import LoginForm from './components/LoginForm';
import { initMeili, syncToMeili, deleteFromMeili, batchDeleteFromMeili, searchInMeili } from './services/meiliService';

type SortKey = 'date' | 'rating' | 'size' | 'relevance';

// 声明 window 上的环境变量对象
declare global {
  interface Window {
    _env_?: {
      LOGIN_USER?: string;
      LOGIN_PASS?: string;
    };
  }
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('is_authenticated') === 'true';
  });

  const [resources, setResources] = useState<Resource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 改进的登录逻辑：从运行时生成的 window._env_ 读取
  const handleLogin = (user: string, pass: string) => {
    const targetUser = window._env_?.LOGIN_USER || 'admin';
    const targetPass = window._env_?.LOGIN_PASS || 'admin';

    if (user === targetUser && pass === targetPass) {
      sessionStorage.setItem('is_authenticated', 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('is_authenticated');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      initMeili();
      const saved = localStorage.getItem('resource_warehouse');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setResources(parsed);
          syncToMeili(parsed);
        } catch (e) {
          console.error("加载存储失败", e);
        }
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('resource_warehouse', JSON.stringify(resources));
      if (!searchQuery) {
        setSearchHits(resources.map(r => ({ id: r.id, score: 1.0 })));
      }
    }
  }, [resources, searchQuery, isAuthenticated]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchHits(resources.map(r => ({ id: r.id, score: 1.0 })));
      return;
    }
    setIsSearching(true);
    const hits = await searchInMeili(searchQuery);
    setSearchHits(hits);
    setIsSearching(false);
  }, [searchQuery, resources]);

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, handleSearch, isAuthenticated]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    resources.forEach(r => r.metadata.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [resources]);

  const handleAddOrEdit = async (data: Partial<Resource>) => {
    let updatedResources: Resource[];
    if (editingResource) {
      updatedResources = resources.map(r => r.id === editingResource.id ? { 
        ...r, ...data, updatedAt: new Date().toISOString() 
      } as Resource : r);
    } else {
      const newResource: Resource = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name || '未命名资源',
        image: data.image,
        metadata: data.metadata as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedResources = [newResource, ...resources];
    }
    setResources(updatedResources);
    syncToMeili(updatedResources);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除吗？')) {
      const updated = resources.filter(r => r.id !== id);
      setResources(updated);
      await deleteFromMeili(id);
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }
  };

  const handleBatchDelete = async () => {
    const count = selectedIds.size;
    if (window.confirm(`确定要删除选中的 ${count} 个资源吗？`)) {
      // FIX: Explicitly cast to string[] to resolve the reported unknown[] inference error.
      const idsToDelete = Array.from(selectedIds) as string[];
      const updated = resources.filter(r => !selectedIds.has(r.id));
      setResources(updated);
      await batchDeleteFromMeili(idsToDelete);
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const visibleResources = useMemo(() => {
    let filtered = searchHits
      .map(hit => {
        const resource = resources.find(r => r.id === hit.id);
        return resource ? { ...resource, searchScore: hit.score } : null;
      })
      .filter((r): r is (Resource & { searchScore: number }) => !!r);

    if (selectedTags.length > 0) {
      filtered = filtered.filter(r => 
        selectedTags.every(tag => r.metadata.tags.includes(tag))
      );
    }

    return filtered.sort((a, b) => {
      if (sortKey === 'relevance' && searchQuery) return b.searchScore - a.searchScore;
      if (sortKey === 'rating') return b.metadata.rating - a.metadata.rating;
      if (sortKey === 'size') return b.metadata.fileSize - a.metadata.fileSize;
      if (sortKey === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [searchHits, resources, selectedTags, sortKey, searchQuery]);

  const closeModal = () => { setIsModalOpen(false); setEditingResource(undefined); };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in">
      <nav className="glass-morphism sticky top-0 z-40 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
            <i className="fa-solid fa-database text-lg"></i>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-indigo-600">资源中枢</span>
        </div>

        <div className="flex-1 max-w-xl mx-8 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            placeholder="搜索名称、描述或标签..."
            className="w-full pl-11 pr-10 py-2.5 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>}
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center">
            <i className="fa-solid fa-plus mr-2"></i>添加资源
          </button>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 hover:border-red-100 transition-all" title="登出">
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </nav>

      {selectedIds.size > 0 && (
        <div className="bg-indigo-600 text-white px-6 py-3 sticky top-[73px] z-30 flex items-center justify-between shadow-xl animate-slide-down">
          <div className="flex items-center space-x-4">
            <span className="font-medium text-sm">已选中 {selectedIds.size} 个资源</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 transition-colors">取消全选</button>
          </div>
          <button onClick={handleBatchDelete} className="bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-xl text-sm font-bold transition-colors flex items-center">
            <i className="fa-solid fa-trash-can mr-2"></i>批量删除
          </button>
        </div>
      )}

      <div className="px-8 pt-6 pb-2 max-w-7xl mx-auto w-full space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">标签筛选:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedTags.includes(tag) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
            >
              #{tag}
            </button>
          ))}
          {allTags.length === 0 && <span className="text-xs text-slate-400 italic">暂无可用标签</span>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 uppercase">排序:</span>
              <select 
                value={sortKey} 
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-sm bg-transparent border-none focus:ring-0 font-medium text-slate-700 cursor-pointer"
              >
                <option value="date">最近更新</option>
                <option value="rating">评分最高</option>
                <option value="size">文件大小</option>
                {searchQuery && <option value="relevance">相关度</option>}
              </select>
            </div>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button onClick={() => setViewMode(ViewMode.GRID)} className={`p-2 px-4 rounded-lg transition-colors ${viewMode === ViewMode.GRID ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <i className="fa-solid fa-grip"></i>
            </button>
            <button onClick={() => setViewMode(ViewMode.LIST)} className={`p-2 px-4 rounded-lg transition-colors ${viewMode === ViewMode.LIST ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <i className="fa-solid fa-list"></i>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {visibleResources.length > 0 ? (
          <div className={viewMode === ViewMode.GRID ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-4"}>
            {visibleResources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                searchScore={resource.searchScore}
                isSelected={selectedIds.has(resource.id)}
                onToggleSelect={toggleSelect}
                onEdit={(r) => { setEditingResource(r); setIsModalOpen(true); }} 
                onDelete={handleDelete}
                onTagClick={toggleTag}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-magnifying-glass text-3xl text-slate-300"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800">未找到符合条件的资源</h3>
            <p className="text-slate-400 text-sm mt-1">尝试调整搜索词或取消部分标签筛选</p>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl p-8 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800">{editingResource ? '编辑资源' : '存入新资源'}</h2>
              <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <ResourceForm 
              initialData={editingResource} 
              existingTags={allTags}
              onSubmit={handleAddOrEdit} 
              onCancel={closeModal} 
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default App;
