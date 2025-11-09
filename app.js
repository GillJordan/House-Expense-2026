// app.js — Neumorphic v3
// Firebase config (injected)
const firebaseConfig = {
  apiKey: "AIzaSyCZ_eQonlY2OxSyJt55Efjr8TH1BYGIQ-Q",
  authDomain: "house-expense-a4c13.firebaseapp.com",
  projectId: "house-expense-a4c13"
};

// Initialize Firebase
let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("Firestore init OK");
} catch (e) {
  console.warn("Firebase init failed, falling back to localStorage.", e);
}

// Helpers for storage fallback
function lsGet(key){ try { return JSON.parse(localStorage.getItem(key)||'null'); } catch(e){return null} }
function lsSet(key,val){ localStorage.setItem(key, JSON.stringify(val)); }

// State
let accounts = lsGet('hf_accounts') || []; // {id,name,customFields: [{id,label}]}
let entries = lsGet('hf_entries') || [];

// UI refs
const openAddEntry = document.getElementById('openAddEntry');
const modalOverlay = document.getElementById('modalOverlay');
const entryModal = document.getElementById('entryModal');
const closeModal = document.getElementById('closeModal');
const entryForm = document.getElementById('entryForm');
const entryAccount = document.getElementById('entryAccount');
const accountPlus = document.getElementById('accountPlus');
const customArea = document.getElementById('customArea');
const customList = document.getElementById('customList');
const addCustomField = document.getElementById('addCustomField');
const customLabel = document.getElementById('customLabel');
const saveEntry = document.getElementById('saveEntry');
const cancelEntry = document.getElementById('cancelEntry');
const accountsList = document.getElementById('accountsList');
const txBody = document.getElementById('txBody');

// Account modal refs
const accountOverlay = document.getElementById('accountOverlay');
const newAccountName = document.getElementById('newAccountName');
const addNewCustom = document.getElementById('addNewCustom');
const newAccountCustom = document.getElementById('newAccountCustom');
const newCustomLabel = document.getElementById('newCustomLabel');
const createAccount = document.getElementById('createAccount');
const cancelCreate = document.getElementById('cancelCreate');
const addAccountBtn = document.getElementById('addAccountBtn');
const closeAccount = document.getElementById('closeAccount');

// init date default
document.getElementById('entryDate').value = new Date().toISOString().slice(0,10);

// Modal helpers
function showModal(){ modalOverlay.classList.remove('hidden'); }
function hideModal(){ modalOverlay.classList.add('hidden'); }
function showAccountModal(){ accountOverlay.classList.remove('hidden'); }
function hideAccountModal(){ accountOverlay.classList.add('hidden'); }

openAddEntry.addEventListener('click', ()=>{ loadAccountSelect(); showModal(); });
closeModal.addEventListener('click', hideModal);
cancelEntry.addEventListener('click', hideModal);

// Account create flow
accountPlus.addEventListener('click', ()=>{ // open account modal
  newAccountName.value=''; newAccountCustom.innerHTML=''; showAccountModal();
});
addAccountBtn.addEventListener('click', ()=>{ showAccountModal(); });
closeAccount.addEventListener('click', hideAccountModal);
cancelCreate.addEventListener('click', hideAccountModal);

let newAccountFields = [];
addNewCustom.addEventListener('click', ()=>{
  const label = newCustomLabel.value.trim();
  if(!label) return alert('Add label');
  const id = 'f_'+Date.now();
  newAccountFields.push({id,label});
  renderNewAccountFields();
  newCustomLabel.value='';
});
function renderNewAccountFields(){
  newAccountCustom.innerHTML='';
  newAccountFields.forEach(f=>{
    const div = document.createElement('div'); div.className='custom-list-item';
    div.innerHTML = `<input value="${f.label}" disabled /><button data-id="${f.id}" class="btn tiny remove">Remove</button>`;
    newAccountCustom.appendChild(div);
    div.querySelector('.remove').addEventListener('click', ()=>{
      newAccountFields = newAccountFields.filter(x=>x.id!==f.id); renderNewAccountFields();
    });
  });
}

createAccount.addEventListener('click', async ()=>{
  const name = newAccountName.value.trim(); if(!name) return alert('Provide name');
  const acc = { id:'acc_'+Date.now(), name, customFields: newAccountFields.slice() };
  accounts.push(acc); saveAccounts();
  // write to firestore if available
  try{ if(db) await db.collection('accounts').doc(acc.id).set(acc); } catch(e){ console.warn('fs save account',e); }
  newAccountFields = []; hideAccountModal(); loadAccountSelect(); renderAccounts();
});

function saveAccounts(){ lsSet('hf_accounts', accounts); }

// load accounts into dropdown
function loadAccountSelect(){
  entryAccount.innerHTML='';
  if(accounts.length===0){ entryAccount.innerHTML = '<option value="">No accounts - create one (+)</option>'; }
  accounts.forEach(a=>{
    const opt = document.createElement('option'); opt.value=a.id; opt.textContent=a.name; entryAccount.appendChild(opt);
  });
  // when account changed, render custom fields for that account
  entryAccount.onchange = ()=>{ renderCustomForAccount(entryAccount.value); };
  renderCustomForAccount(entryAccount.value);
}

function renderAccounts(){
  accountsList.innerHTML='';
  accounts.forEach(a=>{
    const div = document.createElement('div'); div.className='account-item';
    div.innerHTML = `<div><strong>${a.name}</strong><div class="muted">${a.customFields?.length||0} fields</div></div><div>${renderAccountTotal(a.id)}</div>`;
    accountsList.appendChild(div);
  });
}
function renderAccountTotal(id){ // compute from entries
  const total = entries.filter(e=>e.accountId===id).reduce((s,e)=>s + Number(e.amount||0),0);
  return `₹${total||0}`;
}

// custom fields rendering for selected account
function renderCustomForAccount(accountId){
  customList.innerHTML='';
  if(!accountId){ customArea.style.display='none'; return; }
  const acc = accounts.find(a=>a.id===accountId);
  if(!acc){ customArea.style.display='none'; return; }
  customArea.style.display='block';
  (acc.customFields||[]).forEach(f=>{
    const id = 'cf_'+f.id;
    const wrapper = document.createElement('div'); wrapper.className='custom-list-item';
    wrapper.innerHTML = `<label style="flex:1">${f.label}<input id="${id}" /></label>`;
    customList.appendChild(wrapper);
  });
}

// add custom field in modal linked to chosen account
addCustomField.addEventListener('click', ()=>{
  const accountId = entryAccount.value;
  if(!accountId) return alert('Select an account first or create one');
  const label = customLabel.value.trim(); if(!label) return alert('Add label');
  const acc = accounts.find(a=>a.id===accountId); if(!acc) return;
  const field = { id:'cf_'+Date.now(), label };
  acc.customFields = acc.customFields || []; acc.customFields.push(field);
  saveAccounts();
  // save to firestore
  try{ if(db) db.collection('accounts').doc(acc.id).set(acc); } catch(e){ console.warn(e); }
  renderCustomForAccount(accountId);
  customLabel.value='';
  renderAccounts();
});

// Save entry
saveEntry.addEventListener('click', async ()=>{
  const obj = {
    date: document.getElementById('entryDate').value || new Date().toISOString().slice(0,10),
    type: document.getElementById('entryType').value,
    accountId: entryAccount.value,
    amount: Number(document.getElementById('entryAmount').value||0),
    product: document.getElementById('entryProduct').value,
    qty: document.getElementById('entryQty').value,
    for: document.getElementById('entryFor').value,
    by: document.getElementById('entryBy').value,
    from: document.getElementById('entryFrom').value,
    note: document.getElementById('entryNote').value,
    unpaid: !!document.getElementById('entryUnpaid').checked,
    createdAt: new Date().toISOString()
  };
  // collect custom fields
  const acc = accounts.find(a=>a.id===obj.accountId);
  if(acc && acc.customFields){
    obj.custom = {};
    acc.customFields.forEach(f=>{
      const el = document.getElementById('cf_'+f.id);
      if(el) obj.custom[f.label] = el.value;
    });
  }
  // push to local entries and attempt firestore
  entries.unshift(obj); lsSet('hf_entries', entries);
  try{
    if(db) await db.collection('transactions').add(obj);
  }catch(e){ console.warn('fs save entry', e); }
  hideModal(); renderEntries(); renderAccounts(); updateTotals();
});

function renderEntries(){
  txBody.innerHTML='';
  entries.slice(0,50).forEach(e=>{
    const accName = (accounts.find(a=>a.id===e.accountId)||{}).name || e.accountId || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.date}</td><td>${e.type}</td><td>${accName}</td><td>${e.product||e.note||''}</td><td>₹${e.amount||0}</td>`;
    txBody.appendChild(tr);
  });
}

// load data from firestore on start (try)
async function tryLoadFromFirestore(){
  if(!db) return;
  try{
    const accSnap = await db.collection('accounts').get();
    accounts = accSnap.docs.map(d=>d.data());
    const txSnap = await db.collection('transactions').orderBy('createdAt','desc').limit(200).get();
    entries = txSnap.docs.map(d=>d.data());
    // persist locally
    saveAccounts(); lsSet('hf_entries', entries);
    console.log('Loaded from Firestore');
  }catch(e){ console.warn('load fs', e); }
}

// UI initial render
function renderAll(){
  loadAccountSelect();
  renderAccounts();
  renderEntries();
  updateTotals();
  try{ initCharts(); }catch(e){ console.warn(e); }
}
renderAll();
tryLoadFromFirestore();

// update totals
function updateTotals(){
  const totalSaving = entries.filter(e=>e.type==='credit').reduce((s,e)=>s+Number(e.amount||0),0);
  const totalExpense = entries.filter(e=>e.type==='debit').reduce((s,e)=>s+Number(e.amount||0),0);
  const trading = entries.filter(e=>e.product && e.product.toLowerCase().includes('trade')).reduce((s,e)=>s+Number(e.amount||0),0);
  const long = entries.filter(e=>e.product && e.product.toLowerCase().includes('invest')).reduce((s,e)=>s+Number(e.amount||0),0);
  const pending = entries.filter(e=>e.unpaid).reduce((s,e)=>s+Number(e.amount||0),0);
  document.getElementById('totalSaving').innerText = '₹'+totalSaving;
  document.getElementById('totalExpense').innerText = '₹'+totalExpense;
  document.getElementById('totalTrading').innerText = '₹'+trading;
  document.getElementById('totalLong').innerText = '₹'+long;
  document.getElementById('totalPending').innerText = '₹'+pending;
}

// Charts (demo)
let pieChart, barChart;
function initCharts(){
  const ctx1 = document.getElementById('pieChart').getContext('2d');
  const ctx2 = document.getElementById('barChart').getContext('2d');
  const labels = ['Rent','Food','Trading','Other'];
  const data = [30,25,35,10];
  if(pieChart) pieChart.destroy();
  if(barChart) barChart.destroy();
  pieChart = new Chart(ctx1,{ type:'pie', data:{labels, datasets:[{data}] } });
  barChart = new Chart(ctx2,{ type:'bar', data:{labels:['Saving','Expense','Trading','Investment'], datasets:[{label:'Amount',data:[30000,15000,8000,4000]}]} });
}

// Quick shortcuts
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ hideModal(); hideAccountModal(); } });