import Database from 'better-sqlite3'
import DbManager from '../db/database'

export interface LedgerRow {
  id: number
  name: string
  description: string
  create_time: string
}

export class LedgerRepository {
  private dbManager: DbManager

  constructor(dbManager: DbManager) {
    this.dbManager = dbManager
  }

  selectAll(): LedgerRow[] {
    return this.dbManager.all<LedgerRow>('SELECT * FROM ledger ORDER BY id ASC')
  }

  selectById(id: number): LedgerRow | undefined {
    return this.dbManager.get<LedgerRow>('SELECT * FROM ledger WHERE id = ?', [id])
  }

  insert(name: string, description: string): Database.RunResult {
    return this.dbManager.getDb().prepare(
      'INSERT INTO ledger (name, description) VALUES (?, ?)'
    ).run(name, description)
  }

  update(id: number, name: string, description: string): Database.RunResult {
    return this.dbManager.getDb().prepare(
      'UPDATE ledger SET name = ?, description = ? WHERE id = ?'
    ).run(name, description, id)
  }

  deleteById(id: number): Database.RunResult {
    return this.dbManager.getDb().prepare('DELETE FROM ledger WHERE id = ?').run(id)
  }
}
