import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skillbridge — Hire freelancers, find paid work" },
      {
        name: "description",
        content:
          "Skillbridge matches freelancers with clients by skill. Post a project, get matched, chat and build a rated reputation.",
      },
      { property: "og:title", content: "Skillbridge — Hire freelancers, find paid work" },
      {
        property: "og:description",
        content: "Skill-based matching between clients and freelancers, with built-in chat and reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (profile === null) return;
    void navigate({ to: profile.role ? "/dashboard" : "/onboarding" });
  }, [session, profile, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try email instead.");
      return;
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hero-gradient relative hidden lg:flex flex-col justify-between p-12 text-primary-foreground">
        <div className="font-display text-xl font-bold">Skillbridge</div>
        <div className="max-w-lg">
          <h1 className="font-display text-5xl font-bold leading-[1.05]">
            Stop chasing gigs. Get matched.
          </h1>
          <p className="mt-5 text-lg opacity-85">
            Clients post what they need. We surface the freelancers whose skills actually fit — then
            you talk it through and build a rated track record.
          </p>
          <ul className="mt-8 space-y-3 text-sm opacity-85">
            <li>— Skill-based matching, not endless applications</li>
            <li>— Direct messaging between both sides</li>
            <li>— Ratings and reviews that build real trust</li>
          </ul>
        </div>
        <p className="text-xs opacity-70">Built for freelancers and the people who hire them.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md surface p-8">
          <h2 className="font-display text-2xl font-bold lg:hidden">Skillbridge</h2>
          <h2 className="font-display text-2xl font-bold hidden lg:block">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One account works for both hiring and freelancing.
          </p>

          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "signin" | "signup")}
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Sign up</TabsTrigger>
              <TabsTrigger value="signin">Log in</TabsTrigger>
            </TabsList>
            <TabsContent value="signup" />
            <TabsContent value="signin" />
          </Tabs>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || loading}>
              {mode === "signup" ? "Create account" : "Log in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </div>
      </section>
    </main>
  );
}
