"use client"

import type React from "react"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { detectLanguage, isInsideOpenFence, looksLikeCode, wrapInFence } from "@/lib/code-blocks"
import { cn } from "@/lib/utils"
import {
  AtSign,
  Bold,
  Code,
  ImageIcon,
  Italic,
  Link,
  List,
  Loader2,
  Mic,
  Plus,
  Send,
  Smile,
  SquareCode,
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
  /** Called with pasted images and with any dropped files (the receiver validates them). Omit to disable both. */
  onImageFiles?: (files: File[]) => void
  /** Shows an "Uploading image…" hint while attachments are in flight */
  imagesUploading?: boolean
}

/** Image files carried by a paste or drop. */
function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((f) => f.type.startsWith("image/"))
}

export function TicketChatInput({
  value,
  onChange,
  onSend,
  sendDisabled,
  placeholder = "Message #askanything",
  toolbarEndContent,
  onImageClick,
  onImageFiles,
  imagesUploading,
}: TicketChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)

  /** Replace [start, end) of the current value and place the caret afterwards. */
  const replaceRange = useCallback(
    (start: number, end: number, replacement: string, caret: { start: number; end: number }) => {
      const newText = value.slice(0, start) + replacement + value.slice(end)
      pendingSelectionRef.current = caret
      onChange(newText)
    },
    [value, onChange]
  )

  const insertFormat = useCallback(
    (open: string, close: string = open) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = value.slice(start, end)
      const newEnd = selected.length > 0 ? start + open.length + selected.length + close.length : start + open.length
      replaceRange(start, end, open + selected + close, { start: newEnd, end: newEnd })
    },
    [value, replaceRange]
  )

  /**
   * Wrap the selection in a fenced code block (```lang … ```). With nothing
   * selected an empty block is inserted with the caret inside it. The fence
   * always sits on its own lines so markdown parses it as a block.
   */
  const insertCodeBlock = useCallback(
    (snippet?: string) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = snippet ?? value.slice(start, end)
      const language = selected ? detectLanguage(selected).language : ""
      const block = wrapInFence(selected, language)
      const needsLeadingBreak = start > 0 && value[start - 1] !== "\n"
      const needsTrailingBreak = end < value.length && value[end] !== "\n"
      const replacement = (needsLeadingBreak ? "\n" : "") + block + (needsTrailingBreak ? "\n" : "")
      const caret = selected
        ? start + replacement.length
        : start + (needsLeadingBreak ? 1 : 0) + block.indexOf("\n") + 1
      replaceRange(start, end, replacement, { start: caret, end: caret })
    },
    [value, replaceRange]
  )

  /** Code button: inline `code` for a single line, a fenced block for multi-line selections. */
  const insertCode = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const selected = value.slice(ta.selectionStart, ta.selectionEnd)
    if (selected.includes("\n")) insertCodeBlock()
    else insertFormat("`")
  }, [value, insertCodeBlock, insertFormat])

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const lineStart = value.slice(0, start).lastIndexOf("\n") + 1
      replaceRange(lineStart, lineStart, prefix, { start: start + prefix.length, end: start + prefix.length })
    },
    [value, replaceRange]
  )

  /**
   * Pasted multi-line text that looks like source code is wrapped in a code
   * fence automatically, so people don't have to know markdown to share
   * readable code. Pasting inside an existing fence is left alone.
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current
      if (!ta) return
      const text = e.clipboardData.getData("text/plain")
      // A pasted screenshot / copied image is uploaded as an attachment. Office
      // apps put a rendered image next to copied text — that stays a text paste.
      const images = onImageFiles && !text ? imageFilesFrom(e.clipboardData) : []
      if (images.length > 0) {
        e.preventDefault()
        onImageFiles?.(images)
        return
      }
      if (!text || !text.includes("\n")) return
      if (isInsideOpenFence(value, ta.selectionStart)) return
      if (!looksLikeCode(text)) return
      e.preventDefault()
      insertCodeBlock(text.replace(/\r\n?/g, "\n"))
    },
    [value, insertCodeBlock, onImageFiles]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onImageFiles || !Array.from(e.dataTransfer.types).includes("Files")) return
      e.preventDefault()
      setDragActive(true)
    },
    [onImageFiles]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setDragActive(false)
      if (!onImageFiles || !Array.from(e.dataTransfer.types).includes("Files")) return
      e.preventDefault()
      // Every dropped file is passed on, so an unsupported one gets an error
      // message from the uploader instead of vanishing.
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onImageFiles(files)
    },
    [onImageFiles]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget
      const inFence = isInsideOpenFence(value, ta.selectionStart)
      if (e.key === "Enter" && !e.shiftKey) {
        // Inside an open ``` block Enter adds a line; the message is sent
        // once the block is closed (or with Enter outside it).
        if (inFence) return
        e.preventDefault()
        // Same rule as the send button, so the two can't disagree.
        if (!sendDisabled) onSend()
        return
      }
      if (e.key === "Tab" && !e.shiftKey && inFence) {
        e.preventDefault()
        const caret = ta.selectionStart + 2
        replaceRange(ta.selectionStart, ta.selectionEnd, "  ", { start: caret, end: caret })
      }
    },
    [value, onSend, sendDisabled, replaceRange]
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
    <div
      className={cn(
        "bg-white border border-border rounded-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] mx-4 mb-4 overflow-hidden",
        dragActive && "border-brand-primary ring-2 ring-brand-primary/30"
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <div className="bg-muted flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={() => insertFormat("**")} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={() => insertFormat("*")} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={() => insertFormat("~~")} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-foreground mx-1" />
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={() => insertFormat("[", "](url)")} title="Link">
          <Link className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={() => insertLinePrefix("- ")} title="Bullet list">
          <List className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={insertCode} title="Inline code">
          <Code className="w-[18px] h-[18px]" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-8 p-0" onClick={() => insertCodeBlock()} title="Code block">
          <SquareCode className="w-[18px] h-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-8 p-0"
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
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={!isInsideOpenFence(value, value.length)}
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
          {imagesUploading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Uploading image…
            </span>
          )}
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
