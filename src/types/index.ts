export interface Appointment {
  id: string;
  userId: string;
  date: string;
  timePeriod: string;
  company: string;
  type: string;
  teacherId: string;
  amount: number;
  remark: string;
  status: string;
  customerName: string;
  paymentStatus: string;
  invoiceStatus: string;
  invoiceDate?: string;
  paymentDate?: string;
  province?: string;
  city?: string;
}

export interface CalendarSummary {
  totalAmount: number;
  interviewCount: number;
  trainingCount: number;
  meetingCount: number;
  onlineCount: number;
  totalCount: number;
  userName: string;
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

export interface CalendarResponse {
  appointments: Appointment[];
  summary: CalendarSummary;
}

export interface PerformanceResponse {
  totalBonus: number;
  performanceList: PerformanceItem[];
  stats: {
    paidCount: number;
    unpaidCount: number;
    invoicedCount: number;
    uninvoicedCount: number;
  };
}
