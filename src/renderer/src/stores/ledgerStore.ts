import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLedgerStore = defineStore('ledger', () => {
  const list = ref<LedgerRow[]>([])
  const currentId = ref<number>(1)

  async function fetchList() {
    const res = await window.ledgerAPI.getLedgerList()
    if (res.code === 0) {
      list.value = res.data
      if (list.value.length > 0 && !list.value.find(l => l.id === currentId.value)) {
        currentId.value = list.value[0].id
      }
    }
  }

  function setCurrentId(id: number) {
    currentId.value = id
  }

  return { list, currentId, fetchList, setCurrentId }
})
