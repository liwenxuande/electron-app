export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'list_transactions',
    description: '查询账单记录，支持按类型、分类、账本、日期范围、关键字筛选和分页',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型' },
        categoryId: { type: 'integer', description: '分类ID' },
        ledgerId: { type: 'integer', description: '账本ID，默认1' },
        startDate: { type: 'string', description: '开始日期 YYYY-MM-DD' },
        endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
        keyword: { type: 'string', description: '备注模糊搜索' },
        page: { type: 'integer', description: '页码，默认1' },
        pageSize: { type: 'integer', description: '每页条数，默认20' }
      }
    }
  },
  {
    name: 'get_transaction',
    description: '按ID查询单条账单记录',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: '账单ID' } },
      required: ['id']
    }
  },
  {
    name: 'create_transaction',
    description: '新增一条收支记录',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（必填）' },
        amount: { type: 'number', description: '金额，必须大于0（必填）' },
        categoryId: { type: 'integer', description: '分类ID（必填）' },
        ledgerId: { type: 'integer', description: '账本ID（必填）' },
        transDate: { type: 'string', description: '交易日期 YYYY-MM-DD（必填）' },
        description: { type: 'string', description: '备注（可选）' },
        paymentMethod: { type: 'string', description: '支付方式（可选）' }
      },
      required: ['type', 'amount', 'categoryId', 'ledgerId', 'transDate']
    }
  },
  {
    name: 'update_transaction',
    description: '编辑一条已有账单记录',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: '账单ID（必填）' },
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（必填）' },
        amount: { type: 'number', description: '金额，必须大于0（必填）' },
        categoryId: { type: 'integer', description: '分类ID（必填）' },
        ledgerId: { type: 'integer', description: '账本ID（必填）' },
        transDate: { type: 'string', description: '交易日期 YYYY-MM-DD（必填）' },
        description: { type: 'string', description: '备注（可选）' },
        paymentMethod: { type: 'string', description: '支付方式（可选）' }
      },
      required: ['id', 'type', 'amount', 'categoryId', 'ledgerId', 'transDate']
    }
  },
  {
    name: 'delete_transaction',
    description: '删除一条账单记录（不可恢复）',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: '账单ID（必填）' } },
      required: ['id']
    }
  },
  {
    name: 'list_ledgers',
    description: '查询所有账本列表',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_categories',
    description: '查询分类列表，可按收支类型筛选',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（可选）' }
      }
    }
  }
]
