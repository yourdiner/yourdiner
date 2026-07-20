import { redirect } from "next/navigation";

export default function LiveFloorRedirectPage() {
  redirect("/admin/orders");
}
