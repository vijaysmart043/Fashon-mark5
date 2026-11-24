import { useState, useEffect } from 'react';
import { Product, PRODUCTS } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface CartItem {
  product: Product;
  quantity: number;
  variantSku?: string;
}

export function useCartAndWishlist() {
  const { firebaseUser } = useAuth();
  
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const local = localStorage.getItem('sda_cart');
      return local ? JSON.parse(local) : [{ product: PRODUCTS[0], quantity: 1 }];
    } catch {
      return [{ product: PRODUCTS[0], quantity: 1 }];
    }
  });

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem('sda_wishlist');
      return local ? JSON.parse(local) : ['prod-2', 'prod-3'];
    } catch {
      return ['prod-2', 'prod-3'];
    }
  });

  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem('sda_recent');
      return local ? JSON.parse(local) : ['prod-1', 'prod-2'];
    } catch {
      return ['prod-1', 'prod-2'];
    }
  });

  // Sync with Firestore when authenticated
  useEffect(() => {
    if (firebaseUser) {
      const fetchUserData = async () => {
        const cartPath = `carts/${firebaseUser.uid}`;
        const wishPath = `wishlists/${firebaseUser.uid}`;
        try {
          const cartRef = doc(db, 'carts', firebaseUser.uid);
          const cartSnap = await getDoc(cartRef);
          if (cartSnap.exists()) {
            const remoteCart = cartSnap.data().items || [];
            if (remoteCart.length > 0) {
              setCartItems(remoteCart.slice(0, 50));
            }
          }
        } catch (err) {
          console.error('Error syncing cart from Firestore:', err);
          try {
            handleFirestoreError(err, OperationType.GET, cartPath);
          } catch {
            // Preserve local cart on offline/initial boot
          }
        }

        try {
          const wishRef = doc(db, 'wishlists', firebaseUser.uid);
          const wishSnap = await getDoc(wishRef);
          if (wishSnap.exists()) {
            const remoteWish = wishSnap.data().productIds || [];
            if (remoteWish.length > 0) {
              setWishlistIds(remoteWish.slice(0, 100));
            }
          }
        } catch (err) {
          console.error('Error syncing wishlist from Firestore:', err);
          try {
            handleFirestoreError(err, OperationType.GET, wishPath);
          } catch {
            // Preserve local wishlist on offline/initial boot
          }
        }
      };
      void fetchUserData();
    }
  }, [firebaseUser]);

  // Save changes locally and to Firestore
  useEffect(() => {
    try {
      const boundedCart = cartItems.slice(0, 50);
      localStorage.setItem('sda_cart', JSON.stringify(boundedCart));
      if (firebaseUser) {
        setDoc(
          doc(db, 'carts', firebaseUser.uid),
          {
            userId: firebaseUser.uid,
            items: boundedCart,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((err) => {
          console.error('Firestore cart write failed:', err);
        });
      }
    } catch (err) {
      console.error('Error saving cart:', err);
    }
  }, [cartItems, firebaseUser]);

  useEffect(() => {
    try {
      const boundedWishlist = wishlistIds.slice(0, 100);
      localStorage.setItem('sda_wishlist', JSON.stringify(boundedWishlist));
      if (firebaseUser) {
        setDoc(
          doc(db, 'wishlists', firebaseUser.uid),
          {
            userId: firebaseUser.uid,
            productIds: boundedWishlist,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((err) => {
          console.error('Firestore wishlist write failed:', err);
        });
      }
    } catch (err) {
      console.error('Error saving wishlist:', err);
    }
  }, [wishlistIds, firebaseUser]);

  useEffect(() => {
    try {
      localStorage.setItem('sda_recent', JSON.stringify(recentlyViewed));
    } catch (err) {
      console.error('Error saving recently viewed:', err);
    }
  }, [recentlyViewed]);

  const addToCart = (product: Product, variantSku?: string) => {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id && item.variantSku === variantSku);
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex].quantity += 1;
        return copy;
      }
      return [...prev, { product, quantity: 1, variantSku }];
    });
  };

  const updateQuantity = (product: Product, delta: number, variantSku?: string) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.product.id === product.id && item.variantSku === variantSku) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (product: Product, variantSku?: string) => {
    setCartItems(prev => prev.filter(item => !(item.product.id === product.id && item.variantSku === variantSku)));
  };

  const toggleWishlist = (product: Product) => {
    setWishlistIds(prev =>
      prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id]
    );
  };

  const addRecentlyViewed = (productId: string) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(id => id !== productId);
      return [productId, ...filtered].slice(0, 6);
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return {
    cartItems,
    wishlistIds,
    recentlyViewed,
    addToCart,
    updateQuantity,
    removeFromCart,
    toggleWishlist,
    addRecentlyViewed,
    clearCart
  };
}
