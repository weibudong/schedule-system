import { useState } from 'react';
import { useUser } from '../context/UserContext';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!phone || !password) {
      setError('请输入手机号和密码');
      return;
    }

    const success = await login(phone, password);
    if (!success) {
      setError('手机号或密码错误');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">日程系统</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入手机号"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div className="mb-4 text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            登录
          </button>
        </form>

        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>管理员：手机号 111，密码 123</p>
          <p>业务员：手机号 222，密码 123</p>
        </div>
      </div>
    </div>
  );
}