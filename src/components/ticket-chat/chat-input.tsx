"use client"

import type React from "react"
import { useCallback, useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AtSign,
  Bold,
  Code,
  ImageIcon,
  Italic,
  Link,
  List,
  Mic,
  Plus,
  Send,
  Smile,
  Strikethrough,
  Video,
} from "lucide-react"

export interface TicketChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  sendDisabled?: boolean
  placeholder?: string
  /** Optional content to render at the end of the toolbar (e.g. "End session" button) */
  toolbarEndContent?: React.ReactNode
  /** Called when the image/attachment button is clicked */
  onImageClick?: () => void
}

export function TicketChatInput({
  value,
  onChange,
  onSend,
  sendDisabled,
  placeholder = "Message #askanything",
  toolbarEndContent,
  onImageClick,
}: TicketChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)

  const insertFormat = useCallback(
    (open: string, close: string = open) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = value.slice(start, end)
      const before = value.slice(0, start)
      const after = value.slice(end)
      let newEnd: number
      const newText = selected.length > 0 ? before + open + selected + close + after : before + open + close + after
      if (selected.length > 0) {
        newEnd = start + open.length + selected.length + close.length
      } else {
        newEnd = start + open.length
      }
      pendingSelectionRef.current = { start: newEnd, end: newEnd }
      onChange(newText)
    },
    [value, onChange]
  )

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const lineStart = value.slice(0, start).lastIndexOf("\n") + 1
      const before = value.slice(0, lineStart)
      const rest = value.slice(lineStart)
      const newText = before + prefix + rest
      const newCursor = start + prefix.length
      pendingSelectionRef.current = { start: newCursor, end: newCursor }
      onChange(newText)
    },
    [value, onChange]
  )

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current
    const ta = textareaRef.current
    if (pending && ta) {
      ta.focus()
      ta.setSelectionRange(pending.start, pending.end)
      pendingSelectionRef.current = null
    }
  }, [value])

  return (
    <div className="bg-white border border-border rounded-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] mx-4 mb-4 overflow-hidden">
      <div className="bg-muted flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormat("**")} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormat("*")} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormat("~~")} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-foreground mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormat("[", "](url)")} title="Link">
          <Link className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertLinePrefix("- ")} title="Bullet list">
          <List className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormat("`")} title="Code">
          <Code className="w-[18px] h-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Attach image"
          onClick={onImageClick}
          disabled={!onImageClick}
        >
          <ImageIcon className="w-[18px] h-[18px]" />
        </Button>
        {toolbarEndContent != null && <div className="ml-auto">{toolbarEndContent}</div>}
      </div>
      <div className="p-4">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px] max-h-32 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-[17px] text-muted-foreground placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
        />
        <div className="flex items-center gap-2 mt-2">
          <Button variant="ghost" size="sm" className="h-[22px] w-[22px] p-0">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-[22px] w-[22px] p-0">
            <Smile className="w-[18px] h-[18px]" />
          </Button>
          <Button variant="ghost" size="sm" className="h-[22px] w-[22px] p-0">
            <AtSign className="w-[17px] h-[17px]" />
          </Button>
          <Button variant="ghost" size="sm" className="h-[22px] w-[22px] p-0">
            <Video className="w-[22px] h-[22px]" />
          </Button>
          <Button variant="ghost" size="sm" className="h-[22px] w-[22px] p-0">
            <Mic className="w-[22px] h-[22px]" />
          </Button>
          <div className="ml-auto">
            <Button
              onClick={onSend}
              disabled={!!sendDisabled}
              className="bg-transparent hover:bg-transparent p-0 h-auto w-auto disabled:opacity-50"
            >
              <Send className="w-[26px] h-[26px] text-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
