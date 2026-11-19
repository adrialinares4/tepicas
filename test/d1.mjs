// Emulación mínima de la API de Cloudflare D1 sobre node:sqlite (solo para pruebas locales).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function createD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const plain = (r) => (r ? { ...r } : null);
  const check = (args) => args.forEach((a) => { if (a === undefined) throw new Error('D1_TYPE_ERROR: undefined bind'); });
  class Stmt {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...a) { check(a); return new Stmt(this.sql, a); }
    async first(col) { const r = plain(db.prepare(this.sql).get(...this.args)); return r && col ? r[col] : r; }
    async all() { return { success: true, results: db.prepare(this.sql).all(...this.args).map(plain), meta: {} }; }
    async run() {
      const r = db.prepare(this.sql).run(...this.args);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
  }
  return {
    prepare: (sql) => new Stmt(sql),
    batch: async (stmts) => {
      db.exec('BEGIN');
      try { const out = []; for (const s of stmts) out.push(await s.all()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    raw: db,
  };
}
