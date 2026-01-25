import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: (user: string, pass: string) => boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(username, password);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 500); // 抖动动画后重置
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4">
      <div className={`w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-300 ${error ? 'animate-shake' : ''}`}>
        <div className="p-8 sm:p-12">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-4">
              <i className="fa-solid fa-shield-halved text-2xl"></i>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">资源仓库管理系统</h1>
            <p className="text-slate-400 text-sm mt-2">请使用管理员凭据登录</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">用户名</label>
              <div className="relative">
                <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-700"
                  placeholder="请输入账号"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">密码</label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 text-xs font-bold px-4 py-3 rounded-lg flex items-center animate-fade-in">
                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                账号或密码错误，请重试
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center group"
            >
              登 录
              <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
            </button>
          </form>
        </div>
        <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">© 2024 Resource Warehouse Security Layer</p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default LoginForm;