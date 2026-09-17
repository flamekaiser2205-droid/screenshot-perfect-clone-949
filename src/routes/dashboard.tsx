import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_OPTIONS, matchScore, useAuth, type Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Skillbridge dashboard" },
      {
        name: "description",
        content: "Post projects, see matched freelancers, apply to work, chat and leave reviews.",
      },
      { property: "og:title", content: "Your Skillbridge dashboard" },
      { property: "og:description", content: "Matches, projects, messages and reviews in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Project = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  budget: number;
  skills: string[];
  status: string;
  created_at: string;
};

type Application = {
  id: string;
  project_id: string;
  freelancer_id: string;
  pitch: string;
  status: string;
};

type Review = { id: string; reviewer_id: string; reviewee_id: string; rating: number; comment: string };
type Conversation = { id: string; client_id: string; freelancer_id: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

function Dashboard() {
  const navigate = useNavigate();
  const { userId, profile, loading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !userId) void navigate({ to: "/" });
    if (!loading && userId && profile && !profile.role) void navigate({ to: "/onboarding" });
  }, [loading, userId, profile, navigate]);

  const load = useCallback(async () => {
    if (!userId) return;
    const [p, pr, ap, rv, cv] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("*"),
      supabase.from("reviews").select("*"),
      supabase.from("conversations").select("*"),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setProjects((pr.data as Project[]) ?? []);
    setApplications((ap.data as Application[]) ?? []);
    setReviews((rv.data as Review[]) ?? []);
    setConversations((cv.data as Conversation[]) ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const isClient = profile?.role === "client";

  async function openChat(otherId: string) {
    if (!userId || !profile) return;
    const clientId = isClient ? userId : otherId;
    const freelancerId = isClient ? otherId : userId;
    const existing = conversations.find(
      (c) => c.client_id === clientId && c.freelancer_id === freelancerId,
    );
    if (existing) {
      setActiveChat(existing.id);
      return;
    }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ client_id: clientId, freelancer_id: freelancerId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setConversations((prev) => [...prev, data as Conversation]);
    setActiveChat((data as Conversation).id);
  }

  function ratingFor(id: string) {
    const rs = reviews.filter((r) => r.reviewee_id === id);
    if (!rs.length) return null;
    return { avg: rs.reduce((a, r) => a + r.rating, 0) / rs.length, count: rs.length };
  }

  if (loading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your dashboard…
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="font-display text-lg font-bold">Skillbridge</div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {profile.full_name} · <span className="capitalize">{profile.role}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Tabs defaultValue={isClient ? "matches" : "jobs"}>
            <TabsList>
              {isClient ? (
                <>
                  <TabsTrigger value="matches">Matched freelancers</TabsTrigger>
                  <TabsTrigger value="post">Post a project</TabsTrigger>
                  <TabsTrigger value="mine">My projects</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="jobs">Matched jobs</TabsTrigger>
                  <TabsTrigger value="profile">My profile</TabsTrigger>
                </>
              )}
            </TabsList>

            {isClient && (
              <>
                <TabsContent value="matches" className="mt-4 space-y-4">
                  <FreelancerMatches
                    me={profile}
                    profiles={profiles}
                    ratingFor={ratingFor}
                    onMessage={openChat}
                    onReviewed={load}
                    userId={userId!}
                  />
                </TabsContent>
                <TabsContent value="post" className="mt-4">
                  <PostProject userId={userId!} defaultSkills={profile.skills} onPosted={load} />
                </TabsContent>
                <TabsContent value="mine" className="mt-4 space-y-4">
                  <MyProjects
                    projects={projects.filter((p) => p.client_id === userId)}
                    applications={applications}
                    byId={byId}
                    onMessage={openChat}
                    onChanged={load}
                  />
                </TabsContent>
              </>
            )}

            {!isClient && (
              <>
                <TabsContent value="jobs" className="mt-4 space-y-4">
                  <JobFeed
                    projects={projects.filter((p) => p.status === "open")}
                    me={profile}
                    byId={byId}
                    applications={applications}
                    onMessage={openChat}
                    onApplied={load}
                  />
                </TabsContent>
                <TabsContent value="profile" className="mt-4">
                  <ProfileBuilder profile={profile} onSaved={load} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        <ChatPanel
          userId={userId!}
          conversations={conversations}
          byId={byId}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
          isClient={isClient}
        />
      </main>
    </div>
  );
}

function SkillPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SKILL_OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(value.includes(s) ? value.filter((v) => v !== s) : [...value, s])}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            value.includes(s)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function PostProject({
  userId,
  defaultSkills,
  onPosted,
}: {
  userId: string;
  defaultSkills: string[];
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [skills, setSkills] = useState<string[]>(defaultSkills ?? []);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("Give the project a title");
    setBusy(true);
    const { error } = await supabase.from("projects").insert({
      client_id: userId,
      title: title.trim(),
      description: description.trim(),
      budget: budget ? Number(budget) : 0,
      skills,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Project posted");
    setTitle("");
    setDescription("");
    setBudget("");
    onPosted();
  }

  return (
    <div className="surface space-y-4 p-6">
      <div className="space-y-2">
        <Label htmlFor="title">Project title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="desc">What needs doing?</Label>
        <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="budget">Budget (USD)</Label>
        <Input id="budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Skills required</Label>
        <SkillPicker value={skills} onChange={setSkills} />
      </div>
      <Button onClick={submit} disabled={busy}>
        Post project
      </Button>
    </div>
  );
}

function Stars({ value, onSelect }: { value: number; onSelect?: (n: number) => void }) {
  return (
    <span className="text-accent">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(n)}
          className={onSelect ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} star`}
        >
          {n <= Math.round(value) ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}

function FreelancerMatches({
  me,
  profiles,
  ratingFor,
  onMessage,
  onReviewed,
  userId,
}: {
  me: Profile;
  profiles: Profile[];
  ratingFor: (id: string) => { avg: number; count: number } | null;
  onMessage: (id: string) => void;
  onReviewed: () => void;
  userId: string;
}) {
  const [query, setQuery] = useState("");
  const list = profiles
    .filter((p) => p.role === "freelancer" && p.id !== userId)
    .map((p) => ({ p, score: matchScore(me.skills, p.skills) }))
    .filter(({ p }) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.headline.toLowerCase().includes(q) ||
        p.skills.some((s) => s.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => b.score - a.score);

  return (
    <>
      <Input
        placeholder="Search by skill, name or headline…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">No freelancers yet — check back soon.</p>
      )}
      {list.map(({ p, score }) => {
        const rating = ratingFor(p.id);
        return (
          <div key={p.id} className="surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold">{p.full_name}</h3>
                <p className="text-sm text-muted-foreground">{p.headline || "Freelancer"}</p>
              </div>
              <div className="text-right">
                {score > 0 && <Badge>{score}% skill match</Badge>}
                {p.hourly_rate != null && (
                  <p className="mt-1 text-sm text-muted-foreground">${p.hourly_rate}/hr</p>
                )}
              </div>
            </div>
            {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {rating ? (
                  <>
                    <Stars value={rating.avg} /> {rating.avg.toFixed(1)} ({rating.count})
                  </>
                ) : (
                  "No reviews yet"
                )}
              </span>
              <div className="flex gap-2">
                <ReviewForm revieweeId={p.id} reviewerId={userId} onDone={onReviewed} />
                <Button size="sm" onClick={() => onMessage(p.id)}>
                  Message
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function ReviewForm({
  revieweeId,
  reviewerId,
  onDone,
}: {
  revieweeId: string;
  reviewerId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function submit() {
    const { error } = await supabase
      .from("reviews")
      .upsert(
        { reviewer_id: reviewerId, reviewee_id: revieweeId, rating, comment },
        { onConflict: "reviewer_id,reviewee_id" },
      );
    if (error) return toast.error(error.message);
    toast.success("Review saved");
    setOpen(false);
    setComment("");
    onDone();
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Review
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Stars value={rating} onSelect={setRating} />
      <Input
        className="h-9 w-40"
        placeholder="Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" onClick={submit}>
        Save
      </Button>
    </div>
  );
}

function MyProjects({
  projects,
  applications,
  byId,
  onMessage,
  onChanged,
}: {
  projects: Project[];
  applications: Application[];
  byId: Map<string, Profile>;
  onMessage: (id: string) => void;
  onChanged: () => void;
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven't posted a project yet.</p>;
  }
  return (
    <>
      {projects.map((p) => {
        const apps = applications.filter((a) => a.project_id === p.id);
        return (
          <div key={p.id} className="surface p-5">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold">{p.title}</h3>
              <Badge variant="secondary">${p.budget}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-sm font-medium">{apps.length} applicant(s)</p>
              {apps.map((a) => {
                const f = byId.get(a.freelancer_id);
                return (
                  <div key={a.id} className="mt-3 rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{f?.full_name ?? "Freelancer"}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.status === "accepted" ? "default" : "secondary"}>
                          {a.status}
                        </Badge>
                        {a.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const { error } = await supabase
                                .from("applications")
                                .update({ status: "accepted" })
                                .eq("id", a.id);
                              if (error) return toast.error(error.message);
                              onMessage(a.freelancer_id);
                              onChanged();
                            }}
                          >
                            Accept &amp; chat
                          </Button>
                        )}
                        <Button size="sm" onClick={() => onMessage(a.freelancer_id)}>
                          Message
                        </Button>
                      </div>
                    </div>
                    {a.pitch && <p className="mt-2 text-sm text-muted-foreground">{a.pitch}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function JobFeed({
  projects,
  me,
  byId,
  applications,
  onMessage,
  onApplied,
}: {
  projects: Project[];
  me: Profile;
  byId: Map<string, Profile>;
  applications: Application[];
  onMessage: (id: string) => void;
  onApplied: () => void;
}) {
  const [pitch, setPitch] = useState<Record<string, string>>({});
  const ranked = projects
    .map((p) => ({ p, score: matchScore(p.skills, me.skills) }))
    .sort((a, b) => b.score - a.score);

  return (
    <>
      {ranked.length === 0 && <p className="text-sm text-muted-foreground">No open projects yet.</p>}
      {ranked.map(({ p, score }) => {
        const applied = applications.find((a) => a.project_id === p.id && a.freelancer_id === me.id);
        const client = byId.get(p.client_id);
        return (
          <div key={p.id} className="surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {client?.full_name ?? "Client"}
                  {client?.headline ? ` · ${client.headline}` : ""}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="secondary">${p.budget}</Badge>
                {score > 0 && <p className="mt-1 text-xs text-muted-foreground">{score}% match</p>}
              </div>
            </div>
            <p className="mt-3 text-sm">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {applied ? (
                <Badge>Applied · {applied.status}</Badge>
              ) : (
                <>
                  <Input
                    className="h-9"
                    placeholder="Short pitch…"
                    value={pitch[p.id] ?? ""}
                    onChange={(e) => setPitch((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const { error } = await supabase.from("applications").insert({
                        project_id: p.id,
                        freelancer_id: me.id,
                        pitch: pitch[p.id] ?? "",
                      });
                      if (error) return toast.error(error.message);
                      toast.success("Application sent");
                      onApplied();
                    }}
                  >
                    Apply
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => onMessage(p.client_id)}>
                Message client
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function ProfileBuilder({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [headline, setHeadline] = useState(profile.headline);
  const [bio, setBio] = useState(profile.bio);
  const [rate, setRate] = useState(profile.hourly_rate?.toString() ?? "");
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ headline, bio, skills, hourly_rate: rate ? Number(rate) : null })
      .eq("id", profile.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  }

  return (
    <div className="surface space-y-4 p-6">
      <div className="space-y-2">
        <Label htmlFor="h">Headline</Label>
        <Input id="h" value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="b">About you</Label>
        <Textarea id="b" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r">Hourly rate (USD)</Label>
        <Input id="r" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Skills</Label>
        <SkillPicker value={skills} onChange={setSkills} />
      </div>
      <Button onClick={save} disabled={busy}>
        Save profile
      </Button>
    </div>
  );
}

function ChatPanel({
  userId,
  conversations,
  byId,
  activeChat,
  setActiveChat,
  isClient,
}: {
  userId: string;
  conversations: Conversation[];
  byId: Map<string, Profile>;
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
  isClient: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeChat)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setMessages((data as Message[]) ?? []);
      });

    const channel = supabase
      .channel(`messages-${activeChat}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeChat}`,
        },
        (payload) => {
          setMessages((prev) => {
            const next = payload.new as Message;
            return prev.some((m) => m.id === next.id) ? prev : [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!activeChat || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeChat, sender_id: userId, body });
    if (error) toast.error(error.message);
  }

  return (
    <aside className="surface flex h-[640px] flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <h2 className="font-display font-semibold">Messages</h2>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-40 shrink-0 overflow-y-auto border-r border-border">
          {conversations.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">No chats yet.</p>
          )}
          {conversations.map((c) => {
            const otherId = isClient ? c.freelancer_id : c.client_id;
            const other = byId.get(otherId);
            return (
              <button
                key={c.id}
                onClick={() => setActiveChat(c.id)}
                className={`block w-full truncate px-3 py-2.5 text-left text-sm transition-colors ${
                  activeChat === c.id ? "bg-secondary font-medium" : "hover:bg-muted"
                }`}
              >
                {other?.full_name ?? "User"}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {!activeChat && (
              <p className="text-sm text-muted-foreground">Pick a conversation to start talking.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.sender_id === userId
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.body}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Input
              placeholder="Write a message…"
              value={draft}
              disabled={!activeChat}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <Button onClick={send} disabled={!activeChat}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
