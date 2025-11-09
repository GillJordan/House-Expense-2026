// app.js - full UI + Firebase logic (ready for Firebase config)
/* IMPORTANT: Replace firebaseConfig below with your project's config from Firebase console. */

const firebaseConfig = {
  apiKey: "AIzaSyCZ_eQonlY2OxSyJt55Efjr8TH1BYGIQ-Q",
  authDomain: "house-expense-a4c13.firebaseapp.com",
  projectId: "house-expense-a4c13",
  // optional fields below
  // storageBucket: "YOUR_BUCKET",
  // messagingSenderId: "XXX",
  // appId: "1:XXX:web:YYY"
};

// init Firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// UI refs
const openAdd = document.getElementById('openAdd');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const fldDate = document.getElementById('fldDate');
const fldType = document.getElementById('fldType');
const fldAccount = document.getElementById('fldAccount');
const fldAmount = document.getElementById('fldAmount');
const fldProduct = document.getElementById('fldProduct');
const fldQty = document.getElementById('fldQty');
const fldFor = document.getElementById('fldFor');
const fldBy = document.getElementById('fldBy');
const fldFrom = document.getElementById('fldFrom');
const fldNote = document.getElementById('fldNote');
const fldUnpaid = document.getElementById('fldUnpaid');
const saveEntry = document.getElementById('saveEntry');
const cancelEntry = document.getElementById('cancelEntry');
const accountPlus = document.getElementById('accountPlus');
const addAccountBtn = document.getElementById('addAccountBtn');
const accountsListDiv = document.getElementById('accountsList');
const recentTableBody = document.querySelector('#recentTable tbody');
const pendingList = document.getElementById('pendingList');
const totalSavingEl = document.getElementById('totalSaving');
const totalExpenseEl = document.getElementById('totalExpense');
const tradingAmountEl = document.getElementById('tradingAmount');
const longTermEl = document.getElementById('longTerm');
const pendingUdhaarEl = document.getElementById('pendingUdhaar');
const pendingCountEl = document.getElementById('pendingCount');
const globalSearch = document.getElementById('globalSearch');

// charts
let pieChart=null, barChart=null;

// local cache
let ACCOUNTS = []; // {id,name,balance,customFields:[]}
let TRANSACTIONS = []; // list of tx objects
let PENDING = [];

// helpers
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }

// modal handlers
openAdd.addEventListener('click', ()=>{
  openModal();
});
closeModal.addEventListener('click', ()=> closeModalFn());
cancelEntry.addEventListener('click', ()=> closeModalFn());

function openModal(accountId){
  modal.classList.remove('hidden');
  fldDate.value = todayISO();
  // populate account select
  refreshAccountSelect();
  if(accountId) fldAccount.value = accountId;
}
function closeModalFn(){ modal.classList.add('hidden'); clearForm(); }

function clearForm(){
  fldAmount.value=''; fldProduct.value=''; fldQty.value=''; fldFor.value=''; fldBy.value=''; fldFrom.value=''; fldNote.value=''; fldUnpaid.checked=false;
}

// account creation flow (inline)
accountPlus.addEventListener('click', ()=> {
  const name = prompt('New account name (e.g. HDFC Bank Gulab)');
  if(!name) return;
  const newAcc = { id: uid('acc'), name, balance:0, customFields: [] };
  // save to firestore and local
  db.collection('accounts').doc(newAcc.id).set(newAcc).then(()=>{
    ACCOUNTS.push(newAcc);
    renderAccounts();
    refreshAccountSelect(newAcc.id);
    alert('Account created: ' + name);
  }).catch(err=>{
    console.error('Account save error',err);
    // fallback local
    ACCOUNTS.push(newAcc);
    renderAccounts();
    refreshAccountSelect(newAcc.id);
  });
});

addAccountBtn.addEventListener('click', ()=> accountPlus.click());

function refreshAccountSelect(selectId){
  fldAccount.innerHTML='';
  if(ACCOUNTS.length===0){
    const placeholder = document.createElement('option');
    placeholder.value='none'; placeholder.innerText='No accounts - create one (+)';
    fldAccount.appendChild(placeholder);
  }
  ACCOUNTS.forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a.id; opt.innerText = a.name;
    fldAccount.appendChild(opt);
  });
  if(selectId) fldAccount.value = selectId;
}

// save entry
saveEntry.addEventListener('click', async ()=>{
  const tx = {
    date: fldDate.value||todayISO(),
    type: fldType.value,
    accountId: fldAccount.value || null,
    amount: Number(fldAmount.value) || 0,
    product: fldProduct.value || '',
    qty: fldQty.value || '',
    for: fldFor.value || '',
    by: fldBy.value || '',
    from: fldFrom.value || '',
    note: fldNote.value || '',
    unpaid: fldUnpaid.checked? true:false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  // basic validation
  if(!tx.accountId || tx.accountId==='none') return alert('Select or create an account first.');
  // save to firestore
  try{
    const docRef = await db.collection('transactions').add(tx);
    tx.id = docRef.id;
    TRANSACTIONS.unshift(tx);
    await updateAccountBalanceOnTx(tx);
    if(tx.unpaid) PENDING.push(tx);
    renderAll();
    closeModalFn();
  }catch(err){
    console.error('Firestore save failed, saving locally',err);
    // local fallback - store in local array
    tx.id = uid('tx');
    TRANSACTIONS.unshift(tx);
    if(tx.unpaid) PENDING.push(tx);
    renderAll();
    closeModalFn();
  }
});

async function updateAccountBalanceOnTx(tx){
  // simple balance calc: credit increases, debit decreases, trading & loan_given treat as debit
  const acc = ACCOUNTS.find(a=>a.id===tx.accountId);
  if(!acc) return;
  if(tx.type==='credit') acc.balance += Number(tx.amount);
  else if(tx.type==='debit' || tx.type==='trading' || tx.type==='loan_given') acc.balance -= Number(tx.amount);
  // update in firestore accounts doc
  try{
    await db.collection('accounts').doc(acc.id).update({ balance: acc.balance });
  }catch(e){
    // ignore if offline
  }
}

// load initial data from firestore (accounts + recent transactions)
async function loadFromFirestore(){
  try{
    const accSnap = await db.collection('accounts').get();
    ACCOUNTS = accSnap.docs.map(d=>d.data());
  }catch(e){
    console.warn('Accounts load failed, starting empty',e);
    ACCOUNTS = [];
  }
  try{
    const txSnap = await db.collection('transactions').orderBy('createdAt','desc').limit(200).get();
    TRANSACTIONS = txSnap.docs.map(d=> ({ id:d.id, ...d.data() }) );
  }catch(e){
    console.warn('Transactions load failed',e);
    TRANSACTIONS = [];
  }
  // compute pending from transactions
  PENDING = TRANSACTIONS.filter(t=>t.unpaid);
  renderAll();
}

// render functions
function renderAccounts(){
  accountsListDiv.innerHTML='';
  ACCOUNTS.forEach(a=>{
    const div = document.createElement('div');
    div.className = 'accItem';
    div.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${a.name}</strong><div class="small muted">${a.customFields?.length ? a.customFields.join(', '):''}</div></div><div>₹${a.balance||0}</div></div>`;
    // quick +Entry & Edit
    const controls = document.createElement('div');
    controls.style.marginTop='8px';
    const addBtn = document.createElement('button'); addBtn.className='mini'; addBtn.innerText='+Entry';
    addBtn.onclick = ()=> openModal(a.id);
    const editBtn = document.createElement('button'); editBtn.className='mini'; editBtn.style.marginLeft='8px'; editBtn.innerText='Edit';
    editBtn.onclick = ()=> editAccount(a.id);
    controls.appendChild(addBtn); controls.appendChild(editBtn);
    div.appendChild(controls);
    accountsListDiv.appendChild(div);
  });
}

function editAccount(id){
  const acc = ACCOUNTS.find(a=>a.id===id);
  if(!acc) return;
  const newName = prompt('Edit account name', acc.name);
  if(!newName) return;
  acc.name = newName;
  // update firestore doc
  db.collection('accounts').doc(acc.id).set(acc).then(()=>renderAccounts());
}

// recent table render + actions
function renderRecent(){
  recentTableBody.innerHTML='';
  TRANSACTIONS.slice(0,50).forEach(tx=>{
    const tr = document.createElement('tr');
    const accName = (ACCOUNTS.find(a=>a.id===tx.accountId)||{name:'Unknown'}).name;
    tr.innerHTML = `<td>${tx.date||''}</td><td>${tx.type}</td><td>${accName}</td><td>${tx.product||tx.note||''}</td><td>₹${tx.amount||0}</td><td></td>`;
    const actionTd = tr.querySelector('td:last-child');
    if(tx.unpaid){
      const payBtn = document.createElement('button'); payBtn.className='mini'; payBtn.innerText='Mark Paid';
      payBtn.onclick = ()=> markAsPaid(tx.id);
      actionTd.appendChild(payBtn);
    }
    const delBtn = document.createElement('button'); delBtn.className='mini'; delBtn.innerText='Del';
    delBtn.style.marginLeft='6px'; delBtn.onclick = ()=> deleteTx(tx.id);
    actionTd.appendChild(delBtn);
    recentTableBody.appendChild(tr);
  });
}

// mark as paid
async function markAsPaid(txId){
  const tx = TRANSACTIONS.find(t=>t.id===txId);
  if(!tx) return;
  tx.unpaid = false;
  PENDING = PENDING.filter(p=>p.id!==txId);
  try{ await db.collection('transactions').doc(txId).update({unpaid:false}); }catch(e){}
  renderAll();
}

// delete tx
async function deleteTx(txId){
  if(!confirm('Delete this entry?')) return;
  TRANSACTIONS = TRANSACTIONS.filter(t=>t.id!==txId);
  PENDING = PENDING.filter(p=>p.id!==txId);
  try{ await db.collection('transactions').doc(txId).delete(); }catch(e){}
  renderAll();
}

// pending render
function renderPending(){
  if(PENDING.length===0) pendingList.innerHTML = '<div class="small muted">No pending udhaar</div>';
  else{
    pendingList.innerHTML='';
    PENDING.forEach(p=>{
      const d = document.createElement('div');
      d.style.display='flex'; d.style.justifyContent='space-between'; d.style.marginBottom='6px';
      d.innerHTML = `<div>${p.product||p.note||''} • ₹${p.amount}</div><div><button class="mini" onclick="markAsPaid('${p.id}')">Paid</button></div>`;
      pendingList.appendChild(d);
    });
  }
  const totalPending = PENDING.reduce((s,i)=>s+Number(i.amount||0),0);
  pendingUdhaarEl.innerText = '₹' + totalPending;
  pendingCountEl.innerText = 'Unpaid:' + PENDING.length;
}

// account summary in right column (uses renderAccounts)

// Chart rendering
function renderCharts(){
  // pie: expense by product category from TRANSACTIONS type=debit
  const expenseMap = {};
  TRANSACTIONS.filter(t=>t.type==='debit' || t.type==='loan_given').forEach(t=>{
    const k = t.product||t.note||'Other';
    expenseMap[k] = (expenseMap[k]||0) + Number(t.amount||0);
  });
  const pieLabels = Object.keys(expenseMap);
  const pieData = Object.values(expenseMap);
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx,{ type:'pie', data:{ labels:pieLabels, datasets:[{ data:pieData }] }, options:{plugins:{legend:{position:'bottom'}}}});

  // bar: simple overview totals
  const totals = { saving:0, expense:0, trading:0, invest:0 };
  TRANSACTIONS.forEach(t=>{
    if(t.type==='credit') totals.saving += Number(t.amount||0);
    if(t.type==='debit') totals.expense += Number(t.amount||0);
    if(t.type==='trading') totals.trading += Number(t.amount||0);
    if(t.type==='investment') totals.invest += Number(t.amount||0);
  });
  const barCtx = document.getElementById('barChart').getContext('2d');
  if(barChart) barChart.destroy();
  barChart = new Chart(barCtx,{ type:'bar', data:{ labels:['Total Saving','Total Expense','Trading Amount','Long Term Investment'], datasets:[{label:'Amount', data:[totals.saving,totals.expense,totals.trading,totals.invest]}]}, options:{plugins:{legend:{display:false}}}});

  // totals in header
  totalSavingEl.innerText = '₹' + Math.round(totals.saving);
  totalExpenseEl.innerText = '₹' + Math.round(totals.expense);
  tradingAmountEl.innerText = '₹' + Math.round(totals.trading);
  longTermEl.innerText = '₹' + Math.round(totals.invest);
}

// search
globalSearch.addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  if(!q){ renderRecent(); return; }
  const filtered = TRANSACTIONS.filter(t=> (t.product||'').toLowerCase().includes(q) || (t.note||'').toLowerCase().includes(q) || String(t.amount||'').includes(q));
  renderFilteredRecent(filtered);
});
function renderFilteredRecent(list){
  recentTableBody.innerHTML='';
  list.forEach(tx=>{
    const tr = document.createElement('tr');
    const accName = (ACCOUNTS.find(a=>a.id===tx.accountId)||{name:'Unknown'}).name;
    tr.innerHTML = `<td>${tx.date||''}</td><td>${tx.type}</td><td>${accName}</td><td>${tx.product||tx.note||''}</td><td>₹${tx.amount||0}</td><td></td>`;
    recentTableBody.appendChild(tr);
  });
}

// overall render
function renderAll(){
  renderAccounts();
  renderRecent();
  renderPending();
  renderCharts();
}

// initial seeding if no accounts present
async function seedDefaultAccounts(){
  if(ACCOUNTS.length>0) return;
  const defaults = [
    { id:'acc_daddy', name:'Daddy Budget', balance:11850, customFields:[] },
    { id:'acc_me', name:'My Account', balance:9500, customFields:[] },
    { id:'acc_mata', name:'Mataji Account', balance:21000, customFields:[] },
    { id:'acc_cash', name:'Cash', balance:0, customFields:[] }
  ];
  // try saving to firestore
  await Promise.all(defaults.map(async a=>{
    try{ await db.collection('accounts').doc(a.id).set(a); }catch(e){}
  }));
  ACCOUNTS = defaults;
}

// load and start
(async function init(){
  // set date default
  fldDate.value = todayISO();
  // load from firestore and seed defaults
  await loadFromFirestore();
  if(ACCOUNTS.length===0) await seedDefaultAccounts();
  await loadFromFirestore(); // reload after seed
  renderAll();
})();
