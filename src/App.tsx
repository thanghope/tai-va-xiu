import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------------
   Provably-fair helpers (unchanged logic)
   ------------------------- */
async function sha256Hex(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deriveDiceFromSeeds(serverSeed: string, clientSeed: string, nonce: number) {
  const base = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = await sha256Hex(base);
  const dice: number[] = [];
  for (let i = 0; i < 3; i++) {
    const chunk = hash.slice(i * 8, i * 8 + 8);
    const val = parseInt(chunk, 16);
    dice.push((val % 6) + 1);
  }
  return { dice, hashBase: hash };
}

/* -------------------------
   Dice SVG (clean, crisp)
   We'll animate the wrapper for "3D-ish" effect
   ------------------------- */
function DiceSVG({ value, size = 92 }: { value: number; size?: number }) {
  const dots: Record<number, number[][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-2xl">
      <defs>
        <linearGradient id="dgrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#f3f4f6" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="14" fill="url(#dgrad)" stroke="#bcbcbc" />
      {dots[value].map(([r, c], i) => (
        <circle key={i} cx={(c + 0.9) * 25} cy={(r + 0.9) * 25} r="7.5" fill="#0b1220" />
      ))}
    </svg>
  );
}

/* -------------------------
   WebAudio "shake" sound generator
   Simple multi-burst oscillator + noise to simulate dice shake
   ------------------------- */
function playShakeSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    // create a short white-noise burst function
    const playNoiseBurst = (time: number, dur = 0.08, gain = 0.06) => {
      const bufferSize = ctx.sampleRate * dur;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(master);
      src.start(time);
    };

    // create oscillator "clack" bursts
    const playOscBurst = (time: number, freq = 900, dur = 0.06, gain = 0.1) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g).connect(master);
      o.start(time);
      g.gain.linearRampToValueAtTime(gain, time + 0.01);
      g.gain.linearRampToValueAtTime(0.0001, time + dur);
      o.stop(time + dur + 0.02);
    };

    const now = ctx.currentTime + 0.02;
    // schedule multiple small bursts to simulate shake
    for (let i = 0; i < 7; i++) {
      const t = now + i * 0.06 + Math.random() * 0.03;
      playNoiseBurst(t, 0.06, 0.04 + Math.random() * 0.03);
      playOscBurst(t + 0.01, 700 + Math.random() * 900, 0.06, 0.06 + Math.random() * 0.06);
    }

    // small "clack" at end
    playOscBurst(now + 0.45, 1200, 0.12, 0.14);
  } catch (e) {
    // ignore if audio not allowed
    // console.warn("Audio failed", e);
  }
}

/* -------------------------
   Main App: Casino-style UI (keeps all logic)
   ------------------------- */
export default function App(): JSX.Element {
  // Game logic state
  const [balance, setBalance] = useState<number>(1000);
  const [betAmount, setBetAmount] = useState<number>(50);
  const [choice, setChoice] = useState<"tai" | "xiu">("tai");
  const [history, setHistory] = useState<any[]>([]);
  const [rolling, setRolling] = useState(false);

  // seeds & fairness
  const [serverSeed, setServerSeed] = useState<string>(() => Math.random().toString(36).slice(2));
  const [serverSeedHash, setServerSeedHash] = useState<string>("");
  const [clientSeed, setClientSeed] = useState<string>(() => "guest" + Math.floor(Math.random() * 1000));
  const [nonce, setNonce] = useState<number>(0);

  // last roll
  const [lastDice, setLastDice] = useState<number[]>([1, 1, 1]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastHashBase, setLastHashBase] = useState<string>("");

  useEffect(() => {
    (async () => {
      const h = await sha256Hex(serverSeed);
      setServerSeedHash(h);
    })();
  }, [serverSeed]);

  useEffect(() => {
    const saved = localStorage.getItem("tx_history_v1");
    if (saved) setHistory(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem("tx_history_v1", JSON.stringify(history));
  }, [history]);

  const houseEdge = 0.025;
  const quickBets = [10, 50, 100, 250, 500];

  // roll function: uses deriveDiceFromSeeds (provably-fair)
  const roll = async () => {
    if (rolling) return;
    if (betAmount <= 0 || betAmount > balance) {
      alert("Số tiền cược không hợp lệ hoặc vượt quá số dư.");
      return;
    }
    setRolling(true);
    playShakeSound();

    const curNonce = nonce + 1;
    setNonce(curNonce);

    // derive dice deterministically (logic unchanged)
    const { dice, hashBase } = await deriveDiceFromSeeds(serverSeed, clientSeed, curNonce);

    // wait for animation to "finish" while showing rotating dice
    await new Promise((r) => setTimeout(r, 1100));
    setLastDice(dice);
    setLastHashBase(hashBase);

    const sum = dice.reduce((a, b) => a + b, 0);
    const isTai = sum >= 11 && sum <= 17;
    const isXiu = sum >= 4 && sum <= 10;

    const win = (choice === "tai" && isTai) || (choice === "xiu" && isXiu);
    const delta = win ? Math.round(betAmount * (1 - houseEdge)) : -betAmount;
    const newBalance = balance + delta;
    setBalance(newBalance);

    const result = {
      time: new Date().toISOString(),
      dice,
      sum,
      choice,
      bet: betAmount,
      win,
      delta,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce: curNonce,
      hashBase,
    };
    setHistory((h) => [result, ...h].slice(0, 30));
    setLastResult(result);

    // occasionally rotate server seed to keep it fresh
    setServerSeed(Math.random().toString(36).slice(2));
    setRolling(false);
  };

  const resetBalance = () => setBalance(1000);

  const sumDisplay = useMemo(() => lastDice.reduce((a, b) => a + b, 0), [lastDice]);

  const lastWin = !!lastResult?.win;

  /* small inline style for casino glow */
  const InlineStyles = (
    <style>{`
      .neon { text-shadow: 0 0 8px rgba(250,204,21,0.85), 0 6px 28px rgba(245,158,11,0.06); }
      .btn-casino { background: linear-gradient(90deg,#f59e0b 0%, #facc15 45%, #f97316 100%); color: black; }
      .soft-card { box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(245,158,11,0.03); }
      .dice-3d { transform-style: preserve-3d; }
      .pulse-win { animation: pulse 1.05s ease-in-out; }
      @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
    `}</style>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#05060a] via-[#081021] to-[#020409] text-white flex items-center justify-center p-6 relative">
      {InlineStyles}
      <div className="w-full max-w-6xl rounded-3xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] soft-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left / main */}
        <div className="md:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold neon">TÀI — XỈU <span className="text-sm font-normal ml-3 text-slate-300">Casino Edition</span></h1>
              <p className="text-sm text-slate-400 mt-1">Provably-fair • 3 xúc xắc • Giao diện casino</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">SỐ DƯ</div>
              <div className="text-2xl font-bold neon">{balance.toLocaleString()} ₫</div>
            </div>
          </div>

          {/* Dice + controls */}
          <div className="bg-[linear-gradient(180deg,#071018,rgba(255,255,255,0.01))] border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 flex flex-col md:flex-row items-center gap-5">
            <div className="flex items-center gap-4">
              <div style={{ perspective: 900 }} className="p-4 rounded-3xl bg-[rgba(255,255,255,0.01)]">
                <motion.div
                  className="flex gap-3 items-center dice-3d"
                  animate={rolling ? { rotateX: [0, 360], rotateY: [0, 360] } : { rotateX: 0, rotateY: 0 }}
                  transition={{ duration: rolling ? 1.1 : 0.6, ease: "easeInOut" }}
                >
                  {lastDice.map((d, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: -6, rotate: 0 }}
                      animate={rolling ? { y: [-6, 6, -6], rotate: [0, 360] } : { y: 0, rotate: 0 }}
                      transition={{ duration: 1.1, repeat: 0, ease: "easeInOut", delay: i * 0.03 }}
                      className={`${lastWin ? "pulse-win" : ""}`}
                    >
                      <DiceSVG value={d} size={84} />
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              <div>
                <div className="text-xs text-slate-400">TỔNG</div>
                <div className="text-4xl font-bold neon">{sumDisplay}</div>
                <div className="text-sm mt-1 text-slate-300">
                  Kết quả:{" "}
                  <span className={`font-semibold ${sumDisplay >= 11 && sumDisplay <= 17 ? "text-emerald-400" : "text-rose-400"}`}>
                    {sumDisplay >= 11 && sumDisplay <= 17 ? "TÀI" : "XỈU"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex gap-3 items-center mb-3">
                <button
                  onClick={() => setChoice("tai")}
                  className={`px-4 py-2 rounded-full font-semibold transition-all ${choice === "tai" ? "btn-casino shadow-lg" : "border border-[rgba(255,255,255,0.04)] text-slate-200"}`}
                >
                  TÀI (11–17)
                </button>
                <button
                  onClick={() => setChoice("xiu")}
                  className={`px-4 py-2 rounded-full font-semibold transition-all ${choice === "xiu" ? "btn-casino shadow-lg" : "border border-[rgba(255,255,255,0.04)] text-slate-200"}`}
                >
                  XỈU (4–10)
                </button>

                <div className="ml-auto text-xs text-slate-400">tỷ lệ phần trăm: {(houseEdge * 100).toFixed(2)}%</div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  type="number"
                  min={1}
                  className="w-36 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]"
                />

                <div className="flex gap-2">
                  {quickBets.map((b) => (
                    <button key={b} onClick={() => setBetAmount(b)} className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.04)] text-sm">
                      {b}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (betAmount <= balance) roll();
                    else alert("Tiền cược vượt quá số dư.");
                  }}
                  disabled={rolling}
                  className="ml-auto px-6 py-3 rounded-2xl font-bold btn-casino text-black shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {rolling ? "Đang quay..." : "Đặt cược & Quay"}
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-400">Mẹo: Chọn cửa → chỉnh cược → bấm Quay. Server seed được hash để minh bạch.</div>
            </div>
          </div>

          {/* Provably fair + history */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-2xl p-4">
              <div className="text-sm text-slate-400">Provably Fair</div>
              <div className="mt-2 font-mono text-xs break-all text-slate-200">{serverSeedHash || "..."}</div>
              <div className="mt-3">
                <div className="text-xs text-slate-400">Client seed</div>
                <input value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] font-mono text-xs" />
              </div>
            </div>

            <div className="col-span-2 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Lịch sử ({history.length})</div>
                <div className="text-sm text-slate-400">Mới nhất ở trên</div>
              </div>

              <div className="mt-3 max-h-56 overflow-auto space-y-2">
                {history.length === 0 && <div className="text-slate-500 text-sm">Chưa có ván nào.</div>}
                {history.map((h, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-[rgba(255,255,255,0.03)] flex items-center justify-between bg-[rgba(0,0,0,0.15)]">
                    <div>
                      <div className="font-mono text-xs text-slate-300">{new Date(h.time).toLocaleString()}</div>
                      <div className="text-sm text-slate-100">{h.dice.join(" · ")} → Tổng {h.sum} → {h.win ? "Thắng" : "Thua"}</div>
                      <div className="text-xs text-slate-400">Cược {h.bet} → {h.delta > 0 ? `+${h.delta}` : h.delta}</div>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm ${h.win ? "bg-emerald-900 text-emerald-300" : "bg-rose-900 text-rose-300"}`}>{h.win ? "WIN" : "LOSE"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-4 bg-[linear-gradient(180deg,#071018,rgba(255,255,255,0.01))] border border-[rgba(255,255,255,0.04)]">
            <div className="text-sm text-slate-400">Cài đặt nhanh</div>
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={() => setBalance(balance + 500)} className="px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.04)]">Nạp thử +500</button>
              <button onClick={resetBalance} className="px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.04)]">Reset số dư</button>
              <button onClick={() => { setHistory([]); localStorage.removeItem("tx_history_v1"); }} className="px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.04)]">Xóa lịch sử</button>
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
            <div className="text-sm text-slate-400">Xác suất</div>
            <div className="mt-2 text-sm text-slate-200">
              <ul className="list-disc list-inside">
                <li>Tài: tổng 11–17 — trả ~even-money minus house edge</li>
                <li>Xỉu: tổng 4–10 — tương tự</li>
                <li>House edge: {(houseEdge * 100).toFixed(2)}%</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl p-3 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] font-mono text-xs text-slate-400">
            Developer notes<br />
            Single-file demo. For production: server-side seed rotation, secure accounting, and anti-cheat required.
          </div>
        </div>
      </div>

      {/* Confetti when win */}
      <AnimatePresence>
        {lastWin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-40">
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 22 }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ y: -20, x: `${Math.random() * 100}%`, opacity: 1 }}
                  animate={{ y: "110vh", rotate: Math.random() * 720 }}
                  transition={{ duration: 1.5 + Math.random() * 0.6, delay: (i % 6) * 0.04 }}
                  style={{
                    position: "absolute",
                    left: `${(i / 22) * 100}%`,
                    top: 0,
                    fontSize: 16 + Math.random() * 8,
                    color: ["#FDE68A", "#F59E0B", "#F97316", "#F43F5E"][i % 4],
                  }}
                >
                  ●
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-500">Thiết kế: Ang Thang • Provably-fair demo</div>
    </div>
  );
}
