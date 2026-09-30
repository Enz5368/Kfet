const path=require('path');
const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const Database=require('better-sqlite3');

const db=new Database(process.env.DATABASE_PATH||path.join(__dirname,'data','kfet.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pizzas (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
const defaults={pizzaSaumon:25,pizzaThon:25,pizzaRoyale:25,nuggets:150,nuggetsAvailable:true,croqueChevre:true,croqueJambon:true};
const defaultPizzas=[{id:'pizzaSaumon',name:'Saumon'},{id:'pizzaThon',name:'Thon'},{id:'pizzaRoyale',name:'Royale'}];
if(!db.prepare('SELECT 1 FROM pizzas LIMIT 1').get()){const add=db.prepare('INSERT INTO pizzas VALUES (?,?)');defaultPizzas.forEach(p=>add.run(p.id,p.name));}
if(!db.prepare('SELECT 1 FROM stock LIMIT 1').get()){const add=db.prepare('INSERT INTO stock VALUES (?,?)');Object.entries(defaults).forEach(([id,value])=>add.run(id,JSON.stringify(value)));}
function state(){return {orders:db.prepare('SELECT data FROM orders ORDER BY id DESC').all().map(r=>JSON.parse(r.data)),pizzas:db.prepare('SELECT id,name FROM pizzas ORDER BY rowid').all(),stock:Object.fromEntries(db.prepare('SELECT id,data FROM stock').all().map(r=>[r.id,JSON.parse(r.data)]))};}
function replaceState(next){
  if(!Array.isArray(next.orders)||!Array.isArray(next.pizzas)||!next.stock||typeof next.stock!=='object')throw Error('Données invalides');
  const write=db.transaction(()=>{db.prepare('DELETE FROM orders').run();db.prepare('DELETE FROM pizzas').run();db.prepare('DELETE FROM stock').run();const order=db.prepare('INSERT INTO orders VALUES (?,?)'),pizza=db.prepare('INSERT INTO pizzas VALUES (?,?)'),stock=db.prepare('INSERT INTO stock VALUES (?,?)');next.orders.forEach(o=>order.run(Number(o.id),JSON.stringify(o)));next.pizzas.forEach(p=>pizza.run(String(p.id),String(p.name)));Object.entries(next.stock).forEach(([id,value])=>stock.run(id,JSON.stringify(value)));});write();
}
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(__dirname,'public')));
app.get('/api/state',(req,res)=>res.json(state()));
app.put('/api/state',(req,res)=>{try{replaceState(req.body);const current=state();io.emit('state:changed',current);res.json(current)}catch(error){res.status(400).json({error:error.message})}});
io.on('connection',socket=>socket.emit('state:changed',state()));
const port=Number(process.env.PORT||3000);server.listen(port,()=>console.log(`Kfet listening on ${port}`));
