"use client";

import { useEffect, useState } from "react";
import { NeonLayout } from "../../components/layout/NeonLayout";
import { useSession } from "../../components/auth/useSession";

type GameImage = {
  id: string;
  imageUrl: string;
  addedBy: string | null;
  likes: number;
  dislikes: number;
  score: number;
  likedBy: string[];
  dislikedBy: string[];
  createdAt: string;
};

type GameState = {
  gameEnded: boolean;
  winner: { email: string; name: string } | null;
};

export default function GamePage() {
  const { session } = useSession();
  const [images, setImages] = useState<GameImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({ gameEnded: false, winner: null });
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    fetchImages();
    const interval = setInterval(fetchImages, 2000);
    return () => clearInterval(interval);
  }, []);

  async function fetchImages() {
    try {
      const res = await fetch("/api/game/images");
      const json = await res.json();
      if (json.ok) {
        setImages(json.images || []);
        setGameState({
          gameEnded: json.gameEnded || false,
          winner: json.winner || null,
        });
      }
    } catch (err) {
      console.error("Fetch game images error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Файл 10MB-аас бага байх ёстой");
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "neoncanvas/game" }),
      });
      if (!signRes.ok) throw new Error("sign failed");
      const signJson = await signRes.json();
      if (!signJson?.ok) throw new Error("sign response invalid");

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signJson.apiKey);
      form.append("timestamp", String(signJson.timestamp));
      form.append("signature", signJson.signature);
      form.append("folder", signJson.folder || "neoncanvas/game");

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signJson.cloudName}/auto/upload`,
        { method: "POST", body: form }
      );
      if (!uploadRes.ok) throw new Error(`upload failed: ${uploadRes.status}`);
      const uploadJson = await uploadRes.json();
      if (!uploadJson?.secure_url) throw new Error("no secure_url");

      setNewImageUrl(uploadJson.secure_url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError("Зураг байршуулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleAdd() {
    if (!session) {
      alert("Нэвтэрнэ үү");
      return;
    }
    if (!newImageUrl.trim()) {
      setError("Зураг оруулна уу");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/game/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: newImageUrl.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setImages(json.images || []);
        setNewImageUrl("");
      } else {
        setError(json.error || "Нэмэхэд алдаа гарлаа");
      }
    } catch (err) {
      console.error("Add image error:", err);
      setError("Алдаа гарлаа");
    } finally {
      setAdding(false);
    }
  }

  async function handleVote(id: string, vote: "like" | "dislike") {
    if (!session) {
      alert("Нэвтэрнэ үү");
      return;
    }
    if (gameState.gameEnded) {
      alert("Тоглоом дууссан байна");
      return;
    }
    setVotingId(id);
    try {
      const res = await fetch("/api/game/images/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, vote }),
      });
      const json = await res.json();
      if (json.ok) {
        setImages(json.images || []);
      }
    } catch (err) {
      console.error("Vote error:", err);
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
          winner: json.winner,
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

  const myEmail = session?.email;

  if (loading) {
    return (
      <NeonLayout>
        <div className="min-h-[300px] flex items-center justify-center text-slate-400">Ачаалж байна...</div>
      </NeonLayout>
    );
  }

  return (
    <NeonLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            🖼️ Vote Game
          </h1>
          <p className="text-slate-400 text-sm">
            Зураг оруулаад бүгдээрээ like/dislike өгч хамгийн гоё зургыг тодруулна.
          </p>
          {session?.role === "teacher" && !gameState.gameEnded && (
            <button
              onClick={handleEndGame}
              disabled={ending || images.length === 0}
              className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.6)] disabled:opacity-60 transition-all"
            >
              {ending ? "Дуусгаж байна..." : "🎯 Тоглоом дуусгах"}
            </button>
          )}
          {gameState.gameEnded && gameState.winner && (
            <div className="mt-4 glass-panel p-4 rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
              <div className="text-2xl mb-2">🎉 Баяр хүргэе!</div>
              <div className="text-lg font-semibold text-yellow-300">
                {gameState.winner.name} хамгийн их like авсан тул +2 XP хүртлээ!
              </div>
            </div>
          )}
        </div>

        {!gameState.gameEnded && (
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200">Зураг оруулах</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Зурагны URL (эсвэл файл upload хийнэ)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm cursor-pointer hover:border-violet-500">
                  Файл upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadFile} disabled={uploading} />
                </label>
                <button
                  onClick={handleAdd}
                  disabled={adding || uploading || !newImageUrl.trim()}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-60 transition-all"
                >
                  {adding ? "Нэмэж байна..." : "Нэмэх"}
                </button>
                {uploading && <span className="text-xs text-slate-400">Байршуулж байна...</span>}
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Зургууд</h2>
          {images.length === 0 ? (
            <div className="glass-panel p-6 rounded-2xl text-center text-slate-400">Одоогоор зураг байхгүй байна.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img) => {
                const liked = myEmail && img.likedBy.includes(myEmail);
                const disliked = myEmail && img.dislikedBy.includes(myEmail);
                return (
                  <div key={img.id} className="glass-panel p-4 rounded-2xl space-y-3 border border-slate-800 hover:border-violet-500/40 transition-colors">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Оруулсан: {img.addedBy || "?"}</span>
                      <span className="text-slate-500">{new Date(img.createdAt).toLocaleString("mn-MN")}</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                      <img src={img.imageUrl} alt="Game item" className="w-full h-64 object-cover" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="text-yellow-300 font-semibold">Оноо: {img.score}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVote(img.id, "like")}
                          disabled={votingId === img.id || gameState.gameEnded}
                          className={`px-3 py-1 rounded-full text-xs border transition-all ${
                            liked
                              ? "bg-green-500/20 border-green-500 text-green-300"
                              : "border-slate-700 bg-slate-800/50 text-slate-200 hover:border-green-500/50"
                          } ${gameState.gameEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          👍 {img.likes}
                        </button>
                        <button
                          onClick={() => handleVote(img.id, "dislike")}
                          disabled={votingId === img.id || gameState.gameEnded}
                          className={`px-3 py-1 rounded-full text-xs border transition-all ${
                            disliked
                              ? "bg-red-500/20 border-red-500 text-red-300"
                              : "border-slate-700 bg-slate-800/50 text-slate-200 hover:border-red-500/50"
                          } ${gameState.gameEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          👎 {img.dislikes}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </NeonLayout>
  );
}

