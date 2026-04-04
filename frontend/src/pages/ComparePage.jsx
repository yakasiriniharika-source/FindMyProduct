import { useState, useEffect } from "react";
import { getCompareList, clearCompareList } from "../utils/compareUtils";
import { useNavigate } from "react-router-dom";
import "./ComparePage.css";

function ComparePage() {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setProducts(getCompareList());
  }, []);

  const removeProduct = (id) => {
    const normalizedId = String(id);
    const updated = products.filter(p => p._id !== normalizedId);
    sessionStorage.setItem("fmp_compare", JSON.stringify(updated));
    setProducts(updated);
  };

  const allSpecs = [
    ...new Set(products.flatMap(p => (p.specs ? Object.keys(p.specs) : []))),
  ].filter(k => k !== "details");

  if (products.length === 0) return (
    <div className="compare-page page-wrapper">
      <div className="empty-state">
        <div className="icon">⚖️</div>
        <h3>No products to compare</h3>
        <p>Click the ⚖️ icon on product cards to add them here</p>
        <button className="btn btn-primary" onClick={() => navigate("/search")} style={{ marginTop: 16 }}>
          Browse Products
        </button>
      </div>
    </div>
  );

  return (
    <div className="compare-page page-wrapper">
      <div className="compare-header">
        <h1 className="section-heading">⚖️ Compare <span>Products</span></h1>
        <div className="compare-actions">
          <span style={{ color: "var(--text3)", fontSize: 13 }}>{products.length}/3 products</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { clearCompareList(); setProducts([]); }}>
            Clear All
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/search")}>
            + Add More
          </button>
        </div>
      </div>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-label-col">Feature</th>
              {products.map(p => (
                <th key={p._id} className="compare-product-col">
                  <div className="cpc-header">
                    <div className="cpc-img">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span>📦</span>}
                    </div>
                    <div className="cpc-brand">{p.brand}</div>
                    <div className="cpc-name">{p.name}</div>
                    <button className="cpc-remove" onClick={() => removeProduct(p._id)}>✕</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="compare-row">
              <td className="compare-label">Price</td>
              {products.map(p => (
                <td key={p._id} className="compare-val">
                  {p.price ? <strong className="compare-price">₹{p.price.toLocaleString("en-IN")}</strong> : "—"}
                  {p.mrp && p.mrp > p.price && <span className="compare-mrp">₹{p.mrp.toLocaleString("en-IN")}</span>}
                </td>
              ))}
            </tr>
            <tr className="compare-row">
              <td className="compare-label">Availability</td>
              {products.map(p => (
                <td key={p._id} className="compare-val">
                  <span className={`badge ${p.inStock ? "badge-green" : "badge-red"}`}>
                    {p.inStock ? "✓ In Stock" : "✗ Out of Stock"}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="compare-row">
              <td className="compare-label">Store</td>
              {products.map(p => (
                <td key={p._id} className="compare-val">{p.storeName || "—"}</td>
              ))}
            </tr>
            {allSpecs.map(spec => (
              <tr key={spec} className="compare-row">
                <td className="compare-label" style={{ textTransform: "capitalize" }}>{spec}</td>
                {products.map(p => (
                  <td key={p._id} className="compare-val">
                    {p.specs?.[spec] !== undefined ? String(p.specs[spec]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="compare-row compare-action-row">
              <td className="compare-label"></td>
              {products.map(p => (
                <td key={p._id} className="compare-val">
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/product/${p._id}`)}>
                    View Details
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ComparePage;