"use client";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button onClick={signOut} className="btn-ghost w-full">
      Sign out
    </button>
  );
}
