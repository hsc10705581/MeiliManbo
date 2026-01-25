import React from 'react';
import { Resource } from '../types';

interface ResourceCardProps {
  resource: Resource;
  searchScore?: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (res: Resource) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ 
  resource, 
  searchScore, 
  isSelected, 
  onToggleSelect, 
  onEdit, 
  onDelete,
  onTagClick
}) => {
  const scorePercent = searchScore !== undefined ? Math.round(searchScore * 100) : null;

  return (
    <div className={`relative bg-white rounded-xl shadow-sm border transition-all group ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:shadow-md'}`}>
      
      {/* 多选勾选框 */}
      <div className={`absolute top-3 left-3 z-20 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggleSelect(resource.id)}
          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      </div>

      <div className="relative h-44 bg-slate-100 overflow-hidden rounded-t-xl">
        {resource.image ? (
          <img 
            src={resource.image} 
            alt={resource.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <i className="fa-solid fa-file-lines text-4xl"></i>
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={() => onEdit(resource)} className="p-2 bg-white/90 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white"><i className="fa-solid fa-pen-to-square"></i></button>
          <button onClick={() => onDelete(resource.id)} className="p-2 bg-white/90 text-red-600 rounded-lg hover:bg-red-600 hover:text-white"><i className="fa-solid fa-trash"></i></button>
        </div>

        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <div className="px-2 py-1 bg-black/60 text-white text-[10px] rounded backdrop-blur-sm uppercase font-bold">
            {resource.metadata.category}
          </div>
          {scorePercent !== null && scorePercent < 100 && (
            <div className="px-2 py-1 bg-indigo-600/90 text-white text-[10px] rounded backdrop-blur-sm font-bold">
              <i className="fa-solid fa-bolt mr-1"></i>{scorePercent}%
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-slate-800 truncate mb-1">{resource.name}</h3>
        
        {/* 标签展示 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {resource.metadata.tags.map(tag => (
            <span 
              key={tag} 
              onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
              className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
            >
              #{tag}
            </span>
          ))}
          {resource.metadata.tags.length === 0 && <span className="text-[10px] text-slate-300 italic">暂无标签</span>}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] text-slate-400">
          <span>{resource.metadata.fileSize.toFixed(1)}MB</span>
          <span className="text-yellow-500"><i className="fa-solid fa-star mr-1"></i>{resource.metadata.rating}</span>
        </div>
      </div>
    </div>
  );
};

export default ResourceCard;