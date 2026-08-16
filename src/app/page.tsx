import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * No marketing landing page: the root sends people straight where they belong.
 * Signed out -> login. Signed in -> their dashboard, by role.
 */
export default async function RootPage() {
  const user = await getCurrentUser().catch(() => null);

  if (!user) redirect("/login");
  redirect(user.role === "CUSTOMER" ? "/dashboard" : "/admin");
}
