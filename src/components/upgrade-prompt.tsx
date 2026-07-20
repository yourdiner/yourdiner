import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type UpgradePromptProps = {
  title: string;
  description: string;
};

export function UpgradePrompt({ title, description }: UpgradePromptProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{description}</p>
        <Link href="/admin/subscription">
          <Button>View Plans</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
