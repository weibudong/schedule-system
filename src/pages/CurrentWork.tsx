import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, UserPlus, Database, Upload } from 'lucide-react';
import { calendarApi, userApi } from '../api';
import { useUser } from '../context/UserContext';
import type { Appointment, CalendarSummary } from '../types';
import AppointmentModal from '../components/AppointmentModal';
import AddUserModal from '../components/AddUserModal';

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function CurrentWork() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [defaultDate, setDefaultDate] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { currentUser, selectedUserId, users, setSelectedUserId, logout } = useUser();
  const isSpecialUser = currentUser?.phone === '13026151270';

  useEffect(() => {
    const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    calendarApi.get(monthStr, selectedUserId).then(res => {
      setAppointments(res.appointments);
      setSummary(res.summary);
    });
  }, [currentDate, selectedUserId]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: Array<{ date: number; fullDate: string; isCurrentMonth: boolean }> = [];
    
    const startPadding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = startPadding; i > 0; i--) {
      const prevMonthDate = new Date(year, month, -i + 1);
      days.push({
        date: prevMonthDate.getDate(),
        fullDate: `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`,
        isCurrentMonth: false,
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true,
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      days.push({
        date: i,
        fullDate: `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const getAppointmentsForDate = (fullDate: string) => {
    return appointments.filter(a => a.date === fullDate);
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString();
  };

  const refreshData = () => {
    const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    calendarApi.get(monthStr, selectedUserId).then(res => {
      setAppointments(res.appointments);
      setSummary(res.summary);
    });
  };

  const handleAdd = () => {
    setSelectedAppointment(null);
    const today = new Date();
    setDefaultDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setIsModalOpen(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDefaultDate('');
    setIsModalOpen(true);
  };

  const handleSave = (data: Partial<Appointment>) => {
    if (data.id) {
      calendarApi.update(data.id, data).then(() => {
        refreshData();
      });
    } else {
      calendarApi.create({ ...data, userId: selectedUserId } as any).then(() => {
        refreshData();
      });
    }
  };

  const handleDelete = (id: string) => {
    calendarApi.delete(id).then(() => {
      refreshData();
    });
  };

  const handleAddUser = async (data: { name: string; phone: string; password: string }) => {
    const res = await userApi.create(data);
    if (res.success) {
      window.location.reload();
      return true;
    } else {
      alert(res.message || '添加失败');
      return false;
    }
  };

  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const details = data.details || {};
        const parts = [];
        if (details.emailSent) parts.push('✅ 邮件已发送');
        if (details.jsonExported) parts.push('✅ 数据已导出JSON');
        if (details.dbCopied) parts.push('✅ 数据库已复制');
        const errorMsg = (details.errors || []).filter((e: string) => !e.includes('disabled'));
        if (errorMsg.length > 0) {
          alert(`备份完成，但有部分失败：\n\n${parts.join('\n')}\n\n⚠️ ${errorMsg.join('\n')}`);
        } else {
          alert(`备份成功！\n\n${parts.join('\n')}`);
        }
      } else {
        alert('备份失败：' + (data.error || '未知错误'));
      }
    } catch (error) {
      alert('备份请求失败，请检查网络连接');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.db')) {
      alert('请选择 .db 数据库文件');
      e.target.value = '';
      return;
    }

    // 确认上传
    if (!confirm(`确定要上传数据库文件 "${file.name}" 吗？\n这将覆盖生产环境的数据库！`)) {
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      // 读取文件为 Base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dbFile = event.target?.result as string;
        
        try {
          console.log('[Upload] 准备上传文件:', file.name, '大小:', file.size, 'bytes');
          
          const res = await fetch('/api/backup/upload-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dbFile: dbFile.split(',')[1] || dbFile,
              fileName: file.name
            })
          });
          
          console.log('[Upload] 响应状态:', res.status);
          const data = await res.json();
          console.log('[Upload] 响应数据:', data);
          
          if (res.ok && data.success) {
            const sizeMB = (data.details?.fileSize / 1024 / 1024).toFixed(2);
            alert(`✅ 数据库上传成功！\n\n文件大小：${sizeMB}MB\n文件名：${data.details?.fileName}\n\n请刷新页面查看更新后的数据。`);
            refreshData();
          } else {
            alert(`❌ 上传失败（状态码: ${res.status}）\n\n错误信息：${data.error || '未知错误'}`);
          }
        } catch (error) {
          console.error('[Upload] 请求失败:', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          alert(`❌ 上传请求失败\n\n错误信息：${errorMsg}\n\n请确保：\n1. 后端服务已启动\n2. /api/backup/upload-db 接口存在\n3. 网络连接正常`);
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        alert('❌ 读取文件失败，请重试');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('❌ 读取文件失败');
      setIsUploading(false);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-10">
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex justify-center items-center gap-8 py-2">
          <Link to="/" className="flex flex-col items-center text-blue-600">
            <span className="text-xs">当期工作</span>
            <div className="w-8 h-0.5 bg-blue-600 mt-1 rounded-full"></div>
          </Link>
          <Link to="/performance" className="flex flex-col items-center text-gray-400">
            <span className="text-xs">业绩详情</span>
          </Link>
          <div
            onClick={() => setShowLogoutConfirm(true)}
            className="flex flex-col items-center text-gray-400 cursor-pointer hover:text-gray-600"
          >
            <span className="text-xs">{currentUser?.name}</span>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={prevMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-lg font-semibold">
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
          </div>
          <button 
            onClick={nextMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-1 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="all">所有人</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
            <button 
              onClick={handleAdd}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus className="w-5 h-5" />
            </button>
            {currentUser?.role === 'admin' && (
              <>
                {isSpecialUser && (
                  <button 
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    className={`p-2 rounded-lg ${isBackingUp ? 'text-gray-400 bg-gray-100' : 'text-purple-600 hover:bg-purple-50'}`}
                    title="备份数据到邮箱"
                  >
                    <Database className="w-5 h-5" />
                  </button>
                )}
                {isSpecialUser && (
                  <button 
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className={`p-2 rounded-lg ${isUploading ? 'text-gray-400 bg-gray-100' : 'text-orange-600 hover:bg-orange-50'}`}
                    title="上传数据库文件更新数据"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                )}
                {isSpecialUser && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".db"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                )}
                <button 
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 px-4 py-2 bg-gray-100">
        {weekDays.map((day) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-2 ${
              day === '周六' || day === '周日' ? 'text-red-500' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-4 py-2">
        {getDaysInMonth().map((day, index) => {
          const dayAppointments = getAppointmentsForDate(day.fullDate);
          const isToday = new Date().toDateString() === new Date(day.fullDate).toDateString();
          const isWeekend = index % 7 === 5 || index % 7 === 6;
          
          return (
            <div
              key={day.fullDate}
              className={`min-h-[80px] p-1 border border-gray-100 rounded-lg ${
                day.isCurrentMonth
                  ? isToday
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white'
                  : 'bg-gray-50'
              }`}
            >
              <div
                className={`text-xs text-center py-1 ${
                  !day.isCurrentMonth
                    ? 'text-gray-300'
                    : isWeekend
                    ? 'text-red-500'
                    : 'text-gray-700'
                }`}
              >
                {day.date}
              </div>
              <div className="space-y-1">
                {dayAppointments.map((app) => {
                  const isPaid = (app as any).paymentStatus === '已回款';
                  return (
                    <div
                      key={app.id}
                      onClick={() => handleEdit(app)}
                      className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer transition-colors ${
                        isPaid
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 active:bg-green-300'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300'
                      }`}
                    >
                      {(app.province || app.city) ? `${app.province || ''}${app.city || ''} ` : ''}{app.customerName || app.company}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {summary && (
        <div className="bg-white mx-4 mt-4 rounded-lg shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">当月预约汇总</span>
            <span className="text-lg font-bold text-orange-500">
              {formatAmount(summary.totalAmount)}元
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 px-4 py-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">面谈</div>
              <div className="text-lg font-bold text-blue-600">{summary.interviewCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">培训</div>
              <div className="text-lg font-bold text-green-600">{summary.trainingCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">会议</div>
              <div className="text-lg font-bold text-purple-600">{summary.meetingCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">网络</div>
              <div className="text-lg font-bold text-orange-600">{summary.onlineCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">总数</div>
              <div className="text-lg font-bold text-gray-800">{summary.totalCount}</div>
            </div>
          </div>
        </div>
      )}

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        defaultDate={defaultDate}
        users={users}
        currentUser={currentUser}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-4 w-full max-w-sm">
            <div className="text-lg font-medium text-gray-800 mb-2">确认退出</div>
            <div className="text-gray-500 text-sm mb-6">确定要退出登录吗？</div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  logout();
                  setShowLogoutConfirm(false);
                }}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSubmit={handleAddUser}
      />
    </div>
  );
}
