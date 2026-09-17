import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_OPTIONS, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your Skillbridge profile" },
      { name: "description", content: "Choose whether you hire or freelance and pick your skills." },
      { property: "og:title", content: "Set up your Skillbridge profile" },
      { property: "og:description", content: "Pick your role and interests to get matched." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { userId, profile, loading, refreshProfile } = useAuth();
  const [role, setRole] = useState<"client" | "freelancer">("freelancer");
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !userId) void navigate({ to: "/" });
  }, [loading, userId, navigate]);

  useEffect(() => {
    if (profile) setName(profile.full_name || "");
  }, [profile]);

  function toggle(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  async function save() {
    if (!userId) return;
    if (!name.trim()) return toast.error("Add your name first");
    if (skills.length === 0) return toast.error("Pick at least one interest");
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: name.trim(),
      role,
      headline: headline.trim(),
      bio: bio.trim(),
      skills,
      hourly_rate: rate ? Number(rate) : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    void navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl surface p-8">
        <h1 className="font-display text-3xl font-bold">Tell us who you are</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This drives who we match you with. You can change it later.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {(["client", "freelancer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                role === r ? "border-primary bg-secondary" : "border-border hover:bg-muted"
              }`}
            >
              <span className="font-display font-semibold capitalize">{r}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {r === "client" ? "I want to hire people for projects" : "I want to get hired for work"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headline">
              {role === "client" ? "Company or what you do" : "Headline"}
            </Label>
            <Input
              id="headline"
              placeholder={role === "client" ? "Founder at Northwind" : "Brand designer for startups"}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>
          {role === "freelancer" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bio">About you</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you do, who you've worked with, what you're great at."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">Hourly rate (USD)</Label>
                <Input
                  id="rate"
                  type="number"
                  min={0}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>{role === "client" ? "Skills you hire for" : "Your skills"}</Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    skills.includes(s)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button className="mt-8 w-full" onClick={save} disabled={busy}>
          Continue to dashboard
        </Button>
      </div>
    </main>
  );
}
