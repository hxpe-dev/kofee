import { useState, useRef } from 'react'

export function useToast() {
  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setToastVisible(true)

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setToast(''), 300)
    }, 2000)
  }

  return { toast, toastVisible, showToast }
}