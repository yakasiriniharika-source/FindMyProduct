import { useState} from "react";

const KEY = "fmp_recently_viewed";
const MAX = 8;

export function useRecentlyViewed() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  });

  const addItem = (product) => {
    if (!product?._id) return;
    setItems(prev => {
      const filtered = prev.filter(p => p._id !== product._id.toString());
      const newItems = [{
        _id: product._id.toString(),
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        imageUrl: product.imageUrl,
        storeName: product.storeName,
        storeId: product.storeId?.toString(),
        inStock: product.inStock,
        viewedAt: Date.now(),
      }, ...filtered].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(newItems));
      return newItems;
    });
  };

  const clearItems = () => {
    localStorage.removeItem(KEY);
    setItems([]);
  };

  return { items, addItem, clearItems };
}