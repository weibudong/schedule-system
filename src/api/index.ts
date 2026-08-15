import type { CalendarResponse, PerformanceResponse } from '../types';

const BASE_URL = '/api';

export const calendarApi = {
  get: async (month?: string, userId = '1'): Promise<CalendarResponse> => {
    const params = new URLSearchParams({ userId });
    if (month) params.set('month', month);
    const res = await fetch(`${BASE_URL}/calendar?${params}`);
    return res.json();
  },
  create: async (data: { 
    date: string; 
    timePeriod: string;
    company: string; 
    type: string; 
    teacherId: string;
    amount: number;
    remark: string;
    status: string;
    customerName: string;
    userId?: string 
  }) => {
    const res = await fetch(`${BASE_URL}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, userId: data.userId || '1' }),
    });
    return res.json();
  },
  update: async (id: string, data: { 
    date?: string; 
    timePeriod?: string;
    company?: string; 
    type?: string; 
    teacherId?: string;
    amount?: number;
    remark?: string;
    status?: string;
    customerName?: string;
  }) => {
    const res = await fetch(`${BASE_URL}/calendar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (id: string) => {
    const res = await fetch(`${BASE_URL}/calendar/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};

export const performanceApi = {
  get: async (params: {
    startDate?: string;
    endDate?: string;
    filterType?: string;
    userId?: string;
    type?: string;
  }): Promise<PerformanceResponse> => {
    const searchParams = new URLSearchParams({
      userId: params.userId || '1',
      filterType: params.filterType || 'orderDate',
    });
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.type) searchParams.set('type', params.type);
    const res = await fetch(`${BASE_URL}/performance?${searchParams}`);
    return res.json();
  },
};

export const userApi = {
  create: async (data: { name: string; phone: string; password: string }) => {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
