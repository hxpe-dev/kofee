'use client'

import { supabase } from '@/lib/supabase'
import styles from '@/styles/login.module.css'
import { IconGist, IconGithub, IconKofi } from './icons'

export default function LoginScreen() {
  async function signInWithGithub() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'gist',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className={styles.page}>
      {/* Top-right corner buttons */}
      <div className={styles.topRight}>
        <a
          href="https://github.com/hxpe-dev/kofee"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.iconButton}
        >
          <IconGist/>
        </a>
        <a
          href="https://ko-fi.com/hxpedev"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.iconButton}
        >
          <IconKofi/>
        </a>
      </div>

      <div className={styles.logoGroup}>
        <div className={styles.logo}>
          <div className={styles.logoDot} />
          Kofee
        </div>
        <p className={styles.logoSub}>your brew of code</p>
      </div>

      <button className={styles.btn} onClick={signInWithGithub}>
        <IconGithub/>
        Continue with GitHub
      </button>
      
      <button className={styles.btnGuest} onClick={() => window.location.href = '/?guest=true'}>
        Continue as guest
      </button>

      <p className={styles.note}>
        We use GitHub to sync your snippets and enable one-click Gist publishing.
      </p>
    </div>
  )
}