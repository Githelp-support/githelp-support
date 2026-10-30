import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center bg-page-muted">
      <div className="text-center max-w-md px-4">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-6">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Button asChild className="bg-brand-primary hover:bg-brand-primary/90">
          <Link href="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
