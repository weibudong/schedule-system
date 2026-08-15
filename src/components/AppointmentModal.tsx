import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Appointment } from '../types';
import type { User } from '../context/UserContext';
import { provinces, cities } from '../data/locationData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  defaultDate?: string;
  users: User[];
  currentUser: User | null;
  onSave: (data: Partial<Appointment>) => void;
  onDelete?: (id: string) => void;
}

export default function AppointmentModal({ 
  isOpen, 
  onClose, 
  appointment, 
  defaultDate,
  users,
  currentUser,
  onSave,
  onDelete 
}: Props) {
  const [formData, setFormData] = useState({
    date: '',
    timePeriod: '上午',
    company: '',
    type: '面谈',
    teacherId: currentUser?.id || '',
    amount: 0,
    remark: '',
    status: '待审核',
    customerName: '',
    paymentStatus: '未回款',
    invoiceStatus: '未开票',
    invoiceDate: '',
    paymentDate: '',
    province: '',
    city: '',
  });

  const [isEditing, setIsEditing] = useState(false);

  const [errors, setErrors] = useState({
    customerName: '',
    amount: '',
  });

  const validate = () => {
    const newErrors = { customerName: '', amount: '' };
    let isValid = true;

    if (!formData.customerName.trim()) {
      newErrors.customerName = '客户名称为必填项';
      isValid = false;
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = '课程价格为必填项且必须大于0';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  useEffect(() => {
    if (appointment) {
      setFormData({
        date: appointment.date,
        timePeriod: appointment.timePeriod || '上午',
        company: appointment.company,
        type: appointment.type,
        teacherId: (appointment as any).teacherId || currentUser?.id || '',
        amount: appointment.amount,
        remark: appointment.remark || '',
        status: appointment.status || '待审核',
        customerName: appointment.customerName || appointment.company,
        paymentStatus: (appointment as any).paymentStatus || '未回款',
        invoiceStatus: (appointment as any).invoiceStatus || '未开票',
        invoiceDate: (appointment as any).invoiceDate || '',
        paymentDate: (appointment as any).paymentDate || '',
        province: (appointment as any).province || '',
        city: (appointment as any).city || '',
      });
      setIsEditing(false);
    } else if (defaultDate) {
      setFormData({
        date: defaultDate,
        timePeriod: '上午',
        company: '',
        type: '面谈',
        teacherId: currentUser?.id || '',
        amount: 0,
        remark: '',
        status: '待审核',
        customerName: '',
        paymentStatus: '未回款',
        invoiceStatus: '未开票',
        invoiceDate: '',
        paymentDate: '',
        province: '',
        city: '',
      });
      setIsEditing(false);
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        timePeriod: '上午',
        company: '',
        type: '面谈',
        teacherId: currentUser?.id || '',
        amount: 0,
        remark: '',
        status: '待审核',
        customerName: '',
        paymentStatus: '未回款',
        invoiceStatus: '未开票',
        invoiceDate: '',
        paymentDate: '',
        province: '',
        city: '',
      });
    }
  }, [appointment, defaultDate, currentUser]);

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      id: appointment?.id || '',
      ...formData,
    });
    onClose();
  };

  const handleDelete = () => {
    if (appointment?.id && onDelete) {
      onDelete(appointment.id);
      onClose();
    }
  };

  const handlePayment = () => {
    if (appointment?.id) {
      onSave({
        id: appointment.id,
        ...formData,
        paymentStatus: '已回款',
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  const timePeriods = ['上午', '下午', '晚上'];
  const types = ['面谈', '培训', '会议', '网络'];
  const statuses = ['待审核', '已确认', '已完成', '已取消'];
  const isLocked = formData.invoiceStatus === '已开票' || formData.paymentStatus === '已回款';
  const canEdit = currentUser?.role === 'admin' || formData.teacherId === currentUser?.id;
  const isFieldDisabled = isLocked || (!!appointment && (!isEditing || !canEdit));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white w-full sm:w-[400px] max-h-[calc(100vh-4rem)] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">
            {appointment ? `查看行程 No:${appointment.id}` : '添加行程'}
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">行程日期</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                disabled={isFieldDisabled}
                className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
              />
              <select
                value={formData.timePeriod}
                onChange={(e) => setFormData(prev => ({ ...prev, timePeriod: e.target.value }))}
                disabled={isFieldDisabled}
                className={`px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
              >
                {timePeriods.map((period) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">课程类型</span>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              disabled={isFieldDisabled}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
            >
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">执行人员</span>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
              disabled={isFieldDisabled}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">省份</span>
            <select
              value={formData.province}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, province: e.target.value, city: '' }));
              }}
              disabled={isFieldDisabled}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
            >
              <option value="">请选择省份</option>
              {provinces.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">城市</span>
            <select
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              disabled={isFieldDisabled || !formData.province}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled || !formData.province ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
            >
              <option value="">请选择城市</option>
              {(cities[formData.province] || []).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">客户名称</span>
            <div className="flex-1">
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, customerName: e.target.value }));
                  if (errors.customerName) setErrors(prev => ({ ...prev, customerName: '' }));
                }}
                disabled={isFieldDisabled}
                className={`w-full px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : (errors.customerName ? 'border-red-500' : 'border-gray-200')}`}
              />
              {errors.customerName && <span className="text-xs text-red-500 mt-1 block">{errors.customerName}</span>}
              {!errors.customerName && <span className="text-xs text-gray-400 mt-1 block">完善客户资料</span>}
            </div>
          </div>

          {(!appointment || canEdit) && (
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-20">课程价格</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">¥</span>
                  <input
                    type="number"
                    value={formData.amount || ''}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, amount: Number(e.target.value) }));
                      if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
                    }}
                    disabled={isFieldDisabled}
                    className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : (errors.amount ? 'border-red-500' : 'border-gray-200')}`}
                  />
                  <span className="text-gray-400">元</span>
                </div>
                {errors.amount && <span className="text-xs text-red-500 mt-1 block">{errors.amount}</span>}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-20">备注说明</span>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
              rows={4}
              placeholder="【预约人】&#10;【对应支行】&#10;【负责人】&#10;【其它】"
              disabled={isFieldDisabled}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm resize-none ${isFieldDisabled ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-200'}`}
            />
          </div>

          {appointment && (
            <div className="flex flex-col gap-2 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-20">当前状态</span>
                <div className="flex-1 flex gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formData.invoiceStatus === '已开票' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {formData.invoiceStatus}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formData.paymentStatus === '已回款' 
                      ? 'bg-green-100 text-green-700' 
                      : formData.paymentStatus === '未回款'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {formData.paymentStatus}
                  </span>
                </div>
              </div>
              {formData.invoiceDate && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 w-20"></span>
                  <span className="text-xs text-gray-400">开票日期: {formData.invoiceDate}</span>
                </div>
              )}
              {formData.paymentDate && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 w-20"></span>
                  <span className="text-xs text-gray-400">回款日期: {formData.paymentDate}</span>
                </div>
              )}
            </div>
          )}

          
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4">
          <div className="flex gap-2 flex-wrap">
            {appointment ? (
              <>
                {!isEditing && formData.invoiceStatus !== '已开票' && formData.paymentStatus !== '已回款' && (currentUser?.role === 'admin' || appointment?.teacherId === currentUser?.id) && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 min-w-[80px] py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    修改
                  </button>
                )}
                {isEditing && formData.invoiceStatus !== '已开票' && formData.paymentStatus !== '已回款' && (currentUser?.role === 'admin' || appointment?.teacherId === currentUser?.id) && (
                  <button
                    onClick={handleSubmit}
                    className="flex-1 min-w-[80px] py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    确认
                  </button>
                )}
                {currentUser?.role === 'admin' && (
                  <>
                    <button
                      onClick={() => {
                        onSave({
                          id: appointment.id,
                          ...formData,
                          invoiceStatus: '已开票',
                        });
                        onClose();
                      }}
                      disabled={formData.invoiceStatus === '已开票'}
                      className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-medium transition-colors ${
                        formData.invoiceStatus === '已开票'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      已开票
                    </button>
                    <button
                      onClick={() => {
                        onSave({
                          id: appointment.id,
                          ...formData,
                          paymentStatus: '已回款',
                        });
                        onClose();
                      }}
                      disabled={formData.paymentStatus === '已回款'}
                      className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-medium transition-colors ${
                        formData.paymentStatus === '已回款'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      已回款
                    </button>
                    {formData.paymentStatus !== '已回款' && (
                      <button
                        onClick={() => {
                          onSave({
                            id: appointment.id,
                            ...formData,
                            paymentStatus: '未回款',
                          });
                          onClose();
                        }}
                        disabled={formData.paymentStatus === '未回款'}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-medium transition-colors ${
                          formData.paymentStatus === '未回款'
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        未回款
                      </button>
                    )}
                  </>
                )}
                {onDelete && formData.invoiceStatus !== '已开票' && formData.paymentStatus !== '已回款' && (currentUser?.role === 'admin' || appointment?.teacherId === currentUser?.id) && (
                  <button
                    onClick={handleDelete}
                    className="flex-1 min-w-[80px] py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    删除
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 min-w-[80px] py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                确认
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
