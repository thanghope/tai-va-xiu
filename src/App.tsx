import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
import "./index.css";





/* -------------------------
   Provably-fair helpers (kept)
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
   Dice SVG
   ------------------------- */
function DiceSVG({ value, size = 84 }: { value: number; size?: number }) {
  const dots: Record<number, number[][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-lg drop-shadow-2xl">
      {/* Nền xúc xắc đậm hơn */}
      <rect x="0" y="0" width="100" height="100" rx="14" fill="#181E39" stroke="#202531" />
      {/* Chấm vàng đậm nổi bật */}
      {dots[value].map(([r, c], i) => (
        <circle key={i} cx={(c + 0.9) * 25} cy={(r + 0.9) * 25} r="7.5" fill="#f9d852" />
      ))}
    </svg>
  );
}

/* -------------------------
   Helper formatting
   ------------------------- */
const fmt = (n: number) => n.toLocaleString();

/* -------------------------
   Settings Modal Component (NEW)
   ------------------------- */
function SettingsModal({
  show,
  settingPw,
  setSettingPw,
  tryUnlockSettings,
  settingUnlocked,
  setSettingUnlocked,
  setShowSettings,
  depositValue,
  setDepositValue,
  doDeposit,
  doReset,
}: {
  show: boolean;
  settingPw: string;
  setSettingPw: (v: string) => void;
  tryUnlockSettings: () => void;
  settingUnlocked: boolean;
  setSettingUnlocked: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  depositValue: number;
  setDepositValue: (v: number) => void;
  doDeposit: () => void;
  doReset: () => void;
}) {
  if (!show) return null;
  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
    >
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        exit={{ y: 20 }}
        className="w-[520px] bg-[#041720] border border-[rgba(255,255,255,0.04)] rounded-2xl p-6"
      >
        {!settingUnlocked ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-slate-300">Nhập mật khẩu để vào Setting</div>
            <input
              type="password"
              value={settingPw}
              onChange={(e) => setSettingPw(e.target.value)}
              className="px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={tryUnlockSettings} className="px-4 py-2 rounded-lg bg-amber-400 text-black">Mở</button>
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-lg border">Hủy</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-slate-200">Setting (đã unlock)</div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={depositValue}
                onChange={(e) => setDepositValue(Number(e.target.value))}
                className="px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border"
                placeholder="Số tiền nạp"
              />
              <button onClick={doDeposit} className="px-3 py-2 rounded-md bg-emerald-400 text-black">Nạp</button>
            </div>
            <div className="flex gap-2">
              <button onClick={doReset} className="px-3 py-2 rounded-md bg-rose-500 text-black">Reset</button>
              <button onClick={() => { setSettingUnlocked(false); setShowSettings(false); setSettingPw(""); }} className="px-3 py-2 rounded-md border">Đóng</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* -------------------------
   App.tsx
   ------------------------- */
export default function App() {

//   function processResult() {
//   const sum = lastDice.reduce((a, b) => a + b, 0);
//   const res: "tai" | "xiu" = sum >= 11 && sum <= 17 ? "tai" : "xiu";
//   const win = choice === res;
//   const delta = win ? Math.round(betAmount * payoutMultiplier) : -betAmount;
//   setBalance((prev) => prev + delta);
//   setHistory((h) => [
//     { dice: lastDice, sum, result: res, win, bet: betAmount, time: new Date().toISOString() },
//     ...h.slice(0, 19),
//   ]);
//   setServerSeed(Math.random().toString(36).slice(2));
// }
  // ---- game state ----
  const [balance, setBalance] = useState<number>(() => {
    const raw = localStorage.getItem("tx_balance_v1");
    return raw ? Number(raw) : 0; // default 0
  });
  const [betAmount, setBetAmount] = useState<number>(100);
  const [choice, setChoice] = useState<"tai" | "xiu" | null>(null);

  // provably-fair seeds
  const [serverSeed, setServerSeed] = useState<string>(() => {
    const s = localStorage.getItem("tx_serverSeed_v1");
    return s || Math.random().toString(36).slice(2);
  });
  // const [serverSeedHash, setServerSeedHash] = useState<string>("");
  const [clientSeed, setClientSeed] = useState<string>(() => {
    const s = localStorage.getItem("tx_clientSeed_v1");
    return s || "guest" + Math.floor(Math.random() * 100000);
  });
  const [nonce, setNonce] = useState<number>(() => {
    const raw = localStorage.getItem("tx_nonce_v1");
    return raw ? Number(raw) : 0;
  });

  // roll / visible state
  const [lastDice, setLastDice] = useState<number[]>([1, 1, 1]);
  const [lastHashBase, setLastHashBase] = useState<string>("");
  const [rolling, setRolling] = useState<boolean>(false);
  const [bowlOpen, setBowlOpen] = useState<boolean>(false); // if bowl is open (revealed)
  const [waitingToOpen, setWaitingToOpen] = useState<boolean>(false); // bowl is covering, waiting for player to open

  // history (safe version)
const [history, setHistory] = useState<
  { dice: number[]; sum: number; result: "tai" | "xiu"; win: boolean; bet: number; time: string }[]
>(() => {
  const raw = localStorage.getItem("tx_history_v1");
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
});


  // settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [settingPw, setSettingPw] = useState("");
  const [settingUnlocked, setSettingUnlocked] = useState(false);
  const [depositValue, setDepositValue] = useState<number>(0);

  // compute server seed hash
  // useEffect(() => {
  //   (async () => {
  //     const h = await sha256Hex(serverSeed);
  //     setServerSeedHash(h);
  //     localStorage.setItem("tx_serverSeed_v1", serverSeed);
  //   })();
  // }, [serverSeed]);

  // persist clientSeed, nonce, balance, history
  useEffect(() => {
    localStorage.setItem("tx_clientSeed_v1", clientSeed);
  }, [clientSeed]);
  useEffect(() => {
    localStorage.setItem("tx_nonce_v1", String(nonce));
  }, [nonce]);
  useEffect(() => {
    localStorage.setItem("tx_balance_v1", String(balance));
  }, [balance]);
  useEffect(() => {
    localStorage.setItem("tx_history_v1", JSON.stringify(history));
  }, [history]);

  // const houseEdge = 0.02; // 2%
  const payoutMultiplier = 0.98;

  const sumDisplay = lastDice?.length ? lastDice.reduce((a, b) => a + b, 0) : 0;

  const lastResult = sumDisplay >= 11 ? "tai" : "xiu";

  // drag refs & threshold
  const bowlRef = useRef<HTMLDivElement | null>(null);
  const DRAG_THRESHOLD = 160; // px to reveal

  // ---- actions ----
  const startRoll = async () => {
    if (!choice) return alert("Chọn TÀI hoặc XỈU trước khi lắc.");
    if (betAmount <= 0) return alert("Nhập số tiền cược hợp lệ (>0).");
    if (betAmount > balance) return alert("Số dư không đủ — nạp thêm hoặc giảm cược.");

    // Begin roll: bowl covers, waiting state
    setRolling(true);
    setBowlOpen(false);
    setWaitingToOpen(false);

    const curNonce = nonce + 1;
    setNonce(curNonce);

    // derive dice deterministically
    const { dice, hashBase } = await deriveDiceFromSeeds(serverSeed, clientSeed, curNonce);

    // set dice now but keep bowl covering
    setLastDice(dice);
    setLastHashBase(hashBase);

    // simulate bowl drop + shaking
    setTimeout(() => {
      setWaitingToOpen(true); // now player can drag to open
      setRolling(false);
    }, 1200);
  };

  const openBowl = () => {
    if (!waitingToOpen) return;
    // for non-drag fallback: open when user clicks button
    setBowlOpen(true);
    setWaitingToOpen(false);

    // compute result & apply balance changes
    const sum = lastDice.reduce((a, b) => a + b, 0);
    const res: "tai" | "xiu" = sum >= 11 && sum <= 17 ? "tai" : "xiu";
    const win = choice === res;

    const delta = win ? Math.round(betAmount * payoutMultiplier) : -betAmount;
    setBalance((prev) => prev + delta);

    setHistory((h) => [
      { dice: lastDice, sum, result: res, win, bet: betAmount, time: new Date().toISOString() },
      ...h.slice(0, 19),
    ]);

    // rotate server seed after revealing to preserve fairness
    setServerSeed(Math.random().toString(36).slice(2));
  };

  // settings actions
  const tryUnlockSettings = () => {
    // Trim để tránh lỗi space
    if (settingPw.trim() === "123456789") {
      setSettingUnlocked(true);
    } else {
      alert("Mật khẩu sai.");
    }
  };

  const doDeposit = () => {
    if (depositValue <= 0) return alert("Nhập số tiền nạp lớn hơn 0.");
    setBalance((b) => b + depositValue);
    setDepositValue(0);
    setSettingUnlocked(false);
    setShowSettings(false);
    setSettingPw("");
  };

  const doReset = () => {
    if (!confirm("Xác nhận reset: số dư về 0 và xóa lịch sử?")) return;
    setBalance(0);
    setHistory([]);
    setSettingUnlocked(false);
    setShowSettings(false);
    setSettingPw("");
    // rotate serverSeed & reset nonce
    setServerSeed(Math.random().toString(36).slice(2));
    setNonce(0);
  };

  const quickBets = [10, 50, 100, 500, 1000];

  // handle drag end from framer motion
  const handleDragEnd = (_: any, info: { offset: { x: number; y: number } }) => {
    if (!waitingToOpen) return;
    const moved = info.offset.x;
    // if dragged sufficiently right -> open
    if (moved > DRAG_THRESHOLD) {
      // animate open
      setBowlOpen(true);
      setWaitingToOpen(false);

      // compute result & apply balance changes
      const sum = lastDice.reduce((a, b) => a + b, 0);
      const res: "tai" | "xiu" = sum >= 11 && sum <= 17 ? "tai" : "xiu";
      const win = choice === res;
      const delta = win ? Math.round(betAmount * payoutMultiplier) : -betAmount;
      setBalance((prev) => prev + delta);
      setHistory((h) => [
        { dice: lastDice, sum, result: res, win, bet: betAmount, time: new Date().toISOString() },
        ...h.slice(0, 19),
      ]);
      setServerSeed(Math.random().toString(36).slice(2));
    } else {
      // snap back: do nothing (bowl stays covering)
    }
  };

  // small UI helpers
  const isLandscape = true; // we assume wide layout

  return (
    <>
      {/* Background layer (fixed) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="w-full h-full bg-gradient-to-r from-[#021218] via-[#05202a] to-[#02121a] opacity-95" />
      </div>

      {/* Main UI (on top) */}
      <div className="w-full max-w-full md:max-w-7xl p-4 md:p-6">

      <div className="w-full max-w-full min-h-[78vh] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-3xl p-4
  grid grid-cols-1 md:grid-cols-12 gap-4
  overflow-hidden h-auto md:h-[78vh]">


          {/* Left: main table (8 cols) */}
          {/* Left: main table */}
<div className="col-span-1 md:col-span-8 flex flex-col gap-4">

            {/* top bar: balance + seeds */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-300">SỐ DƯ</div>
                <div className="text-2xl font-bold text-amber-300">{fmt(balance)} ₫</div>
              </div>

              <div className="text-right text-xs text-slate-400 max-w-[360px]">
                {/* <div>ServerSeedHash:</div>
                <div className="font-mono text-[11px] break-words">{serverSeedHash || "..."}</div> */}
              </div>
            </div>

            {/* table area */}
            <div className="flex-1 bg-[linear-gradient(180deg,#06202b,rgba(255,255,255,0.01))] rounded-2xl p-6 flex items-center justify-center relative">
              {/* left area: labels Tài / Xỉu (visual) */}
              {/* <div className="absolute left-6 top-8 text-sm text-slate-300 select-none">TÀI (11–17)</div>
              <div className="absolute right-6 top-8 text-sm text-slate-300 select-none">XỈU (4–10)</div> */}

              {/* dice cluster container */}
              <div className="w-full flex items-center justify-center">
                <div className="relative w-full max-w-full sm:max-w-[640px] h-[220px] sm:h-[320px] flex items-center justify-center">

                  {/* total display (visible when opened) */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 min-h-[42px]">
                    {bowlOpen && (
                      <div className={`px-4 py-2 rounded-full text-xl font-bold ${lastResult === "tai" ? "text-emerald-300" : "text-rose-300"}`}>
                        {`${lastResult?.toUpperCase() || ""} – ${sumDisplay}`}
                      </div>
                    )}
                  </div>

                  {/* dice row under bowl */}
                  <motion.div
                    className="flex gap-6 z-10"
                    animate={rolling ? { rotate: [0, 360] } : { rotate: 0 }}
                    transition={{ duration: rolling ? 0.9 : 0.6, repeat: rolling ? Infinity : 0 }}
                  >
                    {lastDice.map((d, i) => (
                      <div key={i} className="flex items-center justify-center">
                        <DiceSVG value={d} />
                        
                      </div>
                    ))}
                  </motion.div>
                  </div>

                 {/* bowl overlay: big to cover dice; draggable when waitingToOpen */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
  <AnimatePresence>
    {!bowlOpen && (
      <motion.div
        key="bowl"
        ref={bowlRef}
        drag={waitingToOpen ? "x" : false}
        dragConstraints={{ left: 0, right: 800 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        initial={{ x: 0, y: -8, scale: 1 }}
        animate={waitingToOpen ? { x: 0 } : { x: 0 }}
        exit={{ x: "140%" }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
        className="pointer-events-auto z-30 w-[150%] h-[260px] rounded-full flex items-center justify-center"
      >
        {/*  Ảnh bát che xúc xắc */}
        <div
          key={Date.now()}
          className="absolute inset-0 pointer-events-auto z-30 rounded-full flex items-center justify-center"
          style={{
            backgroundImage: "url('/bat.jpg?v=" + Date.now() + "')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "3px solid rgba(255,255,255,0.08)",
            boxShadow: "inset 0 -40px 80px rgba(0,0,0,0.6)",
            transform: "rotateX(45deg)",
transformOrigin: "center",

          }}
        >
          <div className="text-slate-300 text-sm select-none bg-black/40 px-3 py-1 rounded">
            {rolling ? "Đang lắc..." : waitingToOpen ? "Kéo để mở bát →" : "Úp bát"}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>


                {/* bet input */}
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="number"
                    min={1}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="w-28 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]"
                  />
                  <div className="flex gap-2">
                    {quickBets.map((b) => (
                      <button key={b} onClick={() => setBetAmount(b)} className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.01)] border">
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Roll / Open buttons */}
                <button
                  onClick={startRoll}
                  disabled={rolling || waitingToOpen}
                  className="px-5 py-3 rounded-2xl font-bold bg-amber-400 text-black shadow disabled:opacity-60"
                >
                  {rolling ? "Đang lắc..." : "Lắc xúc xắc"}
                </button>

                <button
                  onClick={openBowl}
                  disabled={!waitingToOpen}
                  className="px-5 py-3 rounded-2xl font-bold bg-emerald-500 text-black shadow disabled:opacity-50"
                >
                  Mở bát
                </button>
              </div>
            </div>
          </div>

          {/* Right column: settings + history (4 cols) */}
          {/* Right column: settings + history */}
<div className="col-span-1 md:col-span-4 flex flex-col gap-4">

            <div className="rounded-2xl p-4 bg-[rgba(255,255,255,0.02)] border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Nhà cái đến từ Châu Á</div>
                  <div className="font-mono text-sm text-slate-200 break-words">{clientSeed}</div>
                </div>
                <div>
                  <button
                    onClick={() => {
                      // LOG ĐỂ DEBUG (bạn có thể xóa khi đã ok)
                      console.log("Open Setting clicked");
                      setShowSettings(true);
                      setSettingPw("");
                      setSettingUnlocked(false);
                    }}
                    className="px-3 py-2 rounded-lg border bg-[rgba(255,255,255,0.01)]"
                  >
                    ⚙️ Setting
                  </button>
                </div>
              </div>

              {/* <div className="text-xs text-slate-400">Last hash</div> */}
              {/* <div className="font-mono text-xs break-words text-slate-300">{lastHashBase || "–"}</div> */}
            </div>

            <div className="rounded-2xl p-4 flex-1 flex flex-col history-thin-bg">


              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Lịch sử ({history.length})</div>
                <button
                  onClick={() => {
                    if (confirm("Xóa lịch sử?")) setHistory([]);
                  }}
                  className="text-xs px-2 py-1 rounded border bg-[rgba(255,255,255,0.01)]"
                >
                  Xóa
              </button>
</div>

<div className="flex-1 overflow-auto max-h-[38vh] space-y-2 text-sm">
  {history.length === 0 && (
    <div className="text-slate-400">Chưa có ván nào.</div>
  )}
  {history.map((h, idx) => (
    <div
      key={idx}
      className="flex items-center justify-between bg-[rgba(255,255,255,0.01)] p-2 rounded"
    >
      <div>
        <div className="font-mono text-xs text-slate-300">
          {new Date(h.time).toLocaleString()}
        </div>
        <div className="text-sm text-slate-100">
          {h.dice.join(" · ")} → {h.result?.toUpperCase() || ""}
        </div> {/* ✅ thêm dấu đóng div này */}
      </div>
      <div
        className={`text-sm font-semibold ${
          h.win ? "text-emerald-300" : "text-rose-400"
        }`}
      >
        {h.win
          ? `+${fmt(Math.round(h.bet * payoutMultiplier))}`
          : `-${fmt(h.bet)}`}
      </div>
    </div>
  ))} {/* ✅ đóng ngoặc map */}
</div>
</div>


            <div className="rounded-2xl p-4 bg-[rgba(255,255,255,0.02)] border text-xs text-slate-400">
              <div>Chú ý:</div>
              <ul className="list-disc pl-4 mt-2">
                <li>Win trả: cược × {payoutMultiplier.toFixed(2)} (nhà cái giữ 2%).</li>
                <li>Xỉu(4-10) Tài(11-17).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <SettingsModal
        show={showSettings}
        settingPw={settingPw}
        setSettingPw={setSettingPw}
        tryUnlockSettings={tryUnlockSettings}
        settingUnlocked={settingUnlocked}
        setSettingUnlocked={setSettingUnlocked}
        setShowSettings={setShowSettings}
        depositValue={depositValue}
        setDepositValue={setDepositValue}
        doDeposit={doDeposit}
        doReset={doReset}
  />
  </>
);}
