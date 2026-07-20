import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function RequiredLabel({
  children,
  required = true,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn(className)}>
      {children}
      {required && <span className="text-destructive"> *</span>}
    </Label>
  );
}
