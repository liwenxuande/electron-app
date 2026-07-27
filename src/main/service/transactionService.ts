import dayjs from 'dayjs'
import { TransactionRepository, TransactionFilter } from '../repository/transactionRepository'
import { CategoryRepository } from '../repository/categoryRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'
import { ApiResponse } from '../types'

export interface TransactionInput {
  type: 'income' | 'expense'
  amount: number
  categoryId: number
  ledgerId: number
  transDate: string
  description?: string
  paymentMethod?: string
}

export interface ListParams {
  type?: 'income' | 'expense'
  categoryId?: number
  ledgerId?: number
  startDate?: string
  endDate?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface CsvImportResult {
  successCount: number
  failCount: number
  skipCount: number
  errors: string[]
}

export class TransactionService {
  private repository: TransactionRepository
  private categoryRepository: CategoryRepository
  private dbManager: DbManager

  constructor(repository: TransactionRepository, categoryRepository: CategoryRepository, dbManager: DbManager) {
    this.repository = repository
    this.categoryRepository = categoryRepository
    this.dbManager = dbManager
  }

  private success<T>(data: T, msg: string = '操作成功'): ApiResponse<T> {
    return { code: 0, data, msg }
  }

  private fail(msg: string): ApiResponse<null> {
    return { code: -1, data: null, msg }
  }

  validateInput(data: TransactionInput): string | null {
    if (!data.type || (data.type !== 'income' && data.type !== 'expense')) {
      return '类型无效，必须为 income 或 expense'
    }
    if (!data.amount || data.amount <= 0) {
      return '金额必须大于0'
    }
    if (!data.categoryId) {
      return '请选择分类'
    }
    if (!data.ledgerId) {
      return '请选择账本'
    }
    if (!data.transDate) {
      return '请选择日期'
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.transDate)) {
      return '日期格式不正确（YYYY-MM-DD）'
    }
    return null
  }

  async create(data: TransactionInput): Promise<ApiResponse> {
    const error = this.validateInput(data)
    if (error) return this.fail(error)

    try {
      const createTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
      await this.dbManager.transaction(() => {
        this.repository.insert(
          data.type, data.amount, data.categoryId, data.ledgerId, data.transDate,
          data.description || '', data.paymentMethod || '', createTime
        )
      })
      logger.info(`新增记账记录成功: ${data.type} ${data.amount}`)
      return this.success(null, '新增成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`新增记账记录失败: ${errMsg}`)
      return this.fail(`新增失败: ${errMsg}`)
    }
  }

  async update(id: number, data: TransactionInput): Promise<ApiResponse> {
    const error = this.validateInput(data)
    if (error) return this.fail(error)

    try {
      const existing = this.repository.selectById(id)
      if (!existing) return this.fail('该记录不存在')

      const updateTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
      await this.dbManager.transaction(() => {
        this.repository.update(
          id, data.type, data.amount, data.categoryId, data.ledgerId, data.transDate,
          data.description || '', data.paymentMethod || '', updateTime
        )
      })
      logger.info(`编辑记账记录成功: id=${id}`)
      return this.success(null, '编辑成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`编辑记账记录失败: ${errMsg}`)
      return this.fail(`编辑失败: ${errMsg}`)
    }
  }

  async delete(id: number): Promise<ApiResponse> {
    try {
      const existing = this.repository.selectById(id)
      if (!existing) return this.fail('该记录不存在')

      await this.dbManager.run('DELETE FROM transactions WHERE id = ?', [id])
      logger.info(`删除记账记录成功: id=${id}`)
      return this.success(null, '删除成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`删除记账记录失败: ${errMsg}`)
      return this.fail(`删除失败: ${errMsg}`)
    }
  }

  getList(params: ListParams): ApiResponse {
    try {
      const filter: TransactionFilter = {
        type: params.type,
        categoryId: params.categoryId,
        ledgerId: params.ledgerId,
        startDate: params.startDate,
        endDate: params.endDate,
        keyword: params.keyword
      }
      const page = params.page || 1
      const pageSize = params.pageSize || 20
      const result = this.repository.selectList(filter, page, pageSize)
      return this.success(result, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询记账记录失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  getById(id: number): ApiResponse {
    try {
      const record = this.repository.selectById(id)
      if (!record) return this.fail('记录不存在')
      return this.success(record, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询记账记录详情失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  getMonthlyStats(yearMonth: string): ApiResponse {
    try {
      const stats = this.repository.getMonthlyStats(yearMonth)
      return this.success(stats, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询月度统计失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  getStats(startDate: string, endDate: string, categoryId?: number, ledgerId?: number, keyword?: string): ApiResponse {
    try {
      if (!startDate || !endDate) {
        return this.fail('请选择起止日期')
      }
      const filter = { startDate, endDate, categoryId, ledgerId, keyword }
      const dailyStats = this.repository.getDailyStats(filter)
      const expenseCategoryStats = this.repository.getCategoryStats(filter, 'expense')
      const incomeCategoryStats = this.repository.getCategoryStats(filter, 'income')
      const transactionCount = this.repository.getTransactionCount(filter)
      return this.success({ dailyStats, expenseCategoryStats, incomeCategoryStats, transactionCount }, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询统计数据失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  getTopTransactions(startDate: string, endDate: string, ledgerId?: number): ApiResponse {
    try {
      if (!startDate || !endDate) {
        return this.fail('请选择起止日期')
      }
      const filter = { startDate, endDate, ledgerId }
      const expenseTop = this.repository.getTopTransactions(filter, 'expense', 10)
      const incomeTop = this.repository.getTopTransactions(filter, 'income', 10)
      return this.success({ expenseTop, incomeTop }, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询单笔排行失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  async importCsv(csvText: string, ledgerId: number = 1): Promise<ApiResponse<CsvImportResult>> {
    const result: CsvImportResult = { successCount: 0, failCount: 0, skipCount: 0, errors: [] }
    const lines = csvText.trim().split(/\r?\n/)

    if (lines.length < 2) {
      return this.fail('CSV文件为空或只有表头')
    }

    const headerLine = lines[0]
    const headers = this.parseCsvLine(headerLine).map(h => h.trim().toLowerCase())

    const dateIdx = headers.findIndex(h => h.includes('日期') || h.includes('时间') || h === 'date' || h === 'time')
    const typeIdx = headers.findIndex(h => h.includes('类型') || h === 'type')
    const categoryIdx = headers.findIndex(h => h.includes('分类') || h === 'category')
    const amountIdx = headers.findIndex(h => h.includes('金额') || h === 'amount')
    const descIdx = headers.findIndex(h => h.includes('备注') || h.includes('描述') || h === 'description' || h === 'note')

    // 核心列检查：日期/时间 + 分类 + 金额 缺一不可
    if (dateIdx === -1 || categoryIdx === -1 || amountIdx === -1) {
      return this.fail('CSV格式不正确，缺少必要的列：日期（或时间）、分类、金额')
    }

    // 类型列：如果CSV中没有独立的类型列，通过金额正负推断（正值=收入，负值=支出）
    const hasTypeColumn = typeIdx !== -1

    const createTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    let rowNum = 0

    try {
      await this.dbManager.transaction(() => {
        for (let i = 1; i < lines.length; i++) {
          rowNum = i + 1
          const line = lines[i].trim()
          if (!line) continue

          const cols = this.parseCsvLine(line)
          if (cols.length < Math.max(dateIdx, categoryIdx, amountIdx) + 1) {
            result.errors.push(`第${rowNum}行: 列数不足`)
            result.failCount++
            continue
          }

          // 解析类型
          let type: string
          if (hasTypeColumn) {
            const rawType = cols[typeIdx].trim()
            if (rawType === '收入' || rawType.toLowerCase() === 'income') {
              type = 'income'
            } else if (rawType === '支出' || rawType.toLowerCase() === 'expense') {
              type = 'expense'
            } else {
              type = rawType.toLowerCase() === '收入' ? 'income' : 'expense'
            }
          } else {
            // 没有类型列：通过金额正负推断
            const rawAmount = cols[amountIdx].trim().replace(/,/g, '')
            const amountVal = parseFloat(rawAmount)
            type = amountVal >= 0 ? 'income' : 'expense'
          }

          const categoryName = cols[categoryIdx].trim()
          let category = this.categoryRepository.findByName(categoryName, type)
          if (!category) {
            const maxOrder = this.categoryRepository.selectByType(type as 'income' | 'expense').length
            this.categoryRepository.insert(categoryName, type, '', maxOrder + 1)
            const refetched = this.categoryRepository.findByName(categoryName, type)
            if (!refetched) {
              logger.error(`CSV导入: 创建分类后仍找不到 [${categoryName}]`)
              result.errors.push(`第${rowNum}行: 无法创建分类 [${categoryName}]`)
              result.failCount++
              continue
            }
            category = refetched
          }

          let transDate = cols[dateIdx].trim()
          // 处理"时间"列格式：提取日期部分（YYYY/M/D HH:mm 或 YYYY-MM-DD HH:mm）
          const datePart = transDate.split(/\s+/)[0]
          // 处理 / 分隔符
          let normalizedDate = datePart.replace(/\//g, '-')
          // 补齐月份和日期前导零（2026/6/19 → 2026-06-19）
          const dateParts = normalizedDate.split('-')
          if (dateParts.length === 3) {
            normalizedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            result.errors.push(`第${rowNum}行: 日期格式不正确 [${transDate}]`)
            result.failCount++
            continue
          }
          transDate = normalizedDate

          const amount = Math.abs(parseFloat(cols[amountIdx].trim().replace(/,/g, '')))
          if (isNaN(amount) || amount <= 0) {
            result.errors.push(`第${rowNum}行: 金额无效 [${cols[amountIdx].trim()}]`)
            result.failCount++
            continue
          }

          const description = descIdx !== -1 ? (cols[descIdx] || '').trim() : ''

          this.repository.insert(
            type, amount, category.id, ledgerId, transDate, description, '', createTime
          )
          result.successCount++
        }
      })

      logger.info(`CSV导入完成: 成功${result.successCount}, 失败${result.failCount}`)
      return this.success(result, `导入完成：成功${result.successCount}条，失败${result.failCount}条`)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`CSV导入异常: ${errMsg}`)
      return this.fail(`CSV导入异常: ${errMsg}`)
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          result.push(current)
          current = ''
        } else {
          current += ch
        }
      }
    }
    result.push(current)
    return result
  }
}
