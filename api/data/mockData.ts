export interface User {
  id: string;
  name: string;
  role: string;
}

export interface Appointment {
  id: string;
  userId: string;
  date: string;
  timePeriod: string;
  company: string;
  type: string;
  teacher: string;
  amount: number;
  remark: string;
  status: string;
  customerName: string;
}

export interface CalendarSummary {
  totalAmount: number;
  interviewCount: number;
  trainingCount: number;
  meetingCount: number;
  onlineCount: number;
  totalCount: number;
  userName: string;
  unpaiedCount: number;
}

export interface OverdueItem {
  id: string;
  userId: string;
  company: string;
  count: number;
  amount: number;
  overdueType: string;
  periods: Array<{ label: string; count: number; amount: number }>;
}

export interface PerformanceItem {
  id: string;
  userId: string;
  orderDate: string;
  invoiceDate: string;
  paymentDate: string;
  amount: number;
  bonus: number;
  company: string;
}

export const users: User[] = [
  { id: '1', name: '兰天翔', role: 'sales' },
  { id: '2', name: '管理员', role: 'admin' },
];

export const appointments: Appointment[] = [
  { id: '1', userId: '1', date: '2026-06-02', timePeriod: '上午', company: '成都安盛', type: '面谈', teacher: '兰天翔', amount: 10000, remark: '', status: '待审核', customerName: '四川成都安盛' },
  { id: '2', userId: '1', date: '2026-06-03', timePeriod: '上午', company: '成都安盛', type: '面谈', teacher: '兰天翔', amount: 12000, remark: '', status: '待审核', customerName: '四川成都安盛' },
  { id: '3', userId: '1', date: '2026-06-04', timePeriod: '下午', company: '成都安盛', type: '面谈', teacher: '兰天翔', amount: 8000, remark: '', status: '待审核', customerName: '四川成都安盛' },
  { id: '4', userId: '1', date: '2026-06-05', timePeriod: '上午', company: '襄阳国寿', type: '面谈', teacher: '兰天翔', amount: 15000, remark: '', status: '待审核', customerName: '湖北襄阳国寿' },
  { id: '5', userId: '1', date: '2026-06-06', timePeriod: '下午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 18000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '6', userId: '1', date: '2026-06-07', timePeriod: '上午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '7', userId: '1', date: '2026-06-08', timePeriod: '下午', company: '武汉太平', type: '面谈', teacher: '兰天翔', amount: 20000, remark: '', status: '待审核', customerName: '湖北武汉太平' },
  { id: '8', userId: '1', date: '2026-06-09', timePeriod: '上午', company: '广州生命', type: '面谈', teacher: '兰天翔', amount: 15000, remark: '', status: '待审核', customerName: '广东广州生命' },
  { id: '9', userId: '1', date: '2026-06-10', timePeriod: '下午', company: '昆明安盛', type: '面谈', teacher: '兰天翔', amount: 12000, remark: '', status: '待审核', customerName: '云南昆明安盛' },
  { id: '10', userId: '1', date: '2026-06-11', timePeriod: '上午', company: '东莞建信', type: '面谈', teacher: '兰天翔', amount: 10000, remark: '', status: '待审核', customerName: '广东东莞建信' },
  { id: '11', userId: '1', date: '2026-06-12', timePeriod: '下午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 8000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '12', userId: '1', date: '2026-06-13', timePeriod: '上午', company: '梅州建信', type: '面谈', teacher: '兰天翔', amount: 6000, remark: '', status: '待审核', customerName: '广东梅州建信' },
  { id: '13', userId: '1', date: '2026-06-14', timePeriod: '下午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 14000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '14', userId: '1', date: '2026-06-15', timePeriod: '上午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 16000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '15', userId: '1', date: '2026-06-15', timePeriod: '下午', company: '广州生命', type: '面谈', teacher: '兰天翔', amount: 12000, remark: '', status: '待审核', customerName: '广东广州生命' },
  { id: '16', userId: '1', date: '2026-06-16', timePeriod: '上午', company: '上海建信', type: '面谈', teacher: '兰天翔', amount: 20000, remark: '', status: '待审核', customerName: '上海上海建信' },
  { id: '17', userId: '1', date: '2026-06-17', timePeriod: '下午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 10000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '18', userId: '1', date: '2026-06-24', timePeriod: '上午', company: '广州生命', type: '面谈', teacher: '兰天翔', amount: 15000, remark: '', status: '待审核', customerName: '广东广州生命' },
  { id: '19', userId: '1', date: '2026-06-25', timePeriod: '下午', company: '武汉人保', type: '面谈', teacher: '兰天翔', amount: 8800, remark: '', status: '待审核', customerName: '湖北武汉人保' },
  { id: '20', userId: '1', date: '2026-06-08', timePeriod: '上午', company: '武汉太平', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '湖北武汉太平' },
  { id: '21', userId: '1', date: '2026-06-09', timePeriod: '下午', company: '广州生命', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '广东广州生命' },
  { id: '22', userId: '1', date: '2026-06-10', timePeriod: '上午', company: '昆明安盛', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '云南昆明安盛' },
  { id: '23', userId: '1', date: '2026-06-11', timePeriod: '下午', company: '东莞建信', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '广东东莞建信' },
  { id: '24', userId: '1', date: '2026-06-12', timePeriod: '上午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '25', userId: '1', date: '2026-06-13', timePeriod: '下午', company: '梅州建信', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '广东梅州建信' },
  { id: '26', userId: '1', date: '2026-06-14', timePeriod: '上午', company: '武汉生命', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
  { id: '27', userId: '1', date: '2026-06-16', timePeriod: '下午', company: '上海建信', type: '面谈', teacher: '兰天翔', amount: 5000, remark: '', status: '待审核', customerName: '上海上海建信' },
];

export const overdueItems: OverdueItem[] = [
  {
    id: '1',
    userId: '1',
    company: '深圳深圳保诚',
    count: 5,
    amount: 97500,
    overdueType: '超半年',
    periods: [{ label: '超半年', count: 5, amount: 97500 }],
  },
  {
    id: '2',
    userId: '1',
    company: '广东珠海建信',
    count: 15,
    amount: 180600,
    overdueType: '超半年',
    periods: [{ label: '超半年', count: 15, amount: 180600 }],
  },
  {
    id: '3',
    userId: '1',
    company: '广东惠州建信',
    count: 2,
    amount: 25100,
    overdueType: '超半年',
    periods: [{ label: '超半年', count: 2, amount: 25100 }],
  },
  {
    id: '4',
    userId: '1',
    company: '广东肇庆建信',
    count: 1,
    amount: 25000,
    overdueType: '超半年',
    periods: [{ label: '超半年', count: 1, amount: 25000 }],
  },
  {
    id: '5',
    userId: '1',
    company: '上海上海安盛',
    count: 14,
    amount: 141000,
    overdueType: '超半年',
    periods: [{ label: '超半年', count: 14, amount: 141000 }],
  },
  {
    id: '6',
    userId: '1',
    company: '广东广州建信',
    count: 1,
    amount: 25000,
    overdueType: '半年内',
    periods: [{ label: '半年内', count: 1, amount: 25000 }],
  },
  {
    id: '7',
    userId: '1',
    company: '上海上海建信',
    count: 5,
    amount: 62500,
    overdueType: '混合',
    periods: [
      { label: '一月内', count: 3, amount: 37500 },
      { label: '三月内', count: 1, amount: 12500 },
      { label: '半年内', count: 1, amount: 12500 },
    ],
  },
  {
    id: '8',
    userId: '1',
    company: '浙江衢州建信',
    count: 1,
    amount: 25000,
    overdueType: '三月内',
    periods: [{ label: '三月内', count: 1, amount: 25000 }],
  },
  {
    id: '9',
    userId: '1',
    company: '浙江丽水建信',
    count: 2,
    amount: 50000,
    overdueType: '三月内',
    periods: [{ label: '三月内', count: 2, amount: 50000 }],
  },
];

export const performanceItems: PerformanceItem[] = [
  { id: '1', userId: '1', orderDate: '2026-06-01', invoiceDate: '2026-06-05', paymentDate: '2026-06-10', amount: 10000, bonus: 500, company: '客户A' },
  { id: '2', userId: '1', orderDate: '2026-06-02', invoiceDate: '2026-06-06', paymentDate: '2026-06-12', amount: 20000, bonus: 1000, company: '客户B' },
  { id: '3', userId: '1', orderDate: '2026-06-03', invoiceDate: '2026-06-08', paymentDate: '2026-06-15', amount: 15000, bonus: 750, company: '客户C' },
  { id: '4', userId: '1', orderDate: '2026-06-05', invoiceDate: '2026-06-10', paymentDate: '2026-06-18', amount: 25000, bonus: 1250, company: '客户D' },
  { id: '5', userId: '1', orderDate: '2026-06-08', invoiceDate: '2026-06-12', paymentDate: '2026-06-20', amount: 30000, bonus: 1500, company: '客户E' },
];
