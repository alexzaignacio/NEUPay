export type UserRole = 'cashier' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  balance: number;
  studentId?: string;
  displayName?: string;
}

export interface Transaction {
  id?: string;
  studentId: string;
  cashierId?: string;
  amount: number;
  type: 'load' | 'payment';
  timestamp: string;
  description?: string;
}

export interface TopupRequest {
  id?: string;
  studentId: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface LoadRequest {
  id?: string;
  studentId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface Fee {
  id: string;
  name: string;
  amount: number;
}
