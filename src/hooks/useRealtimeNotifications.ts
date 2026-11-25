import { useEffect } from 'react'
import { safeInternalPath } from '@/lib/safe-redirect'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useUser } from '@/contexts/user-context'
import { notificationType, type Notification } from './useNotifications'

const NOTIFICATIONS_KEY = ['notifications'] as const

/**
 * Replace (or add) `row` in the cached list by id and keep the list newest
 * first. The dispatcher collapses chat messages into the existing unread
 * TICKET_MESSAGE row and bumps its time, so an UPDATE has to move that row to
 * the top rather than append a second one (which would also double the
 * Inbox unread count).
 */
export function upsertNotification(
  list: Notification[] | undefined,
  row: Notification
): Notification[] | undefined {
  if (!list) return list
  const next = [row, ...list.filter((n) => n.id !== row.id)]
  return next.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user } = useUser()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return

    const filter = `user_id=eq.${userId}`

    const applyRow = (notification: Notification) => {
      queryClient.setQueryData<Notification[]>(NOTIFICATIONS_KEY, (old) =>
        upsertNotification(old, notification)
      )
      // Reconcile with the server in the background.
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter },
        (payload) => {
          const notification = payload.new as Notification
          applyRow(notification)

          // Chat messages only surface in the Inbox: no toast.
          if (notificationType(notification) === 'TICKET_MESSAGE') {
            toast.dismiss(notification.id)
            return
          }

          toast(notification.title, {
            id: notification.id,
            description: notification.content,
            action: notification.route
              ? {
                  label: 'View',
                  onClick: () => router.push(safeInternalPath(notification.route, '/notifications')),
                }
              : undefined,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter },
        (payload) => {
          const notification = payload.new as Notification
          applyRow(notification)
          if (notificationType(notification) === 'TICKET_MESSAGE') {
            toast.dismiss(notification.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient, router])
}
