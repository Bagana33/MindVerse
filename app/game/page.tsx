"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useSession } from "../../components/auth/useSession";
import { cachedFetch } from "../../lib/fetchCache";

type GameImage = {
  id: string;
  imageUrl: string;
  imageUrls?: string[]; // Array of all images for this submission
  addedBy: string | null;
  studentName?: string | null;
  studentNickname?: string | null;
  likes: number;
  likedBy: string[];
  createdAt: string;
};

type Ranking = {
  email: string;
  name: string;
  likes: number;
  xp: number;
  rank: number;
};

type GameState = {
  gameEnded: boolean;
  winner: { email: string; name: string } | null;
  rankings: Ranking[];
  lessonId: string | null;
  targetGrade: string | null;
};

type Lesson = {
  id: string;
  title: string;
  description: string;
  targetGrades: string[];
};

export default function GamePage() {
  const { session } = useSession();
  const [images, setImages] = useState<GameImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({ 
    gameEnded: false, 
    winner: null,
    rankings: [],
    lessonId: null,
    targetGrade: null,
  });
  const [ending, setEnding] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [settingUp, setSettingUp] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    if (session?.role === "teacher") {
      fetchLessons();
    }
    fetchImages();
    // Poll less frequently to бууруулах ачаалал
    const interval = setInterval(fetchImages, 10000);
    return () => clearInterval(interval);
  }, [session]);

  async function fetchLessons() {
    try {
      const res = await cachedFetch("/api/lessons");
      const json = await res.json();
      if (json.ok) {
        setLessons(json.lessons || []);
      }
    } catch (err) {
      console.error("Failed to fetch lessons:", err);
    }
  }

  async function fetchImages() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      const res = await cachedFetch("/api/game/images");
      const json = await res.json();
      if (json.ok) {
        // Sort by likes (highest first), then by creation date (newest first)
        const sortedImages = (json.images || []).sort((a: GameImage, b: GameImage) => {
          if (b.likes !== a.likes) {
            return b.likes - a.likes;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Only update state if data actually changed to prevent DOM repainting
        setImages((prev) => {
          if (prev.length !== sortedImages.length) return sortedImages;
          const hasChanged = sortedImages.some((img: GameImage, idx: number) => {
            const p = prev[idx];
            return !p || p.id !== img.id || p.likes !== img.likes;
          });
          return hasChanged ? sortedImages : prev;
        });

        setGameState((prev) => {
          const gameEnded = Boolean(json.gameEnded);
          const winnerEmail = json.winner?.email ?? null;
          const lessonId = json.lessonId ?? null;
          const targetGrade = json.targetGrade ?? null;
          const rankingsLen = json.rankings?.length ?? 0;

          if (
            prev.gameEnded === gameEnded &&
            prev.winner?.email === winnerEmail &&
            prev.lessonId === lessonId &&
            prev.targetGrade === targetGrade &&
            prev.rankings.length === rankingsLen
          ) {
            return prev;
          }

          return {
            gameEnded,
            winner: json.winner || null,
            rankings: json.rankings || [],
            lessonId,
            targetGrade,
          };
        });
      }
    } catch (err) {
      console.error("Fetch game images error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup() {
    if (!session || session.role !== "teacher") {
      alert("Зөвхөн багш тоглоом тохируулах эрхтэй");
      return;
    }
    if (!selectedLessonId) {
      setError("Хичээл сонгоно уу");
      return;
    }
    setSettingUp(true);
    setError(null);
    try {
      const res = await fetch("/api/game/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          lessonId: selectedLessonId,
          targetGrade: selectedGrade || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchImages(); // Refresh images
        setSelectedLessonId("");
        setSelectedGrade("");
        alert(json.message || "Тоглоом амжилттай тохируулагдлаа!");
      } else {
        setError(json.error || "Тоглоом тохируулахад алдаа гарлаа");
      }
    } catch (err) {
      console.error("Setup error:", err);
      setError("Алдаа гарлаа");
    } finally {
      setSettingUp(false);
    }
  }

  async function handleVote(id: string) {
    if (!session) {
      alert("Нэвтэрнэ үү");
      return;
    }
    if (gameState.gameEnded) {
      alert("Тоглоом дууссан байна");
      return;
    }
    setVotingId(id);
    setError(null);
    try {
      const res = await fetch("/api/game/images/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, vote: "like" }),
      });
      const json = await res.json();
      if (json.ok) {
        // Sort by likes (highest first), then by creation date (newest first)
        const sortedImages = (json.images || []).sort((a: GameImage, b: GameImage) => {
          if (b.likes !== a.likes) {
            return b.likes - a.likes;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        // Force React to re-render by creating a new array reference
        setImages([...sortedImages]);
      } else {
        setError(json.error || "Санал өгөхөд алдаа гарлаа");
        alert(json.error || "Санал өгөхөд алдаа гарлаа");
      }
    } catch (err) {
      console.error("Vote error:", err);
      setError("Санал өгөхөд алдаа гарлаа");
      alert("Санал өгөхөд алдаа гарлаа");
    } finally {
      setVotingId(null);
    }
  }

  async function handleEndGame() {
    if (!session || session.role !== "teacher") {
      alert("Зөвхөн багш тоглоом дуусгах эрхтэй");
      return;
    }
    if (gameState.gameEnded) {
      alert("Тоглоом аль хэдийн дууссан байна");
      return;
    }
    if (!confirm("Тоглоомыг дуусгах уу? Хамгийн их like авсан хүүхэд +2 XP хүртнэ.")) {
      return;
    }
    setEnding(true);
    setError(null);
    try {
      const res = await fetch("/api/game/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setGameState({
          gameEnded: true,
          winner: json.winner || null,
          rankings: json.rankings || [],
          lessonId: gameState.lessonId,
          targetGrade: gameState.targetGrade,
        });
        await fetchImages(); // Refresh to get updated state
        alert(json.message || "Тоглоом амжилттай дууссан!");
      } else {
        setError(json.error || "Тоглоом дуусгахад алдаа гарлаа");
      }
    } catch (err) {
      console.error("End game error:", err);
      setError("Алдаа гарлаа");
    } finally {
      setEnding(false);
    }
  }

  async function handleResetGame() {
    if (!session || session.role !== "teacher") {
      alert("Зөвхөн багш тоглоом дахин эхлүүлэх эрхтэй");
      return;
    }
    if (!confirm("Тоглоомыг дахин эхлүүлэх үү? Одоогийн тоглолтын мэдээлэл устах болно.")) {
      return;
    }
    setSettingUp(true);
    setError(null);
    try {
      const res = await fetch("/api/game/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setGameState({
          gameEnded: false,
          winner: null,
          rankings: [],
          lessonId: null,
          targetGrade: null,
        });
        setImages([]);
        setSelectedLessonId("");
        setSelectedGrade("");
        // Refresh images to get updated scores
        await fetchImages();
        alert("Тоглоом амжилттай дахин эхлэв!");
      } else {
        setError(json.error || "Тоглоом дахин эхлүүлэхэд алдаа гарлаа");
      }
    } catch (err) {
      console.error("Reset game error:", err);
      setError("Алдаа гарлаа");
    } finally {
      setSettingUp(false);
    }
  }

  const myEmail = session?.email;
  const selectedLesson = lessons.find(l => l.id === gameState.lessonId);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[300px] flex items-center justify-center text-slate-400">Ачаалж байна...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            🖼️ Vote Game
          </h1>
          <p className="text-slate-400 text-sm">
            Хичээлийн даалгаврын ажлуудыг like өгч хамгийн гоё ажлыг тодруулна.
          </p>
          {gameState.lessonId && selectedLesson && (
            <div className="mt-4 glass-panel p-4 rounded-2xl border border-violet-500/30">
              <div className="text-lg font-semibold text-violet-300">{selectedLesson.title}</div>
              {gameState.targetGrade && (
                <div className="text-sm text-slate-400 mt-1">{gameState.targetGrade} анги</div>
              )}
            </div>
          )}
          {session?.role === "teacher" && gameState.lessonId && (
            <div className="mt-4 flex items-center gap-3 justify-center">
              {!gameState.gameEnded && (
                <button
                  onClick={handleEndGame}
                  disabled={ending || images.length === 0}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.6)] disabled:opacity-60 transition-all"
                >
                  {ending ? "Дуусгаж байна..." : "🎯 Тоглоом дуусгах"}
                </button>
              )}
              <button
                onClick={handleResetGame}
                disabled={settingUp}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.6)] disabled:opacity-60 transition-all"
              >
                {settingUp ? "Дахин эхлүүлж байна..." : "🔄 Тоглоом дахин эхлүүлэх"}
              </button>
            </div>
          )}
          {gameState.gameEnded && gameState.rankings.length > 0 && (
            <div className="mt-4 glass-panel p-4 rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
              <div className="text-2xl mb-3">🎉 Тоглоом дууссан!</div>
              <div className="space-y-2">
                {gameState.rankings.map((ranking) => (
                  <div key={ranking.email} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-300 font-bold text-lg">{ranking.rank}.</span>
                      <span className="text-slate-200">{ranking.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <span>{ranking.likes} 👍</span>
                      <span className="text-green-400 font-semibold">+{ranking.xp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {gameState.gameEnded && gameState.rankings.length === 0 && gameState.winner && (
            <div className="mt-4 glass-panel p-4 rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
              <div className="text-2xl mb-2">🎉 Баяр хүргэе!</div>
              <div className="text-lg font-semibold text-yellow-300">
                {gameState.winner.name} хамгийн их like авсан!
              </div>
            </div>
          )}
        </div>

        {session?.role === "teacher" && !gameState.lessonId && (
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200">Тоглоом тохируулах</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Хичээл сонгох *</label>
                <select
                  value={selectedLessonId}
                  onChange={(e) => setSelectedLessonId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Хичээл сонгох...</option>
                  {lessons.map(lesson => (
                    <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Анги (сонгохгүй бол бүх анги)</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Бүх анги</option>
                  <option value="10">10 анги</option>
                  <option value="11">11 анги</option>
                  <option value="12">12 анги</option>
                  <option value="Р">Р анги</option>
                </select>
              </div>
              <button
                onClick={handleSetup}
                disabled={settingUp || !selectedLessonId}
                className="w-full px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-60 transition-all"
              >
                {settingUp ? "Тохируулж байна..." : "Тоглоом эхлүүлэх"}
              </button>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </div>
        )}

        {!gameState.lessonId && session?.role !== "teacher" && (
          <div className="glass-panel p-6 rounded-2xl text-center text-slate-400">
            Багш тоглоом тохируулаагүй байна.
          </div>
        )}

        {error && (
          <div className="glass-panel p-4 rounded-2xl border border-red-500/50 bg-red-500/10">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {gameState.lessonId && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">Ажлууд</h2>
            {images.length === 0 ? (
              <div className="glass-panel p-6 rounded-2xl text-center text-slate-400">
                Одоогоор ажил байхгүй байна.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {images.map((img, index) => {
                  const liked = myEmail && img.likedBy.includes(myEmail);
                  // Ensure we have an array of image URLs
                  const imageUrls = (img.imageUrls && Array.isArray(img.imageUrls) && img.imageUrls.length > 0) 
                    ? img.imageUrls 
                    : (img.imageUrl ? [img.imageUrl] : []);
                  const currentIndex = currentImageIndex[img.id] || 0;
                  const hasMultipleImages = imageUrls.length > 1;
                  
                  return (
                    <div key={`${img.id}-${img.likes}`} className="glass-panel p-4 rounded-2xl space-y-3 border border-slate-800 hover:border-violet-500/40 transition-all duration-300">
                      <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 relative">
                        <img 
                          src={imageUrls[currentIndex]} 
                          alt="Game item" 
                          className="w-full h-64 object-cover" 
                        />
                        {hasMultipleImages && (
                          <>
                            {/* Left arrow */}
                            {currentIndex > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(prev => ({ ...prev, [img.id]: currentIndex - 1 }));
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
                                aria-label="Previous image"
                              >
                                ←
                              </button>
                            )}
                            {/* Right arrow */}
                            {currentIndex < imageUrls.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(prev => ({ ...prev, [img.id]: currentIndex + 1 }));
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
                                aria-label="Next image"
                              >
                                →
                              </button>
                            )}
                            {/* Image counter */}
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                              {currentIndex + 1} / {imageUrls.length}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-200">
                        <span className="text-yellow-300 font-semibold">Оноо: {img.likes}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleVote(img.id)}
                            disabled={votingId === img.id || gameState.gameEnded}
                            className={`px-3 py-1 rounded-full text-xs border transition-all ${
                              liked
                                ? "bg-green-500/20 border-green-500 text-green-300"
                                : "border-slate-700 bg-slate-800/50 text-slate-200 hover:border-green-500/50"
                            } ${gameState.gameEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            👍 {img.likes}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
