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
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { auth, db } from './firebase';
import { UserProfile, Transaction, UserRole, TopupRequest, Fee, LoadRequest } from './types';
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
  Search,
  QrCode,
  Check,
  Users,
  BarChart,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { QRCodeCanvas } from 'qrcode.react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const RequestLoadModal = ({ isOpen, onClose, profile }: { isOpen: boolean, onClose: () => void, profile: UserProfile }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    try {
      const now = new Date();
      const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      const docRef = await addDoc(collection(db, 'load_requests'), {
        studentId: profile.uid,
        studentName: profile.displayName || 'Unknown Student',
        amount: parseFloat(amount),
        status: 'pending',
        createdAt: now.toISOString(),
        expiryDate: expiry.toISOString()
      });
      setRequestId(docRef.id);
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setRequestId(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        {!success ? (
          <>
            <h2 className="text-2xl font-bold mb-6">Request Load</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Amount (₱)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-1">Payment Method</p>
                <p className="text-sm font-medium text-indigo-900">Cashier Over-the-Counter</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={handleClose}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Request Successful</h2>
            <p className="text-zinc-500 mb-6 text-sm">Your request for ₱{parseFloat(amount).toLocaleString()} has been submitted. Present your ID to the cashier to process your load.</p>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white border-4 border-indigo-600 rounded-3xl shadow-xl">
                <QRCodeCanvas value={requestId || ''} size={180} />
              </div>
            </div>

            <div className="bg-zinc-50 p-3 rounded-xl mb-6 flex items-center justify-center gap-2">
              <span className="text-xs font-mono text-zinc-400">ID: {requestId}</span>
            </div>
            <button 
              onClick={handleClose}
              className="w-full py-4 bg-zinc-900 hover:bg-black text-white font-bold rounded-2xl transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const PayFeesModal = ({ isOpen, onClose, profile }: { isOpen: boolean, onClose: () => void, profile: UserProfile }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fees: Fee[] = [
    { id: 'tuition', name: 'Tuition Fee', amount: 5000 },
    { id: 'lab', name: 'Laboratory Fee', amount: 1500 },
    { id: 'misc', name: 'Miscellaneous Fee', amount: 800 },
  ];

  const handlePay = async (fee: Fee) => {
    if (profile.balance < fee.amount) {
      setError('Insufficient balance');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) throw new Error("User not found");
        
        const currentBalance = userDoc.data().balance || 0;
        if (currentBalance < fee.amount) {
          throw new Error("Insufficient balance");
        }

        transaction.update(userRef, { balance: currentBalance - fee.amount });

        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          studentId: profile.uid,
          amount: fee.amount,
          type: 'payment',
          timestamp: new Date().toISOString(),
          description: `Paid ${fee.name}`
        });
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-6">Pay School Fees</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        <div className="space-y-3">
          {fees.map(fee => (
            <div key={fee.id} className="p-4 border border-zinc-100 rounded-2xl flex items-center justify-between hover:bg-zinc-50 transition-colors">
              <div>
                <p className="font-bold text-zinc-900">{fee.name}</p>
                <p className="text-sm text-zinc-500">₱{fee.amount.toLocaleString()}</p>
              </div>
              <button 
                onClick={() => handlePay(fee)}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Pay
              </button>
            </div>
          ))}
        </div>
        <button 
          onClick={onClose}
          className="w-full mt-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
};

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
  const navigate = useNavigate();

  const handleLogin = async (role: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log('Login Successful, fetching role for UID:', user.uid);
      
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
        console.log('User Role Found (New):', role);
        
        if (role === 'cashier') {
          navigate('/cashier-dashboard');
        } else if (role === 'student') {
          navigate('/student-dashboard');
        } else {
          throw new Error('Unauthorized Access: Invalid role selected.');
        }
      } else {
        const profileData = userDoc.data() as UserProfile;
        const existingRole = profileData.role;
        console.log('User Role Found:', existingRole);

        if (!existingRole) {
          setError('Unauthorized Access: Role not defined for this account.');
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (existingRole !== role) {
          setError(`Unauthorized Access: You are registered as a ${existingRole}. Please login as ${existingRole}.`);
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (existingRole === 'cashier') {
          navigate('/cashier-dashboard');
        } else if (existingRole === 'student') {
          navigate('/student-dashboard');
        } else {
          setError('Unauthorized Access: Unknown role.');
          await signOut(auth);
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 relative">
      {/* Full-screen Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center"
          >
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-600" />
              <div className="absolute inset-0 blur-2xl bg-indigo-400/20 animate-pulse rounded-full" />
            </div>
            <p className="mt-6 text-zinc-900 font-black text-2xl tracking-tighter animate-bounce">
              Verifying Identity...
            </p>
            <p className="text-zinc-400 text-sm font-medium">Please wait while we secure your session</p>
          </motion.div>
        )}
      </AnimatePresence>
      
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

  // QR Request Processing
  const [qrRequestId, setQrRequestId] = useState('');
  const [pendingRequest, setPendingRequest] = useState<{ id: string, student: UserProfile, request: LoadRequest } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Real-time Pending Requests List
  const [pendingRequests, setPendingRequests] = useState<LoadRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Summary Stats
  const [stats, setStats] = useState({ pending: 0, total: 0 });

  // Student Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Global Transaction History
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    console.log('Initializing Cashier Dashboard for:', profile.uid);
    
    // Pending Requests listener
    const qPending = query(
      collection(db, 'load_requests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoadRequest));
      setPendingRequests(requests);
      setStats(prev => ({ ...prev, pending: requests.length }));
      setRequestsLoading(false);
    });

    // Total Requests listener (to get total count)
    const qTotal = query(collection(db, 'load_requests'));
    const unsubTotal = onSnapshot(qTotal, (snapshot) => {
      setStats(prev => ({ ...prev, total: snapshot.size }));
    });

    // Global Transactions listener
    const qTrans = query(
      collection(db, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const trans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setAllTransactions(trans);
    });

    return () => {
      unsubPending();
      unsubTotal();
      unsubTrans();
    };
  }, [profile.uid]);

  // Handle Student Search
  useEffect(() => {
    const searchStudents = async () => {
      if (searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        // Search by Student ID
        const qId = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('studentId', '>=', searchQuery.toUpperCase()),
          where('studentId', '<=', searchQuery.toUpperCase() + '\uf8ff'),
          limit(5)
        );
        
        // Search by Name (Case-sensitive in Firestore, so we'll do a simple prefix)
        const qName = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff'),
          limit(5)
        );
        
        const [snapId, snapName] = await Promise.all([getDocs(qId), getDocs(qName)]);
        
        const resultsMap = new Map<string, UserProfile>();
        snapId.docs.forEach(doc => resultsMap.set(doc.id, doc.data() as UserProfile));
        snapName.docs.forEach(doc => resultsMap.set(doc.id, doc.data() as UserProfile));
        
        setSearchResults(Array.from(resultsMap.values()));
      } catch (err) {
        console.error('Search Error:', err);
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(searchStudents, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleFetchRequest = async (id?: string) => {
    const targetId = id || qrRequestId;
    if (!targetId) return;
    setQrLoading(true);
    setStatus(null);
    console.log('Fetching Request ID:', targetId);
    try {
      const requestDoc = await getDoc(doc(db, 'load_requests', targetId));
      if (!requestDoc.exists()) throw new Error('Request not found');
      
      const requestData = requestDoc.data() as LoadRequest;
      if (requestData.status !== 'pending') throw new Error('Request already processed');

      // Expiry check
      if (new Date(requestData.expiryDate) < new Date()) {
        throw new Error('This request has expired (14-day limit)');
      }

      const studentDoc = await getDoc(doc(db, 'users', requestData.studentId));
      if (!studentDoc.exists()) throw new Error('Student profile not found');

      setPendingRequest({
        id: requestDoc.id,
        student: studentDoc.data() as UserProfile,
        request: requestData
      });
      console.log('Request Fetched Successfully:', requestDoc.id);
    } catch (err: any) {
      console.error('Fetch Request Error:', err);
      setStatus({ type: 'error', message: err.message || 'Failed to fetch request' });
    } finally {
      setQrLoading(false);
    }
  };

  const handleProcessRequest = async (approved: boolean) => {
    if (!pendingRequest) return;
    setLoading(true);
    console.log(`Processing Transaction: ${approved ? 'APPROVE' : 'DISAPPROVE'} for ${pendingRequest.id}`);
    try {
      await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, 'users', pendingRequest.student.uid);
        const requestRef = doc(db, 'load_requests', pendingRequest.id);
        
        const sDoc = await transaction.get(studentRef);
        const rDoc = await transaction.get(requestRef);

        if (!sDoc.exists() || !rDoc.exists()) throw new Error("Document missing");
        if (rDoc.data().status !== 'pending') throw new Error("Already processed");

        if (approved) {
          const newBalance = (sDoc.data().balance || 0) + pendingRequest.request.amount;
          transaction.update(studentRef, { balance: newBalance });
          transaction.update(requestRef, { status: 'approved' });

          const transRef = doc(collection(db, 'transactions'));
          transaction.set(transRef, {
            studentId: pendingRequest.student.uid,
            studentName: pendingRequest.student.displayName,
            cashierId: profile.uid,
            amount: pendingRequest.request.amount,
            type: 'load',
            timestamp: new Date().toISOString(),
            description: `QR Load approved for ${pendingRequest.student.displayName}`
          });
        } else {
          transaction.update(requestRef, { status: 'disapproved' });
        }
      });

      console.log('Transaction Status: SUCCESS');
      setStatus({ 
        type: approved ? 'success' : 'error', 
        message: approved ? `Approved ₱${pendingRequest.request.amount} for ${pendingRequest.student.displayName}` : `Disapproved request for ${pendingRequest.student.displayName}`
      });
      setPendingRequest(null);
      setQrRequestId('');
    } catch (err: any) {
      console.error('Transaction Status: FAILED', err);
      setStatus({ type: 'error', message: err.message || 'Transaction failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = () => handleProcessRequest(true);
  const handleDisapproveRequest = () => handleProcessRequest(false);

  const handleLoadBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    setStatus(null);

    try {
      // Find student by studentId
      const q = query(collection(db, 'users'), where('studentId', '==', studentId), limit(1));
      const querySnapshot = await getDocs(q);

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
          studentName: studentData.displayName,
          cashierId: profile.uid,
          amount: parseFloat(amount),
          type: 'load',
          timestamp: new Date().toISOString(),
          description: `Manual load for ${studentData.displayName}`
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
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Requests</p>
            <p className="text-2xl font-black text-zinc-900">{stats.pending}</p>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center">
            <BarChart className="w-6 h-6 text-zinc-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Requests</p>
            <p className="text-2xl font-black text-zinc-900">{stats.total}</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm"
            >
              <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <PlusCircle className="text-indigo-600 w-6 h-6" />
                Manual Load
              </h2>

              <form onSubmit={handleLoadBalance} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Student ID</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                        placeholder="e.g. STU-123456"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  Load Balance
                </button>
              </form>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm"
            >
              <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <QrCode className="text-indigo-600 w-6 h-6" />
                QR Processing
              </h2>

              <div className="space-y-6">
                {!pendingRequest ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={qrRequestId}
                      onChange={(e) => setQrRequestId(e.target.value)}
                      placeholder="Enter Request ID"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      onClick={() => handleFetchRequest()}
                      disabled={qrLoading || !qrRequestId}
                      className="w-full py-4 bg-zinc-900 hover:bg-black text-white font-bold rounded-2xl transition-all disabled:opacity-50"
                    >
                      {qrLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Fetch Request'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                    <div className="space-y-4 mb-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Student</p>
                        <p className="text-lg font-bold text-indigo-900">{pendingRequest.student.displayName}</p>
                        <p className="text-xs text-indigo-500">{pendingRequest.student.studentId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Amount</p>
                        <p className="text-3xl font-black text-indigo-900">₱{pendingRequest.request.amount.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleDisapproveRequest}
                        disabled={loading}
                        className="flex-1 py-3 bg-white text-red-600 font-bold rounded-xl border border-red-100 hover:bg-red-50 transition-all disabled:opacity-50"
                      >
                        Disapprove
                      </button>
                      <button
                        onClick={handleApproveRequest}
                        disabled={loading}
                        className="flex-2 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Pending Requests List */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm"
          >
            <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <Clock className="text-indigo-600 w-6 h-6" />
              Pending Load Requests
            </h2>

            {requestsLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-200" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="py-12 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <p className="text-zinc-400 font-medium">No pending requests at the moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-100">
                        <UserIcon className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{req.studentName}</p>
                        <p className="text-xs text-zinc-500">Amount: <span className="font-bold text-zinc-900">₱{req.amount.toLocaleString()}</span></p>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-tighter">ID: {req.id}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFetchRequest(req.id)}
                      className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Review Request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Global Transaction History */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                <History className="text-indigo-600 w-6 h-6" />
                Recent Transactions
              </h2>
            </div>

            <div className="space-y-4">
              {allTransactions.length === 0 ? (
                <div className="py-12 text-center">
                  <History className="w-12 h-12 text-zinc-100 mx-auto mb-4" />
                  <p className="text-zinc-400 text-sm">No transactions recorded yet</p>
                </div>
              ) : (
                allTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        tx.type === 'load' ? "bg-green-100 text-green-600" : "bg-indigo-100 text-indigo-600"
                      )}>
                        {tx.type === 'load' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{tx.description}</p>
                        <p className="text-[10px] text-zinc-500 font-medium">
                          {tx.studentName ? `Student: ${tx.studentName}` : `ID: ${tx.studentId}`}
                        </p>
                        <p className="text-[10px] text-zinc-400">{format(new Date(tx.timestamp), 'MMM dd, yyyy • hh:mm a')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-black text-lg",
                        tx.type === 'load' ? "text-green-600" : "text-indigo-600"
                      )}>
                        {tx.type === 'load' ? '+' : '-'}₱{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          {/* Student Search */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm"
          >
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Student Search</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name or ID..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>

            <div className="space-y-3">
              {searchLoading ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                </div>
              ) : searchQuery.length > 0 && searchQuery.length < 3 ? (
                <p className="text-[10px] text-zinc-400 text-center">Type at least 3 characters</p>
              ) : searchResults.length === 0 && searchQuery.length >= 3 ? (
                <p className="text-[10px] text-zinc-400 text-center">No students found</p>
              ) : (
                searchResults.map(student => (
                  <button
                    key={student.uid}
                    onClick={() => setStudentId(student.studentId || '')}
                    className="w-full p-3 bg-zinc-50 hover:bg-indigo-50 rounded-xl border border-zinc-100 transition-colors text-left group"
                  >
                    <p className="font-bold text-zinc-900 text-sm group-hover:text-indigo-600 transition-colors">{student.displayName}</p>
                    <p className="text-[10px] text-zinc-500">{student.studentId} • Balance: ₱{student.balance.toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>
          </motion.div>

          {/* Active Pending Requests */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm"
          >
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Live Requests</h3>
            <div className="space-y-3">
              {requestsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
                </div>
              ) : pendingRequests.filter(r => new Date(r.expiryDate) > new Date()).length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="w-8 h-8 text-zinc-100 mx-auto mb-2" />
                  <p className="text-zinc-400 text-xs">No active requests</p>
                </div>
              ) : (
                pendingRequests
                  .filter(r => new Date(r.expiryDate) > new Date())
                  .map(req => (
                    <div key={req.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-zinc-900 text-sm">{req.studentName}</p>
                        <p className="text-indigo-600 font-black text-sm">₱{req.amount.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-zinc-400">{format(new Date(req.createdAt), 'MMM dd, hh:mm a')}</p>
                        <button 
                          onClick={() => handleFetchRequest(req.id)}
                          className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                        >
                          Process
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </motion.div>

          {status && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-4 rounded-2xl flex items-center gap-3 text-sm shadow-lg",
                status.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
              )}
            >
              {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <p className="font-bold">{status.message}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

const StudentDashboard = ({ profile }: { profile: UserProfile }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadRequests, setLoadRequests] = useState<LoadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  useEffect(() => {
    // Transactions listener
    const qTrans = query(
      collection(db, 'transactions'),
      where('studentId', '==', profile.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(transData);
      setLoading(false);
    });

    // Load Requests listener
    const qRequests = query(
      collection(db, 'load_requests'),
      where('studentId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoadRequest));
      setLoadRequests(requests);
    });

    return () => {
      unsubTrans();
      unsubRequests();
    };
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
            <button 
              onClick={() => setIsLoadModalOpen(true)}
              className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-colors"
            >
              Request Load
            </button>
            <button 
              onClick={() => setIsPayModalOpen(true)}
              className="bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-400 transition-colors"
            >
              Pay Fees
            </button>
          </div>
        </div>
      </motion.div>

      <RequestLoadModal 
        isOpen={isLoadModalOpen} 
        onClose={() => setIsLoadModalOpen(false)} 
        profile={profile} 
      />
      <PayFeesModal 
        isOpen={isPayModalOpen} 
        onClose={() => setIsPayModalOpen(false)} 
        profile={profile} 
      />

      {/* Active Requests */}
      {loadRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2 px-2">
            <QrCode className="w-6 h-6 text-zinc-400" />
            Active Requests
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loadRequests.map(req => {
              const isExpired = new Date(req.expiryDate) < new Date();
              return (
                <div 
                  key={req.id} 
                  className={cn(
                    "p-6 rounded-3xl border transition-all",
                    req.status === 'pending' ? "bg-white border-zinc-100 shadow-sm" : 
                    req.status === 'approved' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount</p>
                      <p className="text-2xl font-black text-zinc-900">₱{req.amount.toLocaleString()}</p>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      isExpired && req.status === 'pending' ? "bg-zinc-200 text-zinc-500" :
                      req.status === 'pending' ? "bg-indigo-100 text-indigo-600" :
                      req.status === 'approved' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {isExpired && req.status === 'pending' ? 'Expired' : req.status}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">
                      {isExpired && req.status === 'pending' ? 'Request expired' : 
                       req.status === 'pending' ? `Expires ${format(new Date(req.expiryDate), 'MMM dd')}` :
                       `Processed ${format(new Date(req.createdAt), 'MMM dd')}`}
                    </p>
                    {req.status === 'pending' && !isExpired && (
                      <div className="p-2 bg-zinc-100 rounded-lg">
                        <QrCode className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2 px-2">
          <History className="w-6 h-6 text-zinc-400" />
          Transaction History
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
                      tx.type === 'load' ? "bg-green-50 text-green-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      {tx.type === 'load' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{tx.description || (tx.type === 'load' ? 'Balance Loaded' : 'Payment Made')}</p>
                      <p className="text-xs text-zinc-400">{format(new Date(tx.timestamp), 'MMM dd, yyyy • hh:mm a')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-xl font-black",
                      tx.type === 'load' ? "text-green-600" : "text-indigo-600"
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
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth State Changed:', firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : 'None');
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setProfileLoading(true);
        const unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            console.log('User Profile Loaded:', profileData);
            setProfile(profileData);
          } else {
            console.warn('No profile found for user:', firebaseUser.uid);
            setProfile(null);
          }
          setProfileLoading(false);
          setLoading(false);
        }, (error) => {
          console.error('Profile Subscription Error:', error);
          setProfileLoading(false);
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setProfileLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;

  // If user is logged in but profile is still loading, show a neutral loading state
  // to prevent AuthScreen from unmounting too early or showing "Setting up profile"
  if (user && profileLoading && !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
        <p className="text-zinc-900 font-bold">Loading secure session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthScreen onRoleSelect={() => {}} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-zinc-600 font-bold">Account profile not found.</p>
          <p className="text-zinc-400 text-sm mb-4">Please contact support if this persists.</p>
          <button onClick={() => signOut(auth)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Sign Out</button>
        </div>
      </div>
    );
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
        <div key={location.pathname}>
          <Routes location={location}>
            <Route 
              path="/cashier-dashboard" 
              element={
                profile.role === 'cashier' ? (
                  <motion.main
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CashierDashboard profile={profile} />
                  </motion.main>
                ) : (
                  <Navigate to="/student-dashboard" replace />
                )
              } 
            />
            <Route 
              path="/student-dashboard" 
              element={
                profile.role === 'student' ? (
                  <motion.main
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <StudentDashboard profile={profile} />
                  </motion.main>
                ) : (
                  <Navigate to="/cashier-dashboard" replace />
                )
              } 
            />
            <Route 
              path="/" 
              element={<Navigate to={profile.role === 'cashier' ? "/cashier-dashboard" : "/student-dashboard"} replace />} 
            />
            <Route 
              path="*" 
              element={
                <div className="flex flex-col items-center justify-center py-20">
                  <AlertCircle className="w-12 h-12 text-zinc-300 mb-4" />
                  <h2 className="text-xl font-black text-zinc-900">Page Not Found</h2>
                  <button 
                    onClick={() => navigate('/')}
                    className="mt-4 text-indigo-600 font-bold"
                  >
                    Go Back Home
                  </button>
                </div>
              } 
            />
          </Routes>
        </div>
      </AnimatePresence>

      <footer className="py-12 text-center">
        <p className="text-zinc-300 text-xs font-medium uppercase tracking-widest">
          © 2026 EduPay • Secure Campus Financials
        </p>
      </footer>
    </div>
  );
}
