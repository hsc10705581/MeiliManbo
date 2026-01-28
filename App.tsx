import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Resource, ViewMode } from './types';
import ResourceCard from './components/ResourceCard';
import ResourceForm from './components/ResourceForm';
import LoginForm from './components/LoginForm';
import { initMeili, syncToMeili, deleteFromMeili, batchDeleteFromMeili, searchInMeili, getAllResources } from './services/meiliService';

type SortKey = 'date' | 'rating' | 'size' | 'relevance';

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

  // 这里的 resources 现在直接代表从数据库(Meili)拉取的数据或搜索结果
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [isSearching, setIsSearching] = useState(false);
  
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    setResources([]); // 清空数据
  };

  // 初始化数据库并拉取数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    await initMeili(); // 确保索引存在
    const dbData = await getAllResources();
    setResources(dbData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // 搜索逻辑
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      // 搜索框清空时，重新拉取全量数据（或者使用缓存的初始数据）
      // 这里为了数据一致性，选择重新拉取
      loadData();
      return;
    }
    setIsSearching(true);
    const results = await searchInMeili(searchQuery);
    setResources(results);
    setIsSearching(false);
  }, [searchQuery, loadData]);

  // 防抖搜索
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const timer = setTimeout(() => {
      // 如果有搜索词，执行搜索；否则如果是清空操作且当前不是全量状态，也执行加载
      if (searchQuery) {
        performSearch();
      } else if (resources.length === 0 && !isLoading) {
         // 边界情况处理：如果刚登录还没数据，loadData会被上面的useEffect调用，这里不用管
         // 但如果用户删除了搜索词，需要恢复全量
         loadData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch, isAuthenticated]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    resources.forEach(r => r.metadata.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [resources]);

  const handleAddOrEdit = async (data: Partial<Resource>) => {
    let newResource: Resource;
    let updatedList: Resource[];

    if (editingResource) {
      // 编辑模式
      newResource = { 
        ...editingResource, 
        ...data, 
        updatedAt: new Date().toISOString() 
      } as Resource;
      updatedList = resources.map(r => r.id === editingResource.id ? newResource : r);
    } else {
      // 新增模式
      newResource = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name || '未命名资源',
        image: data.image,
        metadata: data.metadata as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = [newResource, ...resources];
    }

    // 1. 乐观更新 UI (Optimistic Update) - 让用户觉得操作是瞬间完成的
    setResources(updatedList);
    closeModal();

    // 2. 发送请求给 MeiliSearch 进行持久化
    // 注意：syncToMeili 现在只传需要变更的数据，虽然全量传也可以，但Meili支持数组upsert
    await syncToMeili([newResource]);
    
    // 可选：如果担心数据一致性，可以在 sync 后重新 loadData()
    // 但 MeiliSearch 索引建立有延迟，立即 loadData 可能会读到旧数据。
    // 所以这里信任前端的计算结果，下次刷新页面时再从 DB 拉取。
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要从数据库中永久删除吗？')) {
      // 1. 乐观更新 UI
      const updated = resources.filter(r => r.id !== id);
      setResources(updated);
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);

      // 2. 数据库操作
      await deleteFromMeili(id);
    }
  };

  const handleBatchDelete = async () => {
    const count = selectedIds.size;
    if (window.confirm(`确定要从数据库中永久删除选中的 ${count} 个资源吗？`)) {
      const idsToDelete = Array.from(selectedIds) as string[];
      
      // 1. 乐观更新 UI
      const updated = resources.filter(r => !selectedIds.has(r.id));
      setResources(updated);
      setSelectedIds(new Set());

      // 2. 数据库操作
      await batchDeleteFromMeili(idsToDelete);
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

  // 纯前端的排序和过滤 (基于当前 fetch 到的 resources)
  const visibleResources = useMemo(() => {
    let filtered = [...resources]; // 浅拷贝避免修改原数组

    if (selectedTags.length > 0) {
      filtered = filtered.filter(r => 
        selectedTags.every(tag => r.metadata.tags.includes(tag))
      );
    }

    return filtered.sort((a, b) => {
      if (sortKey === 'relevance' && searchQuery) {
        // 如果是搜索结果，保持 Meili 返回的顺序 (通常 Meili 已经按相关性排好了)
        // 这里的实现简单处理，不再依赖 searchScore 属性，因为我们已经用 results 覆盖了 resources
        return 0; 
      }
      if (sortKey === 'rating') return b.metadata.rating - a.metadata.rating;
      if (sortKey === 'size') return b.metadata.fileSize - a.metadata.fileSize;
      if (sortKey === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [resources, selectedTags, sortKey, searchQuery]);

  const closeModal = () => { setIsModalOpen(false); setEditingResource(undefined); };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in">
      <nav className="glass-morphism sticky top-0 z-40 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
            <i className="fa-solid fa-server text-lg"></i>
          </div>
          <div className="flex flex-col">
             <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-indigo-600">资源中枢</span>
             <span className="text-[10px] text-slate-400 font-medium">Power by MeiliSearch</span>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-8 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            placeholder="搜索全库..."
            className="w-full pl-11 pr-10 py-2.5 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {(isSearching || isLoading) && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>}
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center">
            <i className="fa-solid fa-plus mr-2"></i>存入数据库
          </button>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 hover:border-red-100 transition-all" title="登出">
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </nav>

      {/* 批量操作栏 */}
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

      {/* 工具栏 */}
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
        {isLoading && resources.length === 0 ? (
          <div className="flex justify-center items-center h-64">
             <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
             <span className="ml-3 text-slate-500 font-medium">正在连接数据库...</span>
          </div>
        ) : visibleResources.length > 0 ? (
          <div className={viewMode === ViewMode.GRID ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-4"}>
            {visibleResources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                // 如果是纯展示，searchScore 可能为空，ResourceCard 会自动处理
                searchScore={undefined}
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
              <i className="fa-solid fa-database text-3xl text-slate-300"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800">数据库中暂无数据</h3>
            <p className="text-slate-400 text-sm mt-1">{searchQuery ? '未匹配到任何资源' : '点击右上角“存入数据库”开始使用'}</p>
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