"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tag, FolderOpen, Plus, Trash2, Loader2 } from "lucide-react"
import { useProjectSelection } from "@/contexts/project-context"
import {
  useProjectKeywords,
  useProjectHelpCategories,
  useCreateProjectKeyword,
  useDeleteProjectKeyword,
  useCreateProjectHelpCategory,
  useDeleteProjectHelpCategory,
} from "@/hooks/useHelperKeywords"
import { toast } from "sonner"

export default function ProjectSettingsPage() {
  const [newKeyword, setNewKeyword] = useState("")
  const [newCategory, setNewCategory] = useState("")

  const { selectedProjectId: projectId } = useProjectSelection()

  const { data: keywords = [], isLoading: keywordsLoading } = useProjectKeywords(projectId ?? undefined)
  const { data: helpCategories = [], isLoading: categoriesLoading } = useProjectHelpCategories(projectId ?? undefined)

  const createKeyword = useCreateProjectKeyword(projectId ?? undefined)
  const deleteKeyword = useDeleteProjectKeyword(projectId ?? undefined)
  const createCategory = useCreateProjectHelpCategory(projectId ?? undefined)
  const deleteCategory = useDeleteProjectHelpCategory(projectId ?? undefined)

  const handleAddKeyword = async () => {
    const value = newKeyword.trim()
    if (!value || !projectId) return

    try {
      await createKeyword.mutateAsync(value)
      setNewKeyword("")
      toast.success("Keyword added")
    } catch (error) {
      console.error("Failed to add keyword:", error)
      toast.error("Failed to add keyword. Please try again.")
    }
  }

  const handleDeleteKeyword = async (id: number) => {
    try {
      await deleteKeyword.mutateAsync(id)
      toast.success("Keyword removed")
    } catch (error) {
      console.error("Failed to delete keyword:", error)
      toast.error("Failed to remove keyword. Please try again.")
    }
  }

  const handleAddCategory = async () => {
    const value = newCategory.trim()
    if (!value || !projectId) return

    try {
      await createCategory.mutateAsync({ value })
      setNewCategory("")
      toast.success("Help category added")
    } catch (error) {
      console.error("Failed to add category:", error)
      toast.error("Failed to add category. Please try again.")
    }
  }

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id)
      toast.success("Help category removed")
    } catch (error) {
      console.error("Failed to delete category:", error)
      toast.error("Failed to remove category. Please try again.")
    }
  }

  if (!projectId) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Project Settings" subtitle="Manage keywords and help categories" />
          <main className="flex-1 py-6 px-[30px]">
            <p className="text-muted-foreground">Select a project to manage its keywords and help categories.</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Project Settings" subtitle="Manage keywords and help categories for your project" />
        <main className="flex-1 py-6 px-[30px] overflow-y-auto">
          <div className="max-w-4xl space-y-8">
            {/* Keywords / Topics */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Keywords & topics</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Keywords help categorize tickets and let helpers indicate which topics they can help with.
                </p>

                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Add a keyword (e.g. Events, Kafka, React)"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddKeyword}
                    disabled={!newKeyword.trim() || createKeyword.isPending}
                  >
                    {createKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                  </Button>
                </div>

                {keywordsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading keywords...
                  </div>
                ) : keywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No keywords yet. Add one above.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <div
                        key={kw.id}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 bg-muted/50"
                      >
                        <span className="text-sm font-medium">{kw.value}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteKeyword(kw.id)}
                          disabled={deleteKeyword.isPending}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                          aria-label={`Remove ${kw.value}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help categories */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Help categories</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Help categories classify ticket types (e.g. Bug, Best practice, Documentation).
                </p>

                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Add a category (e.g. Bug, Documentation)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCategory}
                    disabled={!newCategory.trim() || createCategory.isPending}
                  >
                    {createCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                  </Button>
                </div>

                {categoriesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading categories...
                  </div>
                ) : helpCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No help categories yet. Add one above.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {helpCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 bg-muted/50"
                      >
                        <span className="text-sm font-medium">{cat.value}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          disabled={deleteCategory.isPending}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                          aria-label={`Remove ${cat.value}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
