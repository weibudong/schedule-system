import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { performanceApi } from '../api';
import { useUser } from '../context/UserContext';
import type { PerformanceItem } from '../types';

export default function Performance() {
  const now = new Date();
  const currentYearStr = String(now.getFullYear());
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const [filterType, setFilterType] = useState('orderDate');
  const [startYear, setStartYear] = useState(currentYearStr);
  const [startMonth, setStartMonth] = useState(currentMonthStr);
  const [endYear, setEndYear] = useState(currentYearStr);
  const [endMonth, setEndMonth] = useState(currentMonthStr);
  const [typeFilter, setTypeFilter] = useState('全部');
  const [totalBonus, setTotalBonus] = useState(0);
  const [performanceList, setPerformanceList] = useState<PerformanceItem[]>([]);
  const [triggerSearch, setTriggerSearch] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [stats, setStats] = useState({
    paidCount: 0,
    unpaidCount: 0,
    invoicedCount: 0,
    uninvoicedCount: 0,
  });
  
  const { currentUser, selectedUserId, users, setSelectedUserId, logout } = useUser();

  useEffect(() => {
    const startDate = `${startYear}-${startMonth}-01`;
    const endDate = `${endYear}-${endMonth}-30`;
    performanceApi.get({ startDate, endDate, filterType, userId: selectedUserId, type: typeFilter }).then(res => {
      setTotalBonus(res.totalBonus);
      setPerformanceList(res.performanceList);
      setStats(res.stats || { paidCount: 0, unpaidCount: 0, invoicedCount: 0, uninvoicedCount: 0 });
    });
  }, [startYear, startMonth, endYear, endMonth, filterType, typeFilter, triggerSearch, selectedUserId]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString();
  };

  const filterOptions = [
    { value: 'orderDate', label: '按订单日期' },
    { value: 'invoiceDate', label: '按开票日期' },
    { value: 'paymentDate', label: '按回款日期' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-10">
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex justify-center items-center gap-8 py-2">
          <Link to="/" className="flex flex-col items-center text-gray-400">
            <span className="text-xs">当期工作</span>
          </Link>
          <Link to="/performance" className="flex flex-col items-center text-blue-600">
            <span className="text-xs">业绩详情</span>
            <div className="w-8 h-0.5 bg-blue-600 mt-1 rounded-full"></div>
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
        <div className="flex items-center justify-center px-4 py-3 gap-4">
          <div className="text-lg font-semibold">业绩详情</div>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-1 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="all">全部人员</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-1.5 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: 31 }, (_, i) => 2020 + i).map((y) => (
              <option key={y} value={String(y)}>{y}年</option>
            ))}
          </select>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m).padStart(2, '0')}>{m}月</option>
            ))}
          </select>
          <span className="text-gray-400">-</span>
          <select
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: 31 }, (_, i) => 2020 + i).map((y) => (
              <option key={y} value={String(y)}>{y}年</option>
            ))}
          </select>
          <select
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m).padStart(2, '0')}>{m}月</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="全部">全部类型</option>
            <option value="面谈">面谈</option>
            <option value="培训">培训</option>
            <option value="会议">会议</option>
            <option value="网络">网络</option>
          </select>

          <button
            onClick={() => setTriggerSearch(prev => !prev)}
            className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">合计金额</span>
            <span className="text-xl font-bold text-red-500">
              {formatAmount(totalBonus)}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xs text-green-600">已回款</div>
            <div className="text-lg font-bold text-green-700">{stats.paidCount}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-xs text-orange-600">未回款</div>
            <div className="text-lg font-bold text-orange-700">{stats.unpaidCount}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-600">已开票</div>
            <div className="text-lg font-bold text-blue-700">{stats.invoicedCount}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600">未开票</div>
            <div className="text-lg font-bold text-gray-700">{stats.uninvoicedCount}</div>
          </div>
        </div>
      </div>

      <div className="bg-white mx-4 rounded-lg shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-3 gap-2 px-4 py-3 border-b border-gray-100 text-xs text-gray-500">
          <div>客户名称</div>
          <div>开票时间</div>
          <div>回款时间</div>
        </div>
        {performanceList.map((item) => {
          const data = item as any;
          const isInvoiced = data.invoiceStatus === '已开票';
          const isNotInvoiced = !isInvoiced;
          const isPaid = data.paymentStatus === '已回款';
          const isNotPaid = !isPaid;
          const canViewAmount = currentUser?.role === 'admin' || item.userId === currentUser?.id;
          return (
            <div key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
              <div className="md:hidden px-4 py-3 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">客户名称</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-gray-800 font-medium">{(data.province || data.city) ? `${data.province || ''}${data.city || ''} ` : ''}{data.customerName || item.company} / {data.date} {data.timePeriod} / {data.type} / {data.teacher || '-'}{canViewAmount ? ` / ${formatAmount(item.amount)}` : ''}</span>
                    <div className="flex gap-1">
                      {isInvoiced && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">已开票</span>}
                      {isNotInvoiced && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">未开票</span>}
                      {isPaid && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">已回款</span>}
                      {isNotPaid && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">未回款</span>}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">开票时间</span>
                  <span className="text-sm text-gray-800">{data.invoiceDate || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">回款时间</span>
                  <span className="text-sm text-gray-800">{data.paymentDate || '-'}</span>
                </div>
              </div>
              <div className="hidden md:grid grid-cols-3 gap-2 px-4 py-3 items-center">
                <div className="text-sm text-gray-800">
                  <span>{(data.province || data.city) ? `${data.province || ''}${data.city || ''} ` : ''}{data.customerName || item.company} / {data.date} {data.timePeriod} / {data.type} / {data.teacher || '-'}{canViewAmount ? ` / ${formatAmount(item.amount)}` : ''}</span>
                  <div className="flex gap-1 mt-1">
                    {isInvoiced && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">已开票</span>}
                    {isNotInvoiced && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">未开票</span>}
                    {isPaid && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">已回款</span>}
                    {isNotPaid && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">未回款</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-800">{data.invoiceDate || '-'}</div>
                <div className="text-sm text-gray-800">{data.paymentDate || '-'}</div>
              </div>
            </div>
          );
        })}
        {performanceList.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400">
            暂无数据
          </div>
        )}
      </div>

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
    </div>
  );
}
