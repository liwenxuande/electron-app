import Database from 'better-sqlite3'
import DbManager from '../db/database'

export interface CategoryRow {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string
  sort_order: number
}

export class CategoryRepository {
  private dbManager: DbManager

  constructor(dbManager: DbManager) {
    this.dbManager = dbManager
  }

  selectAll(): CategoryRow[] {
    return this.dbManager.all<CategoryRow>(
      'SELECT * FROM category ORDER BY type, sort_order ASC, id ASC'
    )
  }

  selectByType(type: 'income' | 'expense'): CategoryRow[] {
    return this.dbManager.all<CategoryRow>(
      'SELECT * FROM category WHERE type = ? ORDER BY sort_order ASC, id ASC',
      [type]
    )
  }

  selectById(id: number): CategoryRow | undefined {
    return this.dbManager.get<CategoryRow>(
      'SELECT * FROM category WHERE id = ?',
      [id]
    )
  }

  insert(name: string, type: string, icon: string = '', sortOrder: number = 0): Database.RunResult {
    return this.dbManager.getDb().prepare(`
      INSERT INTO category (name, type, icon, sort_order) VALUES (?, ?, ?, ?)
    `).run(name, type, icon, sortOrder)
  }

  update(id: number, name: string, icon: string, sortOrder: number): Database.RunResult {
    return this.dbManager.getDb().prepare(`
      UPDATE category SET name = ?, icon = ?, sort_order = ? WHERE id = ?
    `).run(name, icon, sortOrder, id)
  }

  deleteById(id: number): Database.RunResult {
    return this.dbManager.getDb().prepare('DELETE FROM category WHERE id = ?').run(id)
  }

  findByName(name: string, type: string): CategoryRow | undefined {
    return this.dbManager.get<CategoryRow>(
      'SELECT * FROM category WHERE name = ? AND type = ?',
      [name, type]
    )
  }
}
