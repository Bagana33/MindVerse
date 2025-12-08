"use client";

import { useState, useEffect } from "react";
import { NeonLayout } from "../../components/layout/NeonLayout";
import { useSession } from "../../components/auth/useSession";

export default function SpinnerPage() {
  const { session } = useSession();
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load shared options from API
  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch('/api/spinner');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (json.ok && Array.isArray(json.options) && json.options.length > 0) {
          setOptions(json.options);
        } else {
          // Fallback to default if empty or invalid
          setOptions(["Сонголт 1", "Сонголт 2", "Сонголт 3"]);
        }
      } catch (err) {
        console.error("Failed to fetch spinner options:", err);
        // Fallback to default on any error
        setOptions(["Сонголт 1", "Сонголт 2", "Сонголт 3"]);
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
    // Poll for updates every 2 seconds
    const interval = setInterval(loadOptions, 2000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOptions() {
    try {
      const res = await fetch('/api/spinner');
      if (!res.ok) {
        return; // Silently fail, keep current options
      }
      const json = await res.json();
      if (json.ok && Array.isArray(json.options) && json.options.length > 0) {
        setOptions(json.options);
      }
    } catch (err) {
      // Silently fail, keep current options
      console.error("Failed to fetch spinner options:", err);
    }
  }

  const colors = [
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#06b6d4", // cyan
    "#a855f7", // purple
  ];

  async function addOption() {
    if (!newOption.trim()) return;
    if (!session) {
      alert("Нэвтэрнэ үү");
      return;
    }

    try {
      const res = await fetch('/api/spinner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option: newOption.trim() }),
      });

      const json = await res.json();
      if (json.ok) {
        setOptions(json.options || []);
        setNewOption("");
        // Refresh to show updated list
        await fetchOptions();
      } else {
        alert(json.error || "Нэмэхэд алдаа гарлаа");
      }
    } catch (err) {
      console.error("Failed to add option:", err);
      alert("Алдаа гарлаа");
    }
  }

  async function removeOption(optionText: string) {
    if (options.length <= 2) {
      alert("Хамгийн багадаа 2 сонголт байх ёстой");
      return;
    }
    if (!session) {
      alert("Нэвтэрнэ үү");
      return;
    }

    try {
      const res = await fetch('/api/spinner', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option: optionText }),
      });

      const json = await res.json();
      if (json.ok) {
        setOptions(json.options || []);
        if (selectedIndex !== null && options[selectedIndex] === optionText) {
          setSelectedIndex(null);
        }
        // Refresh to show updated list
        await fetchOptions();
      } else {
        alert(json.error || "Устгахад алдаа гарлаа");
      }
    } catch (err) {
      console.error("Failed to remove option:", err);
      alert("Алдаа гарлаа");
    }
  }

  function spin() {
    if (options.length < 2 || spinning) return;

    setSpinning(true);
    setSelectedIndex(null);

    // Better random selection using crypto.getRandomValues for true randomness
    let randomValue: number;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const randomArray = new Uint32Array(1);
      window.crypto.getRandomValues(randomArray);
      randomValue = randomArray[0] / (0xFFFFFFFF + 1);
    } else {
      // Fallback to Math.random if crypto not available
      randomValue = Math.random();
    }
    
    // Use the random value to select index - ensure uniform distribution
    const randomIndex = Math.floor(randomValue * options.length);
    
    // Calculate rotation (multiple full spins + final position)
    // Add extra randomness to rotation for more unpredictable results
    const baseSpins = 10;
    const extraSpins = Math.random() * 6; // 0-6 additional spins
    const fullSpins = baseSpins + extraSpins;
    const anglePerSlice = 360 / options.length;
    
    // Add small random offset to final angle for more randomness
    // But keep it within the slice to ensure correct selection
    const randomOffset = (Math.random() - 0.5) * (anglePerSlice * 0.2); // ±10% of slice
    const finalAngle = randomIndex * anglePerSlice + randomOffset;
    
    // Get current rotation and normalize
    const currentNormalized = ((rotation % 360) + 360) % 360;
    // Calculate target: current + full spins + adjust to target slice
    const targetRotation = rotation + fullSpins * 360 + (360 - currentNormalized) + finalAngle;

    setRotation(targetRotation);

    // Show result after animation completes
    const animationDuration = 4000;
    setTimeout(() => {
      setSelectedIndex(randomIndex);
      setSpinning(false);
    }, animationDuration);
  }

  async function handleShare() {
    if (selectedIndex === null) return;

    const selectedOption = options[selectedIndex];
    const shareText = `🎰 Lucky Spinner: "${selectedOption}" сонгогдлоо!`;

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Lucky Spinner Result',
          text: shareText,
        });
        return;
      } catch (err) {
        // User cancelled or error, fall back to clipboard
      }
    }

    // Fall back to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      alert('Хуваалцах боломжгүй байна');
    }
  }

  const anglePerSlice = 360 / options.length;

  if (loading) {
    return (
      <NeonLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <div className="text-slate-400">Ачаалж байна...</div>
          </div>
        </div>
      </NeonLayout>
    );
  }

  return (
    <NeonLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-2">
            🎰 Lucky Spinner
          </h1>
          <p className="text-slate-400">Бүгд хамтдаа сонголт нэмж, санамсаргүй сонголт хий</p>
        </div>

        {/* Options Input */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Сонголтууд ({options.length})</h2>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOption()}
              placeholder="Шинэ сонголт нэмэх..."
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={addOption}
              disabled={!newOption.trim()}
              className="px-6 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              + Нэмэх
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {options.map((option, index) => (
              <div
                key={`${option}-${index}`}
                className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="flex-1 text-sm text-slate-200 truncate">{option}</span>
                {options.length > 2 && session && (
                  <button
                    onClick={() => removeOption(option)}
                    className="text-red-400 hover:text-red-300 text-xs px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Spinner Wheel */}
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center">
          <div className="relative w-80 h-80 mb-8">
            {/* Wheel Container */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4000ms cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                willChange: spinning ? 'transform' : 'auto',
              }}
              viewBox="0 0 200 200"
            >
              <defs>
                {options.map((_, index) => (
                  <linearGradient key={index} id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity="1" />
                    <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity="0.7" />
                  </linearGradient>
                ))}
              </defs>
              {options.map((option, index) => {
                const startAngle = (index * anglePerSlice - 90) * (Math.PI / 180);
                const endAngle = ((index + 1) * anglePerSlice - 90) * (Math.PI / 180);
                const isSelected = selectedIndex === index && !spinning;
                
                const x1 = 100 + 100 * Math.cos(startAngle);
                const y1 = 100 + 100 * Math.sin(startAngle);
                const x2 = 100 + 100 * Math.cos(endAngle);
                const y2 = 100 + 100 * Math.sin(endAngle);
                
                const midAngle = (startAngle + endAngle) / 2;
                const textX = 100 + 70 * Math.cos(midAngle);
                const textY = 100 + 70 * Math.sin(midAngle);
                
                return (
                  <g key={index}>
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                      fill={`url(#gradient-${index})`}
                      stroke={isSelected ? "#fbbf24" : "#1e293b"}
                      strokeWidth={isSelected ? 3 : 2}
                      opacity={isSelected ? 1 : 0.9}
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                      transform={`rotate(${(midAngle * 180) / Math.PI + 90}, ${textX}, ${textY})`}
                      className="pointer-events-none"
                    >
                      {option.length > 15 ? option.substring(0, 15) + "..." : option}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Center Circle with Pointer */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full border-4 border-slate-900 shadow-lg z-10 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[30px] border-b-yellow-400 absolute -top-8 transform rotate-180 drop-shadow-lg" />
            </div>
          </div>

          {/* Spin Button */}
          <button
            onClick={spin}
            disabled={spinning || options.length < 2}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white font-bold text-lg shadow-[0_8px_32px_rgba(139,92,246,0.5)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.7)] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
          >
            {spinning ? "Эргэж байна..." : "🎰 Эргүүлэх"}
          </button>

          {/* Result Display */}
          {selectedIndex !== null && !spinning && (
            <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-2 border-violet-400/50 animate-pulse">
              <div className="text-center">
                <div className="text-3xl mb-2">🎉</div>
                <div className="text-2xl font-bold text-violet-300 mb-1">
                  {options[selectedIndex]}
                </div>
                <div className="text-sm text-slate-400 mb-4">Сонгогдлоо!</div>
                <button
                  onClick={handleShare}
                  className="px-6 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                >
                  {shareCopied ? (
                    <>
                      <span>✓</span>
                      <span>Хуулагдлаа!</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>Үр дүнг хуулах</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="glass-panel p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-sm text-blue-300">
            💡 <strong>Зөвлөмж:</strong> Хамгийн багадаа 2 сонголт шаардлагатай. Хязгааргүй сонголт нэмж болно.
          </p>
        </div>
      </div>
    </NeonLayout>
  );
}

