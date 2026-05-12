/**
 * Frontend-only preview rows for the helpers list empty state.
 * No database writes; not shown when filters hide real helpers.
 */

export const HELPER_LIST_PREVIEW_DISCLAIMER =
    "You do not have any helpers yet. The rows below are a visual preview only—they are not real team members."

export type HelperPreviewCategory = "core" | "extended" | "community"

export type HelperPreviewPlaceholder = {
    id: string
    name: string
    initials: string
    githubHandle: string
    category: HelperPreviewCategory
    involvement: string
    color: string
}

export const HELPER_PREVIEW_PLACEHOLDERS: HelperPreviewPlaceholder[] = [
    {
        id: "preview-1",
        name: "Alex Rivera",
        initials: "AR",
        githubHandle: "arivera-demo",
        category: "core",
        involvement: "Primary on-call",
        color: "#f4bccc",
    },
    {
        id: "preview-2",
        name: "Jordan Lee",
        initials: "JL",
        githubHandle: "jlee-extended",
        category: "extended",
        involvement: "Occasional reviews",
        color: "#d0f6bc",
    },
    {
        id: "preview-3",
        name: "Sam Okonkwo",
        initials: "SO",
        githubHandle: "sam-community",
        category: "community",
        involvement: "Community triage",
        color: "#bcedf6",
    },
    {
        id: "preview-4",
        name: "Morgan Patel",
        initials: "MP",
        githubHandle: "mpatel-consult",
        category: "extended",
        involvement: "Consulting",
        color: "#f6e6bc",
    },
]
