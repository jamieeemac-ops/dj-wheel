import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function App() {
  const [status, setStatus] = useState('Connecting to Supabase...')

  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase.from('rooms').select('id').limit(1)
        if (error) throw error
        setStatus('✅ Connected to Supabase successfully!')
      } catch (err: any) {
        setStatus('❌ Connection failed: ' + err.message)
      }
    }
    checkConnection()
  }, [])

  return (
    <div style={{ padding: '2rem', fontSize: '1.2rem', textAlign: 'center' }}>
      {status}
    </div>
  )
}
