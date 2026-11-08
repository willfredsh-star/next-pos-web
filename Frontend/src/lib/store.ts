/* NEXT POS data layer. The UI contract is kept stable; data is loaded from Django API. */
import { useSyncExternalStore } from 'react'
export type Role = 'manager' | 'cashier'
export type Account = { id:string; name:string; email:string; title:string; role:Role; active:boolean; createdAt:number; createdBy:string|null }
export type Shift = { id:string; cashierId:string; startedAt:number; endedAt:number|null }
export type TransactionLine = { name:string; unitPrice:number; quantity:number }
export type Transaction = { id:string; number:number; cashierId:string; shiftId:string; at:number; items:number; subtotal:number; discount?:number; tax:number; total:number; orderType:string; guestCount?:number|null; lines?:TransactionLine[] }
export type Product = { id:number; name:string; description:string; price:number; category:string; image:string; tag:string; active:boolean }
export type Result<T> = {ok:true;value:T}|{ok:false;error:string;code?:string}
export type ShiftStats = {shift:Shift;orders:number;items:number;sales:number;avgTicket:number;durationMs:number;ordersPerHour:number}
export type CashierSummary = {account:Account;activeShift:Shift|null;shifts:number;orders:number;items:number;sales:number;avgTicket:number;ordersPerHour:number;durationMs:number;recent:ShiftStats[]}
export const MIN_PASSWORD=8
const HOUR=3600000, DAY=86400000
const API=import.meta.env.VITE_API_BASE_URL || '/api'
const KEYS={taxRate:'nextpos.taxRate',token:'nextpos.apiToken',account:'nextpos.account',remember:'nextpos.remember',cashiers:'nextpos.accounts',shifts:'nextpos.shifts',transactions:'nextpos.transactions',products:'nextpos.products',nextNumber:'nextpos.nextOrderNumber'}
const memory=new Map<string,string>()
function getItem(k:string):string|null {try{return localStorage.getItem(k)??sessionStorage.getItem(k)}catch{return memory.get(k)??null}}
function setItem(k:string,v:string){try{localStorage.setItem(k,v)}catch{memory.set(k,v)}}
function removeItem(k:string){try{localStorage.removeItem(k);sessionStorage.removeItem(k)}catch{memory.delete(k)}}
function parse<T>(k:string,f:T):T{try{const s=getItem(k);return s?JSON.parse(s) as T:f}catch{return f}}
function persist(k:string,v:unknown){setItem(k,JSON.stringify(v));emit()}
function token(){return getItem(KEYS.token)}
async function api<T>(path:string, options:RequestInit={}, authenticated=true):Promise<T>{
 const headers=new Headers(options.headers); if(options.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json'); if(authenticated&&token()) headers.set('Authorization',`Token ${token()}`)
 const sent=token()
 let response:Response
 try{response=await fetch(`${API}${path}`,{...options,headers})}catch{throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.')}
 if(response.status===401&&authenticated&&sent){expireSession(sent);throw new Error('Sesi Anda berakhir. Silakan masuk kembali.')}
 let body:any={}; try{body=await response.json()}catch{}
 if(!response.ok){const err:any=new Error(body.error||body.detail||Object.values(body).flat().join(' ')||`Permintaan gagal (${response.status})`);err.code=body.code;throw err}
 return body as T
}
let accounts:Account[]=parse(KEYS.cashiers,[]), shifts:Shift[]=parse(KEYS.shifts,[]), transactions:Transaction[]=parse(KEYS.transactions,[]), products:Product[]=parse(KEYS.products,[])
let nextNumber:number=Number(getItem(KEYS.nextNumber))||0
let taxRate:number=(()=>{const raw=getItem(KEYS.taxRate);const n=raw===null?NaN:Number(raw);return Number.isFinite(n)&&n>=0&&n<1?n:0.11})()
let sessionNotice=''
let version=0;const listeners=new Set<()=>void>();const pendingShiftStarts=new Map<string,Promise<unknown>>()
const messageListeners=new Set<(message:string)=>void>()
/** Pesan dari lapisan data (mis. gagal menyimpan) untuk ditampilkan UI sebagai toast. */
export function subscribeMessages(fn:(message:string)=>void){messageListeners.add(fn);return()=>{messageListeners.delete(fn)}}
export function notify(message:string){messageListeners.forEach(fn=>fn(message))}
/** Pesan "sesi berakhir" untuk layar login; dibaca sekali lalu dikosongkan. */
export function consumeSessionNotice(){const m=sessionNotice;sessionNotice='';return m}
/** Tarif pajak resmi dari server (hanya untuk tampilan; server menghitung ulang). */
export function getTaxRate(){return taxRate}
// Token ditolak server (kedaluwarsa, dicabut, kata sandi direset, akun dinonaktifkan): keluar dan kembali ke layar login.
function expireSession(sentToken:string|null){if(!sentToken||token()!==sentToken)return;sessionNotice='Sesi Anda berakhir. Silakan masuk kembali.';removeItem(KEYS.token);removeItem(KEYS.account);clearCache();emit()}
// Pembaruan optimistis yang gagal di server: beri tahu pengguna dan kembalikan tampilan ke data server.
function fail(prefix:string,error:unknown){console.error(error);if(!token())return;notify(`${prefix} ${(error as Error).message||''}`.trim());void refresh().catch(()=>{})}
function emit(){version++;listeners.forEach(fn=>fn())}
export function subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn)}
export function useStoreVersion(){return useSyncExternalStore(subscribe,()=>version)}
function clearCache(){accounts=[];shifts=[];transactions=[];products=[];nextNumber=0;[KEYS.cashiers,KEYS.shifts,KEYS.transactions,KEYS.products,KEYS.nextNumber].forEach(removeItem)}
function saveCache(){setItem(KEYS.cashiers,JSON.stringify(accounts));setItem(KEYS.shifts,JSON.stringify(shifts));setItem(KEYS.transactions,JSON.stringify(transactions));setItem(KEYS.products,JSON.stringify(products));setItem(KEYS.nextNumber,String(nextNumber));emit()}
function cacheBootstrap(data:any){accounts=[...(data.cashiers||[])];const me=data.account as Account;if(me&&!accounts.some(a=>a.id===me.id))accounts.push(me);shifts=data.shifts||[];transactions=data.transactions||[];products=data.products||[];if(typeof data.nextOrderNumber==='number')nextNumber=data.nextOrderNumber;if(typeof data.taxRate==='number'&&data.taxRate>=0&&data.taxRate<1){taxRate=data.taxRate;setItem(KEYS.taxRate,String(taxRate))};if(me)setItem(KEYS.account,JSON.stringify(me));saveCache()}
async function refresh(){if(!token())return;const data=await api<any>('/bootstrap/');cacheBootstrap(data)}
export function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d.getTime()}
export function currentAccount():Account|null {if(!token())return null;return parse<Account|null>(KEYS.account,null)}
export function logout(){const t=token();if(t) void api('/auth/logout/',{method:'POST'}).catch(()=>{});removeItem(KEYS.token);removeItem(KEYS.account);clearCache();emit()}
function valid(name:string,email:string,password:string){if(name.trim().length<2)return 'Nama lengkap minimal 2 karakter.';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return 'Masukkan alamat email yang valid.';if(password.length<MIN_PASSWORD)return `Kata sandi minimal ${MIN_PASSWORD} karakter.`;return null}
function setAuth(data:any,remember:boolean):Account{clearCache();removeItem(KEYS.token);try{(remember?localStorage:sessionStorage).setItem(KEYS.token,data.token)}catch{memory.set(KEYS.token,data.token)}setItem(KEYS.account,JSON.stringify(data.account));return data.account}
export type RegisterOutcome={account:Account|null;email:string;emailSent:boolean}
export async function registerManager(input:{name:string;email:string;password:string},remember:boolean):Promise<Result<RegisterOutcome>>{const issue=valid(input.name,input.email,input.password);if(issue)return{ok:false,error:issue};try{const data=await api<any>('/auth/register-manager/',{method:'POST',body:JSON.stringify(input)},false);if(data.token){const account=setAuth(data,remember);await refresh();return{ok:true,value:{account,email:account.email,emailSent:false}}}return{ok:true,value:{account:null,email:String(data.email||input.email).trim(),emailSent:data.emailSent===true}}}catch(e){return{ok:false,error:(e as Error).message,code:(e as any).code}}}
/** Konfirmasi tautan verifikasi dari email. Mengembalikan alamat email yang diverifikasi. */
export async function verifyEmail(token:string):Promise<Result<string>>{try{const data=await api<any>('/auth/verify-email/',{method:'POST',body:JSON.stringify({token})},false);return{ok:true,value:String(data.email||'')}}catch(e){return{ok:false,error:(e as Error).message}}}
/** Minta email verifikasi baru. Server selalu menjawab sama agar email terdaftar tidak bisa ditebak. */
export async function resendVerification(email:string):Promise<Result<true>>{if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return{ok:false,error:'Masukkan alamat email yang valid.'};try{await api('/auth/resend-verification/',{method:'POST',body:JSON.stringify({email})},false);return{ok:true,value:true}}catch(e){return{ok:false,error:(e as Error).message}}}
export async function login(email:string,password:string,remember:boolean):Promise<Result<Account>>{if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return{ok:false,error:'Masukkan alamat email yang valid.'};if(!password)return{ok:false,error:'Masukkan kata sandi Anda.'};try{const data=await api<any>('/auth/login/',{method:'POST',body:JSON.stringify({email,password})},false);const account=setAuth(data,remember);await refresh();return{ok:true,value:account}}catch(e){return{ok:false,error:(e as Error).message,code:(e as any).code}}}
export async function createCashier(actorId:string,input:{name:string;email:string;password:string;title:string}):Promise<Result<Account>>{const issue=valid(input.name,input.email,input.password);if(issue)return{ok:false,error:issue};try{const account=await api<Account>('/cashiers/',{method:'POST',body:JSON.stringify(input)});accounts=[...accounts,account];saveCache();return{ok:true,value:account}}catch(e){return{ok:false,error:(e as Error).message}}}
export async function resetCashierPassword(_actorId:string,cashierId:string,password:string):Promise<Result<true>>{if(password.length<MIN_PASSWORD)return{ok:false,error:`Kata sandi minimal ${MIN_PASSWORD} karakter.`};try{await api('/cashiers/password/',{method:'POST',body:JSON.stringify({id:cashierId,password})});return{ok:true,value:true}}catch(e){return{ok:false,error:(e as Error).message}}}
export function setCashierActive(_actorId:string,cashierId:string,active:boolean):Result<true>{const found=accounts.some(a=>a.id===cashierId&&a.role==='cashier');if(!found)return{ok:false,error:'Kasir tidak ditemukan.'};accounts=accounts.map(a=>a.id===cashierId?{...a,active}:a);if(!active)shifts=shifts.map(s=>s.cashierId===cashierId&&s.endedAt===null?{...s,endedAt:Date.now()}:s);saveCache();void api('/cashiers/',{method:'PATCH',body:JSON.stringify({id:cashierId,active})}).catch(e=>fail('Gagal mengubah status kasir.',e));return{ok:true,value:true}}
export function updateProfile(accountId:string,changes:{name:string;title:string}):Result<Account>{const account=currentAccount();if(!account||account.id!==accountId)return{ok:false,error:'Akun tidak ditemukan.'};if(changes.name.trim().length<2)return{ok:false,error:'Nama lengkap minimal 2 karakter.'};const updated={...account,name:changes.name.trim(),title:changes.title.trim()||account.title};setItem(KEYS.account,JSON.stringify(updated));accounts=accounts.map(a=>a.id===accountId?updated:a);saveCache();void api<Account>('/profile/',{method:'PATCH',body:JSON.stringify(changes)}).then(data=>{setItem(KEYS.account,JSON.stringify(data));accounts=accounts.map(a=>a.id===accountId?data:a);saveCache()}).catch(e=>fail('Gagal menyimpan profil.',e));return{ok:true,value:updated}}
export function listCashiers(){return accounts.filter(a=>a.role==='cashier')}
export function listShifts(since=0){return shifts.filter(s=>(s.endedAt??Date.now())>=since).sort((a,b)=>b.startedAt-a.startedAt)}
export function activeShift(cashierId:string){return shifts.find(s=>s.cashierId===cashierId&&s.endedAt===null)??null}
export function startShift(cashierId:string):Shift{let s=activeShift(cashierId);if(s&&Date.now()-s.startedAt<14*HOUR)return s;if(s){shifts=shifts.map(x=>x.id===s!.id?{...x,endedAt:x.startedAt+14*HOUR}:x)}s={id:`local-${Date.now()}`,cashierId,startedAt:Date.now(),endedAt:null};shifts=[s,...shifts];saveCache();const pending=api<Shift>('/shifts/',{method:'POST',body:JSON.stringify({action:'start'})}).then(async saved=>{shifts=shifts.map(x=>x.id===s!.id?saved:x);saveCache();await refresh();return saved}).catch(error=>{fail('Gagal memulai shift.',error);throw error}).finally(()=>pendingShiftStarts.delete(cashierId));pending.catch(()=>{});pendingShiftStarts.set(cashierId,pending);return s}
export function endShift(cashierId:string,endedAt=Date.now()):Shift|null{const s=activeShift(cashierId);if(!s)return null;const closed={...s,endedAt};shifts=shifts.map(x=>x.id===s.id?closed:x);saveCache();void api('/shifts/',{method:'POST',body:JSON.stringify({action:'end'})}).catch(e=>fail('Gagal mengakhiri shift.',e));return closed}
// Nomor pesanan berurutan per manajer; angka resmi datang dari server (nextOrderNumber), data lokal hanya cadangan.
export function nextOrderNumber(){const nums=transactions.map(t=>t.number);const local=nums.length?Math.max(...nums)+1:1;return Math.max(nextNumber,local)}
export type OrderLine={productId:number;qty:number}
export type DiscountInput={type:'percent'|'amount';value:number}
// Klien hanya mengirim menu + jumlah + spesifikasi diskon. Harga, diskon rupiah, pajak, dan total dihitung SERVER.
export async function recordTransaction(input:{cashierId:string;lines:OrderLine[];discount?:DiscountInput|null;orderType:string;guestCount?:number|null}):Promise<Result<Transaction>>{
 const shift=activeShift(input.cashierId)
 if(!shift)return{ok:false,error:'Aktifkan shift terlebih dahulu sebelum memproses pembayaran.'}
 const {cashierId:_cashierId,...payload}=input
 try{const pending=pendingShiftStarts.get(input.cashierId);if(pending)await pending;const saved=await api<Transaction>('/transactions/',{method:'POST',body:JSON.stringify(payload)});transactions=[saved,...transactions.filter(t=>t.id!==saved.id)];nextNumber=Math.max(nextNumber,saved.number+1);saveCache();return{ok:true,value:saved}}
 catch(e){if(token())void refresh().catch(()=>{});return{ok:false,error:(e as Error).message}}
}
export function listTransactions(options?:{cashierId?:string;since?:number}){return transactions.filter(tx=>(!options?.cashierId||tx.cashierId===options.cashierId)&&(!options?.since||tx.at>=options.since)).sort((a,b)=>b.at-a.at)}
export function shiftStats(shift:Shift,all:Transaction[],now=Date.now()):ShiftStats{const own=all.filter(t=>t.shiftId===shift.id),orders=own.length,items=own.reduce((s,t)=>s+t.items,0),sales=own.reduce((s,t)=>s+t.total,0),durationMs=Math.max(0,(shift.endedAt??now)-shift.startedAt),hours=Math.max(durationMs,10*60000)/HOUR;return{shift,orders,items,sales,avgTicket:orders?sales/orders:0,durationMs,ordersPerHour:orders/hours}}
export function currentShiftStats(cashierId:string):ShiftStats|null{const s=activeShift(cashierId);return s?shiftStats(s,transactions):null}
export function cashierSummaries(since=0):CashierSummary[]{const now=Date.now();return listCashiers().map(account=>{const ownShifts=shifts.filter(s=>s.cashierId===account.id&&(s.endedAt??now)>=since),stats=ownShifts.map(s=>shiftStats(s,transactions,now)),activeShift=ownShifts.find(s=>s.endedAt===null)||null;const orders=stats.reduce((n,s)=>n+s.orders,0),items=stats.reduce((n,s)=>n+s.items,0),sales=stats.reduce((n,s)=>n+s.sales,0),durationMs=stats.reduce((n,s)=>n+s.durationMs,0);return{account,activeShift,shifts:ownShifts.length,orders,items,sales,avgTicket:orders?sales/orders:0,ordersPerHour:durationMs?orders/(durationMs/HOUR):0,durationMs,recent:stats.slice(0,5)}})}
export async function ensureSeed():Promise<void>{if(token()){try{await refresh()}catch(e){console.error('API bootstrap failed:',e)}}}
export function listProducts(){return products}
export async function addProduct(input:Omit<Product,'id'>):Promise<Result<Product>>{try{const p=await api<Product>('/products/',{method:'POST',body:JSON.stringify(input)});products=[...products,p];saveCache();return{ok:true,value:p}}catch(e){return{ok:false,error:(e as Error).message}}}
export function toggleProduct(id:number):Result<true>{const p=products.find(x=>x.id===id);if(!p)return{ok:false,error:'Menu tidak ditemukan.'};products=products.map(x=>x.id===id?{...x,active:!x.active}:x);saveCache();void api('/products/',{method:'PATCH',body:JSON.stringify({id,active:!p.active})}).catch(e=>fail('Gagal menyimpan perubahan menu.',e));return{ok:true,value:true}}
export function deleteProduct(id:number):Result<true>{products=products.filter(x=>x.id!==id);saveCache();void api('/products/',{method:'DELETE',body:JSON.stringify({id})}).catch(e=>fail('Gagal menghapus menu.',e));return{ok:true,value:true}}


export type HourlySalesSlot = { hour: number; sales: number; orders: number }
export type HourlySalesReport = {
  date: string
  timezone: string
  startHour: number
  endHour: number
  totalSales: number
  totalOrders: number
  hours: HourlySalesSlot[]
}

/** Laporan per jam dihitung backend dari transaksi persisten, bukan cache browser. */
export async function getHourlySales(date: string, timezone: string): Promise<HourlySalesReport> {
  const params = new URLSearchParams({ date, timezone })
  return api<HourlySalesReport>(`/reports/hourly-sales/?${params.toString()}`)
}
