import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
      <h1 className="text-[8rem] font-bold leading-none tracking-tighter text-muted">
        404
      </h1>
      <h2 className="mt-4 text-2xl font-semibold">Page not found</h2>
      <p className="mt-2 text-center text-muted-foreground max-w-md mb-8">
        Sorry, the page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/dashboard">
        <Button size="lg" className="rounded-full">
          Go to Dashboard
        </Button>
      </Link>
    </div>
  );
}
