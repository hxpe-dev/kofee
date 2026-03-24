'use client'

import { Component, ReactNode } from 'react'
import styles from '@/styles/errorBoundary.module.css'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.page}>
          <div className={styles.coffeeIcon}>☕</div>
          <div className={styles.title}>
            Something went wrong
          </div>
          <div className={styles.errorMessage}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className={styles.button}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}