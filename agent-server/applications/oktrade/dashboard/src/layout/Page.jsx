import { cn } from "@/lib/utils";

export default function Page({ children, className, ...props }) {
  return <div className={cn('page h-dvh m-6 text-gray-700', className)} {...props}>
    {children}
  </div>
}