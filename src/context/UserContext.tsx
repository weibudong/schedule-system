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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('1');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setSelectedUserId(user.id);
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
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