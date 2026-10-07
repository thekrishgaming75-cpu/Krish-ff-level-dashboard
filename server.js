const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "dashboard.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  uid TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'IND',
  status TEXT NOT NULL DEFAULT 'OFFLINE',
  played INTEGER NOT NULL DEFAULT 0,
  initial_exp INTEGER NOT NULL DEFAULT 0,
  current_exp INTEGER NOT NULL DEFAULT 0,
  gained_exp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const admin = db.prepare("SELECT id FROM users WHERE username=?").get(ADMIN_USER);
if (!admin) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(ADMIN_USER, hash);
  console.log(`Created admin user: ${ADMIN_USER}`);
  if (ADMIN_PASSWORD === "change-me") {
    console.log("IMPORTANT: change ADMIN_PASSWORD/JWT_SECRET before deploying.");
  }
}

const count = db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;
if (!count) {
  const insert = db.prepare(`
    INSERT INTO accounts
    (name,uid,region,status,played,initial_exp,current_exp,gained_exp,level,progress)
    VALUES (@name,@uid,@region,@status,@played,@initial_exp,@current_exp,@gained_exp,@level,@progress)
  `);
  const seed = db.transaction(() => {
    insert.run({name:"KRISH-LV-3",uid:"18477024524",region:"IND",status:"ONLINE",played:145,initial_exp:202,current_exp:4845,gained_exp:4643,level:8,progress:84});
    insert.run({name:"KRISH-LV-2",uid:"18476932317",region:"IND",status:"SEARCHING",played:131,initial_exp:202,current_exp:4664,gained_exp:4462,level:8,progress:67});
  });
  seed();
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({error:"Authentication required"});
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({error:"Invalid or expired token"});
  }
}

app.post("/api/login", (req,res) => {
  const {username,password} = req.body || {};
  if (!username || !password) return res.status(400).json({error:"Username and password are required"});
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password,user.password_hash))
    return res.status(401).json({error:"Invalid username or password"});
  const token = jwt.sign({id:user.id,username:user.username}, JWT_SECRET, {expiresIn:"8h"});
  res.json({token, username:user.username});
});

app.get("/api/accounts", auth, (req,res) => {
  const accounts = db.prepare("SELECT * FROM accounts ORDER BY id DESC").all();
  res.json(accounts);
});

app.post("/api/accounts", auth, (req,res) => {
  const a = req.body || {};
  if (!a.name || !a.uid) return res.status(400).json({error:"name and uid are required"});
  try {
    const result = db.prepare(`
      INSERT INTO accounts(name,uid,region,status,played,initial_exp,current_exp,gained_exp,level,progress)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(
      String(a.name), String(a.uid), String(a.region || "IND"),
      String(a.status || "OFFLINE"), Number(a.played || 0),
      Number(a.initial_exp || 0), Number(a.current_exp || 0),
      Number(a.gained_exp || 0), Number(a.level || 1),
      Math.max(0,Math.min(100,Number(a.progress || 0)))
    );
    res.status(201).json(db.prepare("SELECT * FROM accounts WHERE id=?").get(result.lastInsertRowid));
  } catch (e) {
    res.status(409).json({error:"UID already exists"});
  }
});

app.put("/api/accounts/:id", auth, (req,res) => {
  const id = Number(req.params.id);
  const a = req.body || {};
  const exists = db.prepare("SELECT id FROM accounts WHERE id=?").get(id);
  if (!exists) return res.status(404).json({error:"Account not found"});

  db.prepare(`
    UPDATE accounts SET
      name=COALESCE(?,name), region=COALESCE(?,region), status=COALESCE(?,status),
      played=COALESCE(?,played), initial_exp=COALESCE(?,initial_exp),
      current_exp=COALESCE(?,current_exp), gained_exp=COALESCE(?,gained_exp),
      level=COALESCE(?,level), progress=COALESCE(?,progress),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    a.name ?? null, a.region ?? null, a.status ?? null,
    a.played ?? null, a.initial_exp ?? null, a.current_exp ?? null,
    a.gained_exp ?? null, a.level ?? null, a.progress ?? null, id
  );
  res.json(db.prepare("SELECT * FROM accounts WHERE id=?").get(id));
});

app.delete("/api/accounts/:id", auth, (req,res) => {
  const result = db.prepare("DELETE FROM accounts WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({error:"Account not found"});
  res.json({ok:true});
});

/*
  This refresh endpoint intentionally does NOT connect to a game service.
  Put your own authorized data provider here and update the SQLite record.
*/
app.post("/api/accounts/:id/refresh", auth, (req,res) => {
  const id = Number(req.params.id);
  const account = db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
  if (!account) return res.status(404).json({error:"Account not found"});
  db.prepare("UPDATE accounts SET updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  res.json(db.prepare("SELECT * FROM accounts WHERE id=?").get(id));
});

app.get("*", (req,res) => {
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT, () => console.log(`FF LEVEL dashboard running at http://localhost:${PORT}`));
