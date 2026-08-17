import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useUser } from '@/contexts/user-context'
import type { Notification } from './useNotifications'

export function useRealtimeNotifications() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user } = useUser()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })

          const notification = payload.new as Notification
          toast(notification.title, {
            description: notification.content,
            action: notification.route
              ? {
                  label: 'View',
                  onClick: () => router.push(notification.route as string),
                }
              : undefined,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient, router])
}
