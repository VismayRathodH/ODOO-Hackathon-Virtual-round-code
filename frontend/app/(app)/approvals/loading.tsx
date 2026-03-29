import { Skeleton } from "@/components/ui/skeleton";

export default function ApprovalsLoading() {
  return (
    <div className="flex flex-col space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}
