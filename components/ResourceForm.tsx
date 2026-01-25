import React, { useState, useEffect } from 'react';
import { Resource, ResourceMetadata } from '../types';

interface ResourceFormProps {
  initialData?: Resource;
  existingTags: string[];
  onSubmit: (data: Partial<Resource>) => void;
  onCancel: () => void;
}

const ResourceForm: React.FC<ResourceFormProps> = ({ initialData, existingTags, onSubmit, onCancel }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [image, setImage] = useState(initialData?.image || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.metadata.tags || []);
  const [tagInput, setTagInput] = useState('');
  
  // 文件大小单位处理
  const getInitialSizeState = () => {
    const mb = initialData?.metadata.fileSize || 0;
    if (mb >= 1048576) return { val: (mb / 1048576).toFixed(2), unit: 'TB' };
    if (mb >= 1024) return { val: (mb / 1024).toFixed(2), unit: 'GB' };
    return { val: mb.toString(), unit: 'MB' };
  };

  const initialSize = getInitialSizeState();
  const [sizeVal, setSizeVal] = useState(initialSize.val);
  const [sizeUnit, setSizeUnit] = useState(initialSize.unit);

  const [metadata, setMetadata] = useState<ResourceMetadata>(
    initialData?.metadata || {
      description: '',
      source: '',
      fileSize: 0,
      category: '常规',
      rating: 5,
      tags: []
    }
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 转换文件大小到 MB
    let finalMB = parseFloat(sizeVal) || 0;
    if (sizeUnit === 'GB') finalMB *= 1024;
    if (sizeUnit === 'TB') finalMB *= 1048576;

    onSubmit({ 
      name, 
      image, 
      metadata: { 
        ...metadata, 
        tags: selectedTags,
        fileSize: finalMB 
      } 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-5">
          {/* 基础信息 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">资源名称</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入资源标题..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          {/* 标签选择器 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">标签管理</label>
            <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-xl min-h-[46px] focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              {selectedTags.map(tag => (
                <span key={tag} className="flex items-center bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold border border-indigo-100">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 hover:text-indigo-900">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                }}
                placeholder={selectedTags.length === 0 ? "输入并回车..." : ""}
                className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
              />
            </div>
            {/* 推荐标签 */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase w-full mb-1">系统已有标签 (点击添加):</span>
              {existingTags.filter(t => !selectedTags.includes(t)).slice(0, 10).map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-md hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 分类与评分 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">分类</label>
              <select
                value={metadata.category}
                onChange={(e) => setMetadata({...metadata, category: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option>常规</option>
                <option>图片素材</option>
                <option>3D 模型</option>
                <option>文档资料</option>
                <option>音频</option>
                <option>视频</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">文件大小</label>
              <div className="flex">
                <input
                  type="number"
                  step="0.01"
                  value={sizeVal}
                  onChange={(e) => setSizeVal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-l-xl border border-slate-200 border-r-0 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <select
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value)}
                  className="px-2 py-2.5 rounded-r-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option>MB</option>
                  <option>GB</option>
                  <option>TB</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* 预览图上传 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">预览图 & 评分</label>
            <div className="relative group h-40 w-full rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 transition-all cursor-pointer">
              {image ? (
                <img src={image} alt="预览" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <i className="fa-solid fa-image text-3xl text-slate-300 group-hover:text-indigo-400 mb-2"></i>
                  <p className="text-xs text-slate-400 font-medium">点击或拖拽上传</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <div className="mt-4 flex items-center space-x-3">
              <span className="text-sm font-bold text-slate-700">评分:</span>
              <input
                type="range"
                min="1"
                max="10"
                value={metadata.rating}
                onChange={(e) => setMetadata({...metadata, rating: parseInt(e.target.value)})}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="w-8 text-center font-black text-indigo-600">{metadata.rating}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">详细描述</label>
            <textarea
              rows={4}
              value={metadata.description}
              onChange={(e) => setMetadata({...metadata, description: e.target.value})}
              placeholder="资源的用途、备注、或者关联信息..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
            ></textarea>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors">取消</button>
        <button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">
          {initialData ? '保存修改' : '确认存入'}
        </button>
      </div>
    </form>
  );
};

export default ResourceForm;