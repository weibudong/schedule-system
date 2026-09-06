import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'sales';
}

export interface UserContextType {
  currentUser: User | null;
  selectedUserId: string;
  users: User[];
  login: (phone: string, password: string) => Promise<boolean>;
  logout: () => void;
  setSelectedUserId: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  // 同步从 localStorage 恢复登录态，避免首帧 currentUser 为 null
  // 导致受保护路由先跳 /login、登录态恢复后又跳回 / 的问题（深层链接失效）
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      localStorage.removeItem('currentUser');
      return null;
    }
  });
  const [selectedUserId, setSelectedUserId] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      return savedUser?.id || '1';
    } catch {
      return '1';
    }
  });
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users/list');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const login = async (phone: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setSelectedUserId(data.user.id);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setSelectedUserId('1');
    localStorage.removeItem('currentUser');
  };

  return (
    <UserContext.Provider value={{ currentUser, selectedUserId, users, login, logout, setSelectedUserId }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};