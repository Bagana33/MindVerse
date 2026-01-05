"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";
import { LeaderboardSidebar } from "../leaderboard/LeaderboardTable";
import { cachedFetch } from "../../lib/fetchCache";

type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  points: number;
  createdAt: string;
  imageUrl?: string;
  reactions: Array<{ userEmail: string; type: string }>;
};

type LeaderboardUser = {
  email: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  experience: number;
};

function formatRelativeTime(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function HomeDashboard() {
  const { session } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [topStudents, setTopStudents] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [activeTab, setActiveTab] = useState<"feed" | "following" | "classroom">("feed");
  const [weeklyXp, setWeeklyXp] = useState({ current: 1240, goal: 2000 });
  const [userXp, setUserXp] = useState<number | null>(null);

  // Fetch user XP
  useEffect(() => {
    async function fetchUserXp() {
      if (!session?.email) return;
      try {
        const res = await fetch(`/api/user?email=${encodeURIComponent(session.email)}`);
        if (res.ok) {
          const data = await res.json();
          setUserXp(data.user?.experience ?? null);
        }
      } catch {}
    }
    fetchUserXp();
  }, [session]);

  // Fetch posts
  useEffect(() => {
    async function fetchPosts() {
      try {
        const gradeParam = selectedGrade !== "all" ? `&grade=${encodeURIComponent(selectedGrade)}` : "";
        const res = await fetch(`/api/posts?limit=10${gradeParam}`);
        if (res.ok) {
          const json = await res.json();
          setPosts(json.posts || []);
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [selectedGrade]);

  // Fetch top students
  useEffect(() => {
    async function fetchTopStudents() {
      try {
        const res = await cachedFetch("/api/leaderboard");
        const json = await res.json();
        setTopStudents((json.leaderboard || []).slice(0, 5));
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    }
    fetchTopStudents();
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const params = new URLSearchParams();
      params.set("search", searchQuery.trim());
      router.push(`/?${params.toString()}`);
    }
  };

  const reactionCounts = (post: UserPost) => ({
    fire: post.reactions.filter((r) => r.type === "FIRE").length,
    wow: post.reactions.filter((r) => r.type === "WOW").length,
    love: post.reactions.filter((r) => r.type === "LOVE").length,
    cool: post.reactions.filter((r) => r.type === "COOL").length,
  });

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between mb-8 gap-4">
        <div className="lg:hidden flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            MV
          </div>
          <span className="font-bold text-white">Mind Verse</span>
        </div>
        <div className="hidden lg:block">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-500 text-sm">Welcome back, get ready to create.</p>
        </div>
        <div className="flex items-center gap-4 flex-1 lg:flex-none justify-end">
          <div className="relative hidden md:block group">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 group-focus-within:text-primary-500 transition-colors text-[20px]">
              search
            </span>
            <input
              className="bg-dark-800 border border-white/10 text-sm rounded-full pl-10 pr-4 py-2.5 w-64 focus:w-80 transition-all outline-none text-white focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 placeholder-slate-600"
              placeholder="Search challenges, users..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
          <button className="relative p-2.5 rounded-full bg-dark-800 border border-white/5 hover:bg-dark-700 transition-colors text-slate-400 hover:text-white">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-dark-800"></span>
          </button>
          <button
            onClick={() => router.push("/contests")}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-600/20 to-indigo-600/20 border border-primary-500/30 text-primary-300 text-xs font-bold hover:bg-primary-600/30 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Create</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        <div className="lg:col-span-8 relative rounded-3xl overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 to-violet-950"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="absolute right-[-10%] top-[-20%] w-[400px] h-[400px] bg-primary-500/30 rounded-full blur-[80px]"></div>
          <div className="relative z-10 p-8 h-full flex flex-col justify-between min-h-[280px]">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/10 uppercase tracking-wide">
                  Daily Challenge
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-xs font-semibold text-green-400">Active Now</span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight mb-4 max-w-2xl">
                Craft something <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-pink-400 glow-text">visually bold</span> today.
              </h1>
              <p className="text-indigo-200/80 max-w-lg text-lg mb-6">
                Post your latest graphic design work, react to others, earn XP and climb the leaderboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Tear
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Yourself
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Destroy
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Blind
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Goal & Share Progress */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex-1 glass-card rounded-3xl p-6 relative overflow-hidden group hover:border-primary-500/30 transition-all">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-white text-lg">Weekly Goal</h3>
                <p className="text-xs text-slate-400">3 days streak</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-b from-primary-500 to-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">local_fire_department</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>XP Gained</span>
                <span>
                  {weeklyXp.current.toLocaleString()} / {weeklyXp.goal.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary-500 to-pink-500 h-full rounded-full transition-all"
                  style={{ width: `${(weeklyXp.current / weeklyXp.goal) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push("/lessons")}
            className="flex-1 glass-card rounded-3xl p-6 flex flex-col justify-center items-center text-center hover:bg-dark-800 transition-all cursor-pointer border-dashed border-2 border-dark-700 hover:border-primary-500/50"
          >
            <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-primary-400 text-2xl">add_photo_alternate</span>
            </div>
            <h3 className="font-bold text-white text-sm">Share Progress Drop</h3>
            <p className="text-xs text-slate-500 mt-1">Drag & drop or click to upload</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Feed Section */}
        <div className="xl:col-span-8 space-y-6">
          {/* Feed Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900/50 backdrop-blur-sm p-2 rounded-2xl border border-white/5 sticky top-0 z-30 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveTab("feed")}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${
                  activeTab === "feed"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Feed
              </button>
              <button
                onClick={() => setActiveTab("following")}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "following"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Following
              </button>
              <button
                onClick={() => setActiveTab("classroom")}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "classroom"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Classroom
              </button>
            </div>
            <div className="flex items-center gap-2 pr-2">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider hidden sm:block">Filter:</span>
              <select
                className="bg-dark-800 border-none text-xs text-white font-medium rounded-lg py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-primary-500/50 cursor-pointer"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
              >
                <option value="all">All Grades</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </select>
            </div>
          </div>

          {/* Posts */}
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No posts yet. Be the first to share!</div>
          ) : (
            posts.map((post) => {
              const reactions = reactionCounts(post);
              return (
                <article
                  key={post.id}
                  className="p-6 rounded-[32px] bg-[#0F111A] border border-white/[0.08] shadow-sm hover:border-primary-500/30 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-lg border border-white/10 relative overflow-hidden">
                        {post.authorEmail && (
                          <img
                            alt="User Avatar"
                            className="w-full h-full object-cover"
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=8b5cf6&color=fff`}
                          />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{post.author}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{formatRelativeTime(post.createdAt)}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/10 text-teal-400 text-[11px] font-bold tracking-wide">
                      XP {post.points}
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-white mb-2 leading-tight">{post.title}</h2>
                    <p className="text-slate-400 text-[15px] leading-relaxed font-light">{post.description}</p>
                  </div>

                  {post.imageUrl && (
                    <div className="relative w-full rounded-2xl overflow-hidden mb-5 bg-dark-800 border border-white/5 group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                      <div className="aspect-[16/10] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 relative">
                        <img
                          alt="Post Content"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          src={post.imageUrl}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-primary-500/30 transition-all group">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white">0 comments</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-primary-500/30 transition-all group">
                      <span className="material-symbols-outlined text-[16px] text-blue-400">ios_share</span>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Share</span>
                    </button>
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-orange-500/30 transition-all group">
                        <span className="text-sm">🔥</span>
                        <span className="text-xs font-bold text-slate-400 group-hover:text-orange-400">{reactions.fire}</span>
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-yellow-500/30 transition-all group">
                        <span className="text-sm">😯</span>
                        <span className="text-xs font-bold text-slate-400 group-hover:text-yellow-400">{reactions.wow}</span>
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-pink-500/30 transition-all group">
                        <span className="text-sm">💖</span>
                        <span className="text-xs font-bold text-slate-400 group-hover:text-pink-400">{reactions.love}</span>
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-emerald-500/30 transition-all group">
                        <span className="text-sm">😎</span>
                        <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-400">{reactions.cool}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.05]">
                    <button className="flex items-center gap-3 w-full text-left group">
                      <span className="material-symbols-outlined text-slate-500 group-hover:text-slate-300 text-[20px] transition-colors">
                        chat_bubble_outline
                      </span>
                      <span className="text-sm text-slate-500 group-hover:text-slate-300 font-medium transition-colors">Add a comment...</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}

          <div className="py-8 text-center">
            <button className="text-sm font-bold text-slate-500 hover:text-primary-400 transition-colors flex items-center justify-center gap-2 mx-auto">
              <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
              Load older posts
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-4 space-y-6">
          <LeaderboardSidebar compact />
          
          {/* Upcoming Deadlines */}
          <div className="bg-dark-900 border border-white/5 rounded-3xl p-6">
            <h3 className="font-bold text-white mb-4 text-sm">Upcoming Deadlines</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center justify-center w-10 h-12 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Feb</span>
                  <span className="text-sm font-bold text-white">24</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 leading-tight">Typography Final</h4>
                  <p className="text-[10px] text-slate-500 mt-1">11th Grade · 2 days left</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center justify-center w-10 h-12 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Feb</span>
                  <span className="text-sm font-bold text-white">28</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 leading-tight">Logo Contest Sub.</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Global · 6 days left</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-white/5 text-center">
        <p className="text-[10px] text-slate-600">Mind Verse · Graphic Design Lab · 2025</p>
      </footer>
    </>
  );
}

