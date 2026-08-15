import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; phone: string; password: string }) => Promise<boolean | undefined> | boolean | undefined;
}

export default function AddUserModal({ isOpen, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ name: '', phone: '', password: '' });

  const validate = () => {
    const newErrors = { name: '', phone: '', password: '' };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = '姓名为必填项';
      isValid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = '手机号为必填项';
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = '密码为必填项';
      isValid = false;
    } else if (password.length < 3) {
      newErrors.password = '密码长度不能少于3位';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const result = await onSubmit({ name, phone, password });
    if (result !== false) {
      setName('');
      setPhone('');
      setPassword('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white w-full sm:w-[400px] max-h-[calc(100vh-4rem)] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">新增人员</div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">姓名</span>
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="请输入姓名"
                className={`w-full px-3 py-1.5 border rounded-lg text-sm ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
              />
              {errors.name && <span className="text-xs text-red-500 mt-1 block">{errors.name}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">手机号</span>
            <div className="flex-1">
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                placeholder="请输入手机号"
                className={`w-full px-3 py-1.5 border rounded-lg text-sm ${errors.phone ? 'border-red-500' : 'border-gray-200'}`}
              />
              {errors.phone && <span className="text-xs text-red-500 mt-1 block">{errors.phone}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">密码</span>
            <div className="flex-1">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                }}
                placeholder="请输入密码"
                className={`w-full px-3 py-1.5 border rounded-lg text-sm ${errors.password ? 'border-red-500' : 'border-gray-200'}`}
              />
              {errors.password && <span className="text-xs text-red-500 mt-1 block">{errors.password}</span>}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 min-w-[80px] py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 min-w-[80px] py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}