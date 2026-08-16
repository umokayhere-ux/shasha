import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every admin page is gated here, on the server.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN" && user.role !== "STAFF") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminNav email={user.email} name={user.name} />
      <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
