import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType
} from '../firebase';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { StaffRole } from '../types/shippingReturns';
import {
  triggerPasswordResetNoticeEmail,
  triggerTransactionalEmail,
} from '../services/emailClientService';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'vsmart996@gmail.com';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: StaffRole;
  accountStatus: string;
  emailVerified: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isStaff: boolean;
  staffRole: StaffRole;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, fullName: string, phone: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  setupRecaptcha: (containerId: string) => RecaptchaVerifier;
  sendOtp: (phone: string, appVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole>('customer');
  const [loading, setLoading] = useState(true);

  const resolveStaffRole = async (user: FirebaseUser, fallbackRole: StaffRole): Promise<StaffRole> => {
    if (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) {
      return 'super_admin';
    }
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (adminSnap.exists()) {
        const data = adminSnap.data();
        if (data?.active === true && data?.role) {
          return data.role as StaffRole;
        }
      }
    } catch {
      // Non-admin users will get permission denied when probing admins/{uid} if rules restrict; fallback cleanly to customer
    }
    return fallbackRole;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const path = `users/${user.uid}`;
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          let resolvedProfile: UserProfile;
          if (userDoc.exists()) {
            resolvedProfile = userDoc.data() as UserProfile;
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              fullName: (user.displayName || 'Valued Customer').slice(0, 120),
              email: (user.email || '').slice(0, 160),
              phoneNumber: (user.phoneNumber || '').slice(0, 24),
              role: 'customer',
              accountStatus: 'active',
              emailVerified: Boolean(user.emailVerified),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            await setDoc(userDocRef, newProfile);
            resolvedProfile = newProfile;
          }
          const resolvedRole = await resolveStaffRole(user, resolvedProfile.role || 'customer');
          setStaffRole(resolvedRole);
          setUserProfile({ ...resolvedProfile, role: resolvedRole });
        } catch (err) {
          console.error('Auth profile sync error:', err);
          if (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) {
            setStaffRole('super_admin');
          } else {
            setStaffRole('customer');
          }
          try {
            handleFirestoreError(err, OperationType.GET, path);
          } catch {
            // Avoid crashing auth listener on initial offline/rule transition
          }
        }
      } else {
        setUserProfile(null);
        setStaffRole('customer');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, fullName: string, phone: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    const newProfile: UserProfile = {
      uid: user.uid,
      fullName: fullName.trim().slice(0, 120),
      email: email.trim().slice(0, 160),
      phoneNumber: phone.trim().slice(0, 24),
      role: 'customer',
      accountStatus: 'active',
      emailVerified: Boolean(user.emailVerified),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setUserProfile(newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    }

    try {
      await sendEmailVerification(user);
    } catch (e) {
      console.error('Email verification error:', e);
    }

    // Supplementary transactional Resend emails (Firebase verification flow stays primary)
    void triggerTransactionalEmail({
      templateType: 'welcome',
      recipientEmail: newProfile.email,
      recipientName: newProfile.fullName,
      userId: user.uid,
      idempotencyKey: `welcome-${user.uid}`,
    });
    void triggerTransactionalEmail({
      templateType: 'email_verification',
      recipientEmail: newProfile.email,
      recipientName: newProfile.fullName,
      userId: user.uid,
      idempotencyKey: `verify-init-${user.uid}`,
    });
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        const newProfile: UserProfile = {
          uid: user.uid,
          fullName: (user.displayName || 'Google Customer').slice(0, 120),
          email: (user.email || '').slice(0, 160),
          phoneNumber: (user.phoneNumber || '').slice(0, 24),
          role: 'customer',
          accountStatus: 'active',
          emailVerified: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const setupRecaptcha = (containerId: string) => {
    return new RecaptchaVerifier(auth, containerId, {
      size: 'invisible'
    });
  };

  const sendOtp = async (phone: string, appVerifier: RecaptchaVerifier) => {
    return await signInWithPhoneNumber(auth, phone, appVerifier);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setStaffRole('customer');
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    void triggerPasswordResetNoticeEmail(email);
  };

  const verifyEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      if (auth.currentUser.email) {
        const hourBucket = new Date().toISOString().slice(0, 13);
        void triggerTransactionalEmail({
          templateType: 'email_verification',
          recipientEmail: auth.currentUser.email,
          recipientName: userProfile?.fullName || auth.currentUser.displayName || 'Customer',
          userId: auth.currentUser.uid,
          idempotencyKey: `verify-${auth.currentUser.uid}-${hourBucket}`,
        });
      }
    }
  };

  const isStaff = staffRole !== 'customer';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        isStaff,
        staffRole,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        setupRecaptcha,
        sendOtp,
        logout,
        resetPassword,
        verifyEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
