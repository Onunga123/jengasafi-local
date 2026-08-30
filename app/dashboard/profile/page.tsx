"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProfileForm from "../components/profile";
import { ProfileDisplay } from "../profile";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const response = await fetch("/api/profile");
      if (response.ok) setProfile(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  if (status === "loading" || isLoading) return <p className="p-8 text-center text-slate-500">Loading your profile…</p>;
  if (!profile) return <p className="p-8 text-center text-slate-500">Profile information is not available yet.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Account</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-2 text-slate-600">Manage the personal and sustainability information used across JengaSafi.</p>
        </div>
        <button type="button" onClick={() => router.push('/dashboard')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Back to overview</button>
      </div>
      {isEditing ? (
        <ProfileForm initialData={profile} onSave={(updated) => { setProfile(updated); setIsEditing(false); }} onCancel={() => setIsEditing(false)} />
      ) : (
        <ProfileDisplay clientData={profile.profile ?? profile} session={session} onEdit={() => setIsEditing(true)} />
      )}
    </div>
  );
}