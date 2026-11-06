
import { useState } from 'react';
import type { MenuItem } from './data';

type Line = { item: MenuItem; qty: number; note: string };

type Props = {
  menu: MenuItem[];
  categories: string[];
  cart: Line[];
  table: number | null;
  total: number;
  cat: string;
  search: string;
  orderType: string;
  custName: string;
  custPhone: string;
  busy: boolean;
  tracking: string;
  tracked: any;
  notice: string;
  setCat: (v: string) => void;
  setSearch: (v: string) => void;
  setOrderType: (v: string) => void;
  setCustName: (v: string) => void;
  setCustPhone: (v: string) => void;
  add: (item: MenuItem) => void;
  qty: (id: string, delta: number) => void;
  submitOrder: () => void;
  trackOrder: () => void;
};

const money = (n: number) => '₹' + Number(n || 0).toFixed(0);

export default function MobileCustomer(p: Props) {
  const [cartOpen, setCartOpen] = useState(false);

  const count = p.cart.reduce((s, x) => s + x.qty, 0);

  return (
    <div className="mobile-customer">
      <div className="mobile-brand">
        <div className="mobile-logo">AHARAM</div>
        <span>CAFE • GOOD FOOD • GOOD MOOD</span>
      </div>

      <section className="mobile-hero">
        <p>WELCOME TO AHARAM</p>
        <h1>Discover the taste<br /><em>of happiness.</em></h1>
        {p.table && <span>TABLE {p.table}</span>}
      </section>

      <main className="mobile-menu">
        <input
          className="mobile-search"
          placeholder="Search food & drinks..."
          value={p.search}
          onChange={e => p.setSearch(e.target.value)}
        />

        <div className="mobile-categories">
          {p.categories.map(c => (
            <button
              key={c}
              className={p.cat === c ? 'selected' : ''}
              onClick={() => p.setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mobile-grid">
          {p.menu.map(item => (
            <article className="mobile-item" key={item.id}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} />
              ) : (
                <div className="mobile-no-image">AHARAM</div>
              )}

              <div className="mobile-item-info">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="mobile-item-bottom">
                  <b>{money(item.price)}</b>
                  <button onClick={() => p.add(item)}>＋ Add</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {p.menu.length === 0 && (
          <p className="mobile-empty">No items found.</p>
        )}
      </main>

      {count > 0 && (
        <button
          className="mobile-cart-bar"
          onClick={() => setCartOpen(true)}
        >
          <span>{count} item{count > 1 ? 's' : ''}</span>
          <b>View cart</b>
          <strong>{money(p.total)}</strong>
        </button>
      )}

      {cartOpen && (
        <div className="mobile-cart-overlay">
          <div className="mobile-cart-sheet">
            <div className="mobile-sheet-heading">
              <div>
                <h2>Your order</h2>
                <small>{count} items · {money(p.total)}</small>
              </div>
              <button onClick={() => setCartOpen(false)}>✕</button>
            </div>

            {p.table ? (
              <p className="mobile-table">Dine-in · Table {p.table}</p>
            ) : (
              <label className="mobile-field">
                Order type
                <select
                  value={p.orderType}
                  onChange={e => p.setOrderType(e.target.value)}
                >
                  <option>Takeaway</option>
                  <option>Dine-in</option>
                  <option>Parcel</option>
                </select>
              </label>
            )}

            <input
              className="mobile-field"
              placeholder="Your name (optional)"
              value={p.custName}
              onChange={e => p.setCustName(e.target.value)}
            />

            <input
              className="mobile-field"
              placeholder="Phone (optional)"
              value={p.custPhone}
              onChange={e => p.setCustPhone(e.target.value)}
            />

            <div className="mobile-cart-items">
              {p.cart.map(x => (
                <div className="mobile-cart-line" key={x.item.id}>
                  <div>
                    <b>{x.item.name}</b>
                    <small>{money(x.item.price)} each</small>
                  </div>
                  <div className="mobile-stepper">
                    <button onClick={() => p.qty(x.item.id, -1)}>−</button>
                    <b>{x.qty}</b>
                    <button onClick={() => p.qty(x.item.id, 1)}>＋</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mobile-total">
              <span>Total</span>
              <b>{money(p.total)}</b>
            </div>

            <small className="mobile-gst">GST is currently disabled.</small>

            <button
              className="mobile-place-order"
              disabled={!p.cart.length || p.busy}
              onClick={p.submitOrder}
            >
              {p.busy ? 'Sending order...' : 'Place order · ' + money(p.total)}
            </button>
          </div>
        </div>
      )}

      {p.tracking && (
        <section className="mobile-tracking">
          <h3>Order #{p.tracked?.order_no || '—'}</h3>
          <p>Status: <b>{p.tracked?.status || 'Submitted'}</b></p>
          <button onClick={p.trackOrder}>Refresh order status</button>
        </section>
      )}
    </div>
  );
}
