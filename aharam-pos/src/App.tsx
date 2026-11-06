
import MobileCustomer from './MobileCustomer';
import './mobile.css';
import {useEffect,useMemo,useState} from 'react';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import QRCode from 'qrcode';
import {starterMenu,type MenuItem} from './data';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const db:SupabaseClient|null=url&&key?createClient(url,key):null;

type Line={item:MenuItem;qty:number;note:string};
type Order={
  id:string;
  order_no:number;
  table_no:number|null;
  order_type:string;
  status:string;
  total:number;
  created_at:string;
  notes:string|null;
  payment_method?:string|null;
  paid_at?:string|null;
  order_items?:any[];
};

const money=(n:number)=>'₹'+Number(n||0).toFixed(0);

export default function App(){
 const [mode,setMode]=useState<'customer'|'owner'|'kitchen'>('customer');
 const [menu,setMenu]=useState<MenuItem[]>([]);
 const [cart,setCart]=useState<Line[]>([]);
 const [cat,setCat]=useState('All');
 const [search,setSearch]=useState('');
 const [table,setTable]=useState<number|null>(null);
 const [orders,setOrders]=useState<Order[]>([]);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [session,setSession]=useState<any>(null);
 const [isStaff,setIsStaff]=useState(false);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [custName,setCustName]=useState('');
 const [custPhone,setCustPhone]=useState('');
 const [orderType,setOrderType]=useState('Takeaway');
 const [tracking,setTracking]=useState('');
 const [tracked,setTracked]=useState<any>(null);
 const [edit,setEdit]=useState<MenuItem|null>(null);
 const [showMenu,setShowMenu]=useState(false);
 const [baseUrl,setBaseUrl]=useState(location.origin);

 useEffect(()=>{
   const t=Number(new URLSearchParams(location.search).get('table'));
   if(t>=1&&t<=3)setTable(t);
 },[]);

 useEffect(()=>{
   if(!db)return;
   db.auth.getSession().then(({data})=>setSession(data.session));
   const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>setSession(s));
   return()=>subscription.unsubscribe();
 },[]);

 useEffect(()=>{
   if(!db)return;
   loadMenu();
 },[]);

 async function loadMenu(){
   if(!db)return;
   const {data,error}=await db.from('menu_items').select('*').order('category').order('name');
   if(error){setNotice(error.message);return;}
   if(data?.length)setMenu(data as MenuItem[]);
   else setMenu(starterMenu.map((x,i)=>({...x,id:'demo-'+i})));
 }

 useEffect(()=>{
   if(!db||!session)return;
   db.from('profiles').select('role').eq('id',session.user.id).single().then(({data})=>{
     setIsStaff(data?.role==='owner'||data?.role==='staff');
   });
 },[session]);

 useEffect(()=>{
   if(!db||!isStaff)return;
   loadOrders();
   const channel=db.channel('kitchen-orders')
     .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>loadOrders())
     .subscribe();
   return()=>{db.removeChannel(channel);};
 },[isStaff]);

 async function loadOrders(){
   if(!db)return;
   const {data}=await db.from('orders').select('*,order_items(*)')
     .neq('status','cancelled').order('created_at',{ascending:true});
   setOrders((data||[]) as Order[]);
 }

 const categories=useMemo(
   ()=>['All',...Array.from(new Set(menu.map(x=>x.category)))],
   [menu]
 );

 const shown=menu.filter(x=>
   x.available &&
   (cat==='All'||x.category===cat) &&
   (`${x.name} ${x.description}`).toLowerCase().includes(search.toLowerCase())
 );

 const total=cart.reduce((s,x)=>s+x.item.price*x.qty,0);

 function add(item:MenuItem){
   setCart(old=>{
     const found=old.find(x=>x.item.id===item.id);
     return found
       ?old.map(x=>x.item.id===item.id?{...x,qty:x.qty+1}:x)
       :[...old,{item,qty:1,note:''}];
   });
 }

 function qty(id:string,delta:number){
   setCart(old=>
     old.map(x=>x.item.id===id?{...x,qty:x.qty+delta}:x)
       .filter(x=>x.qty>0)
   );
 }

 async function submitOrder(){
   if(!db){setNotice('Connect Supabase first. See SETUP.md.');return;}
   if(!cart.length)return;
   if(cart.some(x=>x.item.id.startsWith('demo-'))){
     setNotice('Owner must import the starter menu into Supabase before QR orders can be placed.');
     return;
   }

   setBusy(true);

   const {data,error}=await db.rpc('place_order',{
     p_table_no:table,
     p_order_type:table?'Dine-in':orderType,
     p_customer_name:custName,
     p_customer_phone:custPhone,
     p_items:cart.map(x=>({
       item_id:x.item.id,
       quantity:x.qty,
       note:x.note
     }))
   });

   if(error){
     setNotice(error.message);
     setBusy(false);
     return;
   }

   const result=data?.[0];

   if(!result){
     setNotice('Order could not be confirmed.');
     setBusy(false);
     return;
   }

   setTracking(result.tracking_token);
   setTracked({order_no:result.order_no,status:'new'});
   setCart([]);
   setNotice('Order sent to AHARAM kitchen!');
   setBusy(false);
 }

 async function signIn(){
   if(!db)return;
   const {error}=await db.auth.signInWithPassword({email,password});
   setNotice(error?.message||'Signed in');
 }

 async function importStarter(){
   if(!db)return;
   setBusy(true);
   const {data,error}=await db.from('menu_items').insert(starterMenu).select();
   if(error)setNotice(error.message);
   else{
     setNotice(`Imported ${data?.length||0} menu items. Verify every price before opening.`);
     await loadMenu();
   }
   setBusy(false);
 }

 async function saveItem(){
   if(!db||!edit)return;
   const payload={
     name:edit.name,
     category:edit.category,
     description:edit.description,
     price:Number(edit.price),
     available:edit.available,
     image_url:edit.image_url||null
   };
   const q=edit.id.startsWith('demo-')
     ?db.from('menu_items').insert(payload)
     :db.from('menu_items').update(payload).eq('id',edit.id);
   const {error}=await q;
   setNotice(error?.message||'Menu item saved');
   setEdit(null);
   loadMenu();
 }

 async function changeStatus(o:Order,status:string){
   if(!db)return;
   const {error}=await db.from('orders').update({status}).eq('id',o.id);
   if(error)setNotice(error.message);
   else loadOrders();
 }

 async function trackOrder(){
   if(!db)return;
   const {data,error}=await db.rpc('track_order',{p_token:tracking});
   setTracked(error?{error:error.message}:data?.[0]||{error:'Order not found'});
 }

 async function markPaid(o:Order,method:string){
   if(!db)return;
   const {error}=await db.from('orders').update({
     payment_method:method,
     paid_at:new Date().toISOString()
   }).eq('id',o.id);
   setNotice(error?.message||`Order #${o.order_no} marked paid by ${method}`);
   if(!error)loadOrders();
 }

 function printBill(o:Order){
   const lines=(o.order_items||[]).map((it:any)=>
     `<tr><td>${it.quantity} × ${it.item_name}</td><td>₹${Number(it.unit_price*it.quantity).toFixed(0)}</td></tr>`
   ).join('');

   const w=window.open('','_blank','width=420,height=700');

   if(w){
     w.document.write(`<html><head><title>AHARAM Bill #${o.order_no}</title><style>body{font:14px Arial;padding:18px;color:#111}h1{text-align:center;letter-spacing:4px}p{text-align:center}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px dashed #aaa}.total{font-size:20px;font-weight:bold;text-align:right;margin-top:18px}</style></head><body><h1>AHARAM</h1><p>Order #${o.order_no}<br>${o.table_no?'Table '+o.table_no:o.order_type}<br>${new Date(o.created_at).toLocaleString()}</p><table>${lines}</table><div class="total">TOTAL ₹${Number(o.total).toFixed(0)}</div><p>GST not charged</p><p>Thank you. Visit again!</p><script>window.print()<\/script></body></html>`);
     w.document.close();
   }
 }

 async function qr(tableNo:number){
   const text=`${baseUrl}/?table=${tableNo}`;
   const data=await QRCode.toDataURL(text,{
     width:600,
     margin:2,
     color:{dark:'#11110f',light:'#ffffff'}
   });
   const w=window.open('','_blank');
   if(w){
     w.document.write(`<title>AHARAM Table ${tableNo} QR</title><body style="font-family:Arial;text-align:center;padding:24px"><h1>AHARAM</h1><h2>TABLE ${tableNo}</h2><img src="${data}" style="width:300px"/><p>Scan to view menu & order</p><p>${text}</p><script>window.print()<\/script></body>`);
     w.document.close();
   }
 }

 if(!db)return <div className="setup">
   <div className="brand">AHARAM</div>
   <h1>Setup required</h1>
   <p>Project files are ready. Connect your Supabase project to activate live ordering, kitchen updates and billing.</p>
   <p>Open <b>SETUP.md</b> in this ZIP and follow the deployment steps.</p>
 </div>;

 return <div className="app">
   <header className={mode==='customer'?'customer-system-header':''}>
     <div>
       <div className="brand">AHARAM</div>
       <small>CAFE • ORDERING & POS</small>
     </div>
     <div className="topright">
       <span className="live">● LIVE MENU</span>
       <button className="outline" onClick={()=>setMode('customer')}>Menu</button>
       {session&&isStaff?<>
         <button className="outline" onClick={()=>setMode('owner')}>Owner</button>
         <button className="outline" onClick={()=>setMode('kitchen')}>Kitchen</button>
         <button className="outline" onClick={()=>db.auth.signOut()}>Sign out</button>
       </>:<button className="outline" onClick={()=>setShowMenu(!showMenu)}>Staff login</button>}
     </div>
   </header>

   {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice} ×</div>}

   {showMenu&&<div className="login panel">
     <h3>Staff sign in</h3>
     <input placeholder="Owner email" value={email} onChange={e=>setEmail(e.target.value)}/>
     <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
     <button onClick={signIn}>Sign in</button>
   </div>}

   {mode==='customer'&&<>
     <div className="desktop-customer-ui">
       <section className="hero">
         <p className="eyebrow">GOOD FOOD • GOOD MOOD</p>
         <h1>Discover the taste<br/><em>of AHARAM.</em></h1>
         <p>Freshly made favourites, crafted for you.</p>
         {table&&<span className="tabletag">ORDERING FOR TABLE {table}</span>}
       </section>

       <main className="customer">
         <section className="menuarea">
           <div className="toolbar">
             <input placeholder="Search menu..." value={search} onChange={e=>setSearch(e.target.value)}/>
             <div className="cats">
               {categories.map(c=><button className={cat===c?'active':''} key={c} onClick={()=>setCat(c)}>{c}</button>)}
             </div>
           </div>

           <div className="items">
             {shown.map(item=><article className="item" key={item.id}>
               <div className="itemtop">
                 <span className="itemcat">{item.category}</span>
                 <b>{money(item.price)}</b>
               </div>
               <h3>{item.name}</h3>
               <p>{item.description}</p>
               <button className="add" onClick={()=>add(item)}>＋ Add</button>
             </article>)}
           </div>
         </section>

         <aside className="cart panel">
           <h2>Your order</h2>
           {table?<p className="muted">Table {table}</p>:<label>Order type
             <select value={orderType} onChange={e=>setOrderType(e.target.value)}>
               <option>Dine-in</option><option>Takeaway</option><option>Parcel</option>
             </select>
           </label>}
           <input placeholder="Your name (optional)" value={custName} onChange={e=>setCustName(e.target.value)}/>
           <input placeholder="Phone (optional)" value={custPhone} onChange={e=>setCustPhone(e.target.value)}/>
           {cart.length===0?<p className="muted">Your cart is empty. Add something delicious!</p>:
             cart.map(x=><div className="cartline" key={x.item.id}>
               <div><b>{x.item.name}</b><small>{money(x.item.price)} each</small></div>
               <div className="stepper">
                 <button onClick={()=>qty(x.item.id,-1)}>−</button>
                 {x.qty}
                 <button onClick={()=>qty(x.item.id,1)}>＋</button>
               </div>
             </div>)
           }
           <div className="total"><span>Subtotal</span><b>{money(total)}</b></div>
           <small className="muted">GST is currently disabled.</small>
           <button className="primary full" disabled={!cart.length||busy} onClick={submitOrder}>
             {busy?'Sending...':'Place order'}
           </button>
         </aside>
       </main>

       {tracking&&<div className="track panel">
         <h3>Order #{tracked?.order_no||'—'}</h3>
         <p>Status: <b>{tracked?.status||'Submitted'}</b></p>
         <p className="muted">Keep this tracking code to check your order.</p>
         <code>{tracking}</code>
         <button className="outline" onClick={trackOrder}>Refresh status</button>
       </div>}
     </div>

     <MobileCustomer
       menu={shown}
       categories={categories}
       cart={cart}
       table={table}
       total={total}
       cat={cat}
       search={search}
       orderType={orderType}
       custName={custName}
       custPhone={custPhone}
       busy={busy}
       tracking={tracking}
       tracked={tracked}
       notice={notice}
       setCat={setCat}
       setSearch={setSearch}
       setOrderType={setOrderType}
       setCustName={setCustName}
       setCustPhone={setCustPhone}
       add={add}
       qty={qty}
       submitOrder={submitOrder}
       trackOrder={trackOrder}
     />
   </>}

   {mode==='owner'&&<main className="dashboard">
     <div className="dashhead">
       <div><p className="eyebrow">CONTROL CENTRE</p><h1>Owner dashboard</h1></div>
       <button className="primary" onClick={()=>setEdit({id:'demo-new',name:'',category:'Waffles',description:'',price:0,available:true})}>＋ Add menu item</button>
     </div>

     <div className="stats">
       <div><small>Active orders</small><b>{orders.length}</b></div>
       <div><small>Menu items</small><b>{menu.length}</b></div>
       <div><small>GST</small><b>OFF</b></div>
     </div>

     <section className="panel">
       <h2>Table QR codes</h2>
       <p className="muted">Set the deployed website URL before printing.</p>
       <input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://your-site.vercel.app"/>
       {[1,2,3].map(n=><button className="outline" key={n} onClick={()=>qr(n)}>Print Table {n} QR</button>)}
     </section>

     <section className="panel">
       <h2>Billing & order history</h2>
       <div className="tablewrap">
         <table>
           <thead><tr><th>Bill</th><th>Table / Type</th><th>Total</th><th>Payment</th><th>Action</th></tr></thead>
           <tbody>{orders.slice().reverse().map(o=><tr key={o.id}>
             <td>#{o.order_no}<br/><small>{new Date(o.created_at).toLocaleString()}</small></td>
             <td>{o.table_no?'Table '+o.table_no:o.order_type}</td>
             <td>{money(Number(o.total))}</td>
             <td>{o.payment_method||'Unpaid'}</td>
             <td>
               <button className="textbtn" onClick={()=>printBill(o)}>Print bill</button>
               {!o.paid_at&&<select onChange={e=>e.target.value&&markPaid(o,e.target.value)} defaultValue="">
                 <option value="" disabled>Mark paid…</option>
                 <option>Cash</option><option>UPI</option><option>Card</option>
               </select>}
             </td>
           </tr>)}</tbody>
         </table>
       </div>
     </section>

     <section className="panel">
       <h2>Menu manager</h2>
       {menu.some(m=>m.id.startsWith("demo-"))&&
         <button className="primary" onClick={importStarter} disabled={busy}>Import starter menu to database</button>
       }
       <div className="tablewrap">
         <table>
           <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Available</th><th></th></tr></thead>
           <tbody>{menu.map(m=><tr key={m.id}>
             <td>{m.name}</td><td>{m.category}</td><td>{money(m.price)}</td>
             <td>{m.available?'Yes':'No'}</td>
             <td><button className="textbtn" onClick={()=>setEdit({...m})}>Edit</button></td>
           </tr>)}</tbody>
         </table>
       </div>
     </section>

     {edit&&<div className="modal"><div className="panel">
       <h2>Edit menu item</h2>
       <input placeholder="Item name" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/>
       <input placeholder="Category" value={edit.category} onChange={e=>setEdit({...edit,category:e.target.value})}/>
       <textarea placeholder="Description" value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/>
       <input type="number" placeholder="Price" value={edit.price} onChange={e=>setEdit({...edit,price:Number(e.target.value)})}/>
       <label><input type="checkbox" checked={edit.available} onChange={e=>setEdit({...edit,available:e.target.checked})}/> Available for ordering</label>
       <div className="actions">
         <button className="outline" onClick={()=>setEdit(null)}>Cancel</button>
         <button className="primary" onClick={saveItem}>Save item</button>
       </div>
     </div></div>}
   </main>}

   {mode==='kitchen'&&<main className="dashboard">
     <div className="dashhead">
       <div><p className="eyebrow">LIVE ORDER QUEUE</p><h1>Kitchen display</h1></div>
       <button className="outline" onClick={loadOrders}>Refresh</button>
     </div>

     <div className="kitchen">
       {orders.filter(o=>o.status!=='served').length===0
         ?<div className="panel">No active orders right now.</div>
         :orders.filter(o=>o.status!=='served').map(o=><article className="panel ordercard" key={o.id}>
           <div className="orderhead">
             <b>#{o.order_no}</b>
             <span className={'status '+o.status}>{o.status}</span>
           </div>
           <h3>{o.table_no?'Table '+o.table_no:o.order_type}</h3>
           <small>{new Date(o.created_at).toLocaleTimeString()}</small>
           {o.order_items?.map((it:any)=><div className="orderitem" key={it.id}>
             <b>{it.quantity} × {it.item_name}</b>
             {it.note&&<small>{it.note}</small>}
           </div>)}
           <div className="orderactions">
             {o.status==='new'&&<button onClick={()=>changeStatus(o,'accepted')}>Accept</button>}
             {o.status==='accepted'&&<button onClick={()=>changeStatus(o,'preparing')}>Start preparing</button>}
             {o.status==='preparing'&&<button onClick={()=>changeStatus(o,'ready')}>Mark ready</button>}
             {o.status==='ready'&&<button onClick={()=>changeStatus(o,'served')}>Served</button>}
           </div>
         </article>)
       }
     </div>
   </main>}

   <footer>AHARAM • Made with care <span>GST disabled • Prices in INR</span></footer>
 </div>;
}
