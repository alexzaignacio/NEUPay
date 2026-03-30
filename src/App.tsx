import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  addDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Transaction, UserRole } from './types';
import { 
  LayoutDashboard, 
  Wallet, 
  History, 
  LogOut, 
  PlusCircle, 
  User as UserIcon,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-zinc-50 flex items-center justify-center z-50">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-zinc-500 font-medium font-sans">Initializing EduPay...</p>
    </motion.div>
  </div>
);

const AuthScreen = ({ onRoleSelect }: { onRoleSelect: (role: UserRole) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (role: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // Create new profile
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          role: role,
          balance: 0,
          displayName: user.displayName || '',
          studentId: role === 'student' ? `STU-${Math.floor(100000 + Math.random() * 900000)}` : undefined
        };
        await setDoc(doc(db, 'users', user.uid), newProfile);
      } else {
        const existingRole = userDoc.data().role;
        if (existingRole !== role) {
          setError(`You are already registered as a ${existingRole}. Please login as ${existingRole}.`);
          await signOut(auth);
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-100/50 p-8 border border-zinc-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <CreditCard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">EduPay</h1>
          <p className="text-zinc-500 mt-2">Secure School Payment System</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => handleLogin('student')}
            disabled={loading}
            className="w-full py-4 px-6 bg-white border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50/30 rounded-2xl flex items-center justify-between transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <UserIcon className="w-5 h-5 text-zinc-600 group-hover:text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-zinc-900">Student Login</p>
                <p className="text-xs text-zinc-500">View balance & history</p>
              </div>
            </div>
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : <PlusCircle className="w-5 h-5 text-zinc-300 group-hover:text-indigo-600" />}
          </button>

          <button
            onClick={() => handleLogin('cashier')}
            disabled={loading}
            className="w-full py-4 px-6 bg-white border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50/30 rounded-2xl flex items-center justify-between transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <Wallet className="w-5 h-5 text-zinc-600 group-hover:text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-zinc-900">Cashier Login</p>
                <p className="text-xs text-zinc-500">Load student balances</p>
              </div>
            </div>
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : <PlusCircle className="w-5 h-5 text-zinc-300 group-hover:text-indigo-600" />}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          By logging in, you agree to our terms of service.
        </p>
      </motion.div>
    </div>
  );
};

const CashierDashboard = ({ profile }: { profile: UserProfile }) => {
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleLoadBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    setStatus(null);

    try {
      // Find student by studentId
      const q = query(collection(db, 'users'), where('studentId', '==', studentId), limit(1));
      const querySnapshot = await getDocs(q); // Need to import getDocs

      if (querySnapshot.empty) {
        throw new Error('Student ID not found');
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data() as UserProfile;

      // Atomic transaction
      await runTransaction(db, async (transaction) => {
        const sDoc = await transaction.get(studentDoc.ref);
        if (!sDoc.exists()) throw new Error("Student document does not exist!");

        const newBalance = (sDoc.data().balance || 0) + parseFloat(amount);
        
        // Update balance
        transaction.update(studentDoc.ref, { balance: newBalance });

        // Create transaction record
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          studentId: studentData.uid,
          cashierId: profile.uid,
          amount: parseFloat(amount),
          type: 'load',
          timestamp: new Date().toISOString(),
          description: `Balance load by ${profile.displayName}`
        });
      });

      setStatus({ type: 'success', message: `Successfully loaded ₱${amount} to ${studentData.displayName}` });
      setAmount('');
      setStudentId('');
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Transaction failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm"
          >
            <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <PlusCircle className="text-indigo-600 w-6 h-6" />
              Load Student Balance
            </h2>

            <form onSubmit={handleLoadBalance} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Student ID</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                      placeholder="e.g. STU-123456"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Amount (₱)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="1"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    required
                  />
                </div>
              </div>

              {status && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    "p-4 rounded-xl flex items-center gap-3 text-sm",
                    status.type === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                  )}
                >
                  {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {status.message}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                Process Payment
              </button>
            </form>
          </motion.div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
            <p className="text-indigo-100 text-sm font-medium mb-1">Cashier Session</p>
            <h3 className="text-lg font-bold mb-4">{profile.displayName}</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-indigo-200">Role</span>
                <span className="font-medium">Official Cashier</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-indigo-200">Terminal</span>
                <span className="font-medium">#001-MAIN</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StudentDashboard = ({ profile }: { profile: UserProfile }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('studentId', '==', profile.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(transData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Balance Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Wallet className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-indigo-100 font-medium mb-1">Current Balance</p>
              <h2 className="text-5xl font-black tracking-tighter">₱{profile.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl text-sm font-bold">
              {profile.studentId}
            </div>
          </div>
          <div className="flex gap-4">
            <button className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-colors">
              Request Load
            </button>
            <button className="bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-400 transition-colors">
              Pay Fees
            </button>
          </div>
        </div>
      </motion.div>

      {/* Transaction History */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2 px-2">
          <History className="w-6 h-6 text-zinc-400" />
          Recent Transactions
        </h3>

        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-zinc-400 font-medium">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      tx.type === 'load' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {tx.type === 'load' ? <PlusCircle className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{tx.type === 'load' ? 'Balance Loaded' : 'Payment Made'}</p>
                      <p className="text-xs text-zinc-400">{format(new Date(tx.timestamp), 'MMM dd, yyyy • hh:mm a')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-black",
                      tx.type === 'load' ? "text-green-600" : "text-zinc-900"
                    )}>
                      {tx.type === 'load' ? '+' : '-'}₱{tx.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-300">ID: {tx.id?.slice(-6)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch profile with real-time updates for balance
        const unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;

  if (!user || !profile) {
    return <AuthScreen onRoleSelect={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-zinc-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <CreditCard className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900">EduPay</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-zinc-900">{profile.displayName}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{profile.role}</span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-3 hover:bg-red-50 text-zinc-400 hover:text-red-600 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.main
          key={profile.role}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {profile.role === 'cashier' ? (
            <CashierDashboard profile={profile} />
          ) : (
            <StudentDashboard profile={profile} />
          )}
        </motion.main>
      </AnimatePresence>

      <footer className="py-12 text-center">
        <p className="text-zinc-300 text-xs font-medium uppercase tracking-widest">
          © 2026 EduPay • Secure Campus Financials
        </p>
      </footer>
    </div>
  );
}
