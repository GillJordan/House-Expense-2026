// app.js - UI logic with localStorage + Firestore attempts
// Replace firebaseConfig with your project values
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME"
};

let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log('Firebase initialized');
} catch(e){
  console.log('Firebase not initialized or placeholder config.');
}

// ---------- Utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function uid(){ return 'id_'+Math.random().toString(36).slice(2,9); }

// ---------- Local storage helpers ----------
const LS_ACCOUNTS = 'hf_accounts_v2';
function saveAccountsLocal(accounts){
  localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
}
function loadAccountsLocal(){
  try {
    return JSON.parse(localStorage.getItem(LS_ACCOUNTS) || '[]');
  } catch(e){ return []; }
}

// ---------- App state ----------
let accounts = loadAccountsLocal(); // {id,name,balance,customFields: [{label,value}]}
let entries = [];

// ---------- DOM refs ----------
const openAdd = $('#openAdd');
const modal = $('#modal');
const closeModal = $('#closeModal');
const entryAccount = $('#entryAccount');
const accountPlus = $('#accountPlus');
const addAccountBtn = $('#addAccountBtn');
const accountsListDiv = $('#accountsList');
const customFieldsContainer = $('#customFieldsContainer');
const customList = $('#customList');
const newFieldLabel = $('#newFieldLabel');
const addFieldBtn = $('#addFieldBtn');
const saveEntryBtn = $('#saveEntry');
const cancelEntryBtn = $('#cancelEntry');
const entryDate = $('#entryDate');
const recentTableBody = $('#recentTable tbody');

// ---------- Init ----------
function init(){
  // set today's date as default
  entryDate.valueAsDate = new Date();
  renderAccounts();
  populateAccountSelect();
  bindEvents();
}
function bindEvents(){
  openAdd.addEventListener('click', ()=>{ openModal(); });
  closeModal.addEventListener('click', closeModalFn);
  cancelEntryBtn.addEventListener('click', closeModalFn);
  accountPlus.addEventListener('click', onAccountPlusClick);
  addAccountBtn.addEventListener('click', onAccountPlusClick);
  entryAccount.addEventListener('change', onAccountChange);
  addFieldBtn.addEventListener('click', onAddFieldForAccount);
  saveEntryBtn.addEventListener('click', onSaveEntry);
}

function renderAccounts(){
  accountsListDiv.innerHTML = '';
  accounts.forEach(a=>{
    const div = document.createElement('div');
    div.className = 'accItem';
    div.innerHTML = `<div><strong>${a.name}</strong><div class="small">${a.description||''}</div></div>
      <div>₹${a.balance||0}</div>`;
    accountsListDiv.appendChild(div);
  });
}

function populateAccountSelect(){
  entryAccount.innerHTML = '';
  if(accounts.length===0){
    entryAccount.innerHTML = '<option value="">No accounts - create one (+)</option>';
  } else {
    accounts.forEach(a=>{
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      entryAccount.appendChild(opt);
    });
    // show custom fields for first account by default
    entryAccount.selectedIndex = 0;
    onAccountChange();
  }
}

function openModal(){
  modal.classList.remove('hidden');
  // if no accounts, hide custom fields area
  if(!accounts.length) customFieldsContainer.classList.add('hidden');
}
function closeModalFn(){
  modal.classList.add('hidden');
}

function onAccountPlusClick(){
  const name = prompt('Enter account name (e.g. Daddy Budget)');
  if(!name) return;
  const id = uid();
  const acc = {id,name,balance:0,customFields:[]};
  accounts.push(acc);
  saveAccountsLocal(accounts);
  renderAccounts();
  populateAccountSelect();
  // select new
  entryAccount.value = id;
  onAccountChange();
  // attempt save to Firestore
  if(db){
    db.collection('accounts').doc(id).set(acc).then(()=>console.log('saved account to firestore')).catch(e=>console.log('fs save fail',e));
  }
}

function onAccountChange(){
  const aid = entryAccount.value;
  if(!aid){ customFieldsContainer.classList.add('hidden'); return; }
  const acc = accounts.find(x=>x.id===aid);
  if(!acc){ customFieldsContainer.classList.add('hidden'); return; }
  // show custom fields area
  customFieldsContainer.classList.remove('hidden');
  renderCustomFields(acc);
}

function renderCustomFields(acc){
  customList.innerHTML = '';
  if(!acc.customFields || acc.customFields.length===0){
    customList.innerHTML = '<div class="small">No custom fields. Add one below.</div>';
    return;
  }
  acc.customFields.forEach((f,idx)=>{
    const row = document.createElement('div');
    row.style.display='flex';row.style.gap='8px';row.style.marginTop='8px';
    row.innerHTML = `<input data-idx="${idx}" data-acc="${acc.id}" class="cf_input" placeholder="${f.label}" value="${f.value||''}"/>
                     <button class="small cf_del" data-idx="${idx}" data-acc="${acc.id}">Del</button>`;
    customList.appendChild(row);
  });
  // bind delete/inputs
  Array.from(customList.querySelectorAll('.cf_del')).forEach(b=>{
    b.addEventListener('click', (ev)=>{
      const idx = Number(b.getAttribute('data-idx'));
      const aid = b.getAttribute('data-acc');
      removeCustomField(aid, idx);
    });
  });
  Array.from(customList.querySelectorAll('.cf_input')).forEach(inp=>{
    inp.addEventListener('input', (ev)=>{
      const idx = Number(inp.getAttribute('data-idx'));
      const aid = inp.getAttribute('data-acc');
      const val = inp.value;
      updateCustomFieldValue(aid, idx, val);
    });
  });
}

function onAddFieldForAccount(){
  const label = newFieldLabel.value.trim();
  if(!label) return alert('Enter field label');
  const aid = entryAccount.value;
  if(!aid) return alert('Select an account first');
  const acc = accounts.find(x=>x.id===aid);
  acc.customFields = acc.customFields || [];
  acc.customFields.push({label, value:''});
  saveAccountsLocal(accounts);
  renderCustomFields(acc);
  newFieldLabel.value = '';
  // save to firestore
  if(db){
    db.collection('accounts').doc(aid).update({customFields: acc.customFields}).catch(()=>{ /* ignore */ });
  }
}

function removeCustomField(aid, idx){
  const acc = accounts.find(x=>x.id===aid);
  if(!acc) return;
  acc.customFields.splice(idx,1);
  saveAccountsLocal(accounts);
  renderCustomFields(acc);
  if(db) db.collection('accounts').doc(aid).update({customFields: acc.customFields}).catch(()=>{});
}

function updateCustomFieldValue(aid, idx, val){
  const acc = accounts.find(x=>x.id===aid);
  if(!acc) return;
  acc.customFields[idx].value = val;
  saveAccountsLocal(accounts);
  if(db) db.collection('accounts').doc(aid).update({customFields: acc.customFields}).catch(()=>{});
}

function onSaveEntry(){
  const e = {
    id: uid(),
    date: $('#entryDate').value,
    type: $('#entryType').value,
    accountId: $('#entryAccount').value,
    amount: Number($('#entryAmount').value||0),
    product: $('#entryProduct').value,
    qty: $('#entryQty').value,
    for: $('#entryFor').value,
    by: $('#entryBy').value,
    from: $('#entryFrom').value,
    note: $('#entryNote').value,
    unpaid: $('#markUnpaid').checked,
    custom: {}
  };
  // gather custom fields for selected account
  const aid = e.accountId;
  if(aid){
    const acc = accounts.find(a=>a.id===aid);
    if(acc && acc.customFields){
      acc.customFields.forEach((f,idx)=>{
        e.custom[f.label] = f.value || '';
      });
    }
  }
  entries.unshift(e);
  renderRecent();
  closeModalFn();
  // attempt to save to firestore
  if(db){
    db.collection('transactions').doc(e.id).set(e).then(()=>console.log('saved')).catch(err=>console.log('fs tx fail',err));
  } else {
    // local fallback (persist entries)
    localStorage.setItem('hf_entries_v2', JSON.stringify(entries));
  }
}

function renderRecent(){
  recentTableBody.innerHTML = '';
  entries.forEach(en=>{
    const tr = document.createElement('tr');
    const accName = accounts.find(a=>a.id===en.accountId)?.name || '-';
    tr.innerHTML = `<td>${en.date}</td><td>${en.type}</td><td>${accName}</td><td>${en.product||en.note||''}</td><td>₹${en.amount}</td>`;
    recentTableBody.appendChild(tr);
  });
}

// initialize
init();
