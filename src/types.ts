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
  cashierId: string;
  amount: number;
  type: 'load' | 'payment';
  timestamp: string;
  description?: string;
}
