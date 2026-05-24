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
    <div className="bg-white border border-[#818185]/20 rounded-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] mx-4 mb-4 overflow-hidden">
      {/* Top toolbar strip — 36px tall, #f6f6f6 */}
      <div className="h-9 bg-bg-subtle flex items-center gap-0.5 px-3">
        {/* Group 1: text emphasis */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          onClick={() => insertFormat("**")}
          title="Bold"
        >
          <Bold className="w-[14px] h-[14px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          onClick={() => insertFormat("*")}
          title="Italic"
        >
          <Italic className="w-[14px] h-[14px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          onClick={() => insertFormat("~~")}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-[#818185]/30 mx-1.5" />

        {/* Group 2: link + list */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          onClick={() => insertFormat("[", "](url)")}
          title="Link"
        >
          <Link className="w-[18px] h-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          onClick={() => insertLinePrefix("- ")}
          title="Bullet list"
        >
          <List className="w-[18px] h-[18px]" />
        </Button>

        <div className="w-px h-4 bg-[#818185]/30 mx-1.5" />

        {/* Group 3: code + attachment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          onClick={() => insertFormat("`")}
          title="Inline code"
        >
          <Code className="w-[18px] h-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-black/5"
          title="Attach image"
          onClick={onImageClick}
          disabled={!onImageClick}
        >
          <ImageIcon className="w-[18px] h-[18px]" />
        </Button>

        {toolbarEndContent != null && (
          <div className="ml-auto flex items-center text-text-heading font-semibold text-[15px] tracking-[-0.3px]">
            {toolbarEndContent}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="pt-3 pb-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px] max-h-32 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-[38px] pr-4 text-[17px] text-text-tertiary tracking-[-0.34px] placeholder:text-text-tertiary placeholder:tracking-[-0.34px] shadow-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
        />

        {/* Bottom action row */}
        <div className="flex items-center gap-2 px-3 pb-1 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-[22px] w-[22px] p-0 rounded-full border border-[#818185]/40 hover:bg-black/5"
            title="Add"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-[22px] w-[22px] p-0 hover:bg-black/5"
            title="Emoji"
          >
            <Smile className="w-[18px] h-[18px]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-[22px] w-[22px] p-0 hover:bg-black/5"
            title="Mention"
          >
            <AtSign className="w-[18px] h-[18px]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-[22px] w-[22px] p-0 hover:bg-black/5"
            title="Video"
          >
            <Video className="w-[22px] h-[22px]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-[22px] w-[22px] p-0 hover:bg-black/5"
            title="Microphone"
          >
            <Mic className="w-[22px] h-[22px]" />
          </Button>
          <div className="ml-auto">
            <Button
              type="button"
              onClick={onSend}
              disabled={!!sendDisabled}
              className="bg-transparent hover:bg-transparent p-0 h-auto w-auto disabled:opacity-50"
              title="Send"
            >
              <Send className="w-[26px] h-[26px] text-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
