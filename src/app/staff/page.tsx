import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff-session";

export default async function StaffIndexPage() {
  const session = await getStaffSession();
  redirect(session ? "/staff/floor" : "/staff/login");
}
