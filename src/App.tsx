/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LogIn, LogOut, Plus, Trash2, Database, ShieldCheck } from 'lucide-react';

interface Item {
  id: string;
  text: string;
  userId: string;
  createdAt: number;
}

function FirebaseDemo() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [authError, setAuthError] = useState<string | null>(null);

  // Test Firestore connection on mount
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnectionStatus('connected');
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setConnectionStatus('error');
        } else {
          // If it's a permission error, it means we reached the server, so we're connected
          setConnectionStatus('connected');
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setItems([]);
      return;
    }

    const q = query(
      collection(db, 'items'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: Item[] = [];
      snapshot.forEach((doc) => {
        fetchedItems.push({ id: doc.id, ...doc.data() } as Item);
      });
      // Sort client-side to avoid needing an index for a simple demo
      fetchedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(fetchedItems);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        // User intentionally closed the popup, no need to show an error
        console.log("Sign-in popup closed by user.");
        return;
      }
      
      console.error("Error signing in", error);
      if (error?.code === 'auth/unauthorized-domain') {
        setAuthError(`Domain not authorized. Please go to Firebase Console > Authentication > Settings > Authorized domains and add: ${window.location.hostname}`);
      } else {
        setAuthError(error?.message || "An error occurred during sign in.");
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !user) return;

    setIsLoading(true);
    try {
      await addDoc(collection(db, 'items'), {
        text: newItemText.trim(),
        userId: user.uid,
        createdAt: Date.now()
      });
      setNewItemText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `items/${id}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Loading application...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold tracking-tight">My App</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {connectionStatus === 'error' && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
              Offline
            </span>
          )}
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:block">{user.displayName || user.email}</span>
              </div>
              <button 
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        {!user ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm mt-12">
            <ShieldCheck className="w-16 h-16 text-blue-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-3">Welcome</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Sign in with Google to access the app. This single login securely authenticates you and connects you to the Firebase database.
            </p>
            <button 
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </button>
            {authError && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <h3 className="text-red-800 font-semibold text-sm mb-1">Sign-in Error</h3>
                <p className="text-red-600 text-sm break-words">{authError}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 mt-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Add New Item</h2>
              <form onSubmit={handleAddItem} className="flex gap-3">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Enter something to save..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!newItemText.trim() || isLoading}
                  className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold">Your Data</h2>
              </div>
              
              {items.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  No items found. Add one above!
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <li key={item.id} className="p-6 flex items-start justify-between group hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-gray-900 font-medium break-words">{item.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-gray-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseDemo />
    </ErrorBoundary>
  );
}
