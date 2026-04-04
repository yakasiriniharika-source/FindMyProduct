const COMPARE_KEY = "fmp_compare";

export const getCompareList = () => {
  try { return JSON.parse(sessionStorage.getItem(COMPARE_KEY) || "[]"); } catch { return []; }
};

export const toggleCompare = (product) => {
  const list = getCompareList();
  // Normalize the incoming ID to a string for consistent comparison
  const incomingId = product._id != null ? String(product._id) : null;
  if (!incomingId) return false;

  const exists = list.find(p => p._id === incomingId);
  if (exists) {
    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(list.filter(p => p._id !== incomingId)));
    return false;
  }
  if (list.length >= 3) { alert("You can compare up to 3 products only."); return false; }
  list.push({
    _id: incomingId,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    mrp: product.mrp,
    imageUrl: product.imageUrl,
    specs: product.specs,
    inStock: product.inStock,
    storeName: product.storeName,
  });
  sessionStorage.setItem(COMPARE_KEY, JSON.stringify(list));
  return true;
};

export const isInCompareList = (productId) => {
  if (productId == null) return false;
  const id = String(productId);
  return getCompareList().some(p => p._id === id);
};

export const clearCompareList = () => sessionStorage.removeItem(COMPARE_KEY);