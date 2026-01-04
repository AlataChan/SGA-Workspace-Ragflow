"use client"

import { useState, useEffect, useCallback } from "react"

export interface AuthUser {
  id: string
  userId: string
  username: string
  email?: string
  displayName?: string
  role: string
  companyId: string
  avatarUrl?: string
}

interface UseAuthReturn {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  signOut: () => void  // 别名，与 logout 相同
  refreshUser: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      // 从 localStorage 获取用户信息
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user')
        const token = localStorage.getItem('token')

        if (storedUser && token) {
          setUser(JSON.parse(storedUser))
        } else {
          setUser(null)
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()

      if (data.success && data.user && data.token) {
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('token', data.token)
        setUser(data.user)
        return true
      }

      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }, [])

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
    setUser(null)
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    signOut: logout,  // 别名，与 logout 相同
    refreshUser
  }
}

export default useAuth
