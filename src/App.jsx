import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
/* -------------------------
   Provably-fair helpers (kept)
   ------------------------- */
async function sha256Hex(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function deriveDiceFromSeeds(serverSeed, clientSeed, nonce) {
    const base = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = await sha256Hex(base);
    const dice = [];
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
function DiceSVG({ value, size = 84 }) {
    const dots = {
        1: [[1, 1]],
        2: [[0, 0], [2, 2]],
        3: [[0, 0], [1, 1], [2, 2]],
        4: [[0, 0], [0, 2], [2, 0], [2, 2]],
        5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
        6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
    };
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", className: "rounded-lg drop-shadow-2xl", children: [_jsx("rect", { x: "0", y: "0", width: "100", height: "100", rx: "14", fill: "#181E39", stroke: "#202531" }), dots[value].map(([r, c], i) => (_jsx("circle", { cx: (c + 0.9) * 25, cy: (r + 0.9) * 25, r: "7.5", fill: "#f9d852" }, i)))] }));
}
/* -------------------------
   Helper formatting
   ------------------------- */
const fmt = (n) => n.toLocaleString();
/* -------------------------
   Settings Modal Component (NEW)
   ------------------------- */
function SettingsModal({ show, settingPw, setSettingPw, tryUnlockSettings, settingUnlocked, setSettingUnlocked, setShowSettings, depositValue, setDepositValue, doDeposit, doReset, }) {
    if (!show)
        return null;
    return ReactDOM.createPortal(_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50", children: _jsx(motion.div, { initial: { y: -20 }, animate: { y: 0 }, exit: { y: 20 }, className: "w-[520px] bg-[#041720] border border-[rgba(255,255,255,0.04)] rounded-2xl p-6", children: !settingUnlocked ? (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("div", { className: "text-sm text-slate-300", children: "Nh\u1EADp m\u1EADt kh\u1EA9u \u0111\u1EC3 v\u00E0o Setting" }), _jsx("input", { type: "password", value: settingPw, onChange: (e) => setSettingPw(e.target.value), className: "px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border" }), _jsxs("div", { className: "flex gap-2 mt-2", children: [_jsx("button", { onClick: tryUnlockSettings, className: "px-4 py-2 rounded-lg bg-amber-400 text-black", children: "M\u1EDF" }), _jsx("button", { onClick: () => setShowSettings(false), className: "px-4 py-2 rounded-lg border", children: "H\u1EE7y" })] })] })) : (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("div", { className: "text-sm text-slate-200", children: "Setting (\u0111\u00E3 unlock)" }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "number", value: depositValue, onChange: (e) => setDepositValue(Number(e.target.value)), className: "px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border", placeholder: "S\u1ED1 ti\u1EC1n n\u1EA1p" }), _jsx("button", { onClick: doDeposit, className: "px-3 py-2 rounded-md bg-emerald-400 text-black", children: "N\u1EA1p" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: doReset, className: "px-3 py-2 rounded-md bg-rose-500 text-black", children: "Reset" }), _jsx("button", { onClick: () => { setSettingUnlocked(false); setShowSettings(false); setSettingPw(""); }, className: "px-3 py-2 rounded-md border", children: "\u0110\u00F3ng" })] })] })) }) }), document.body);
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
    const [balance, setBalance] = useState(() => {
        const raw = localStorage.getItem("tx_balance_v1");
        return raw ? Number(raw) : 0; // default 0
    });
    const [betAmount, setBetAmount] = useState(100);
    const [choice, setChoice] = useState(null);
    // provably-fair seeds
    const [serverSeed, setServerSeed] = useState(() => {
        const s = localStorage.getItem("tx_serverSeed_v1");
        return s || Math.random().toString(36).slice(2);
    });
    // const [serverSeedHash, setServerSeedHash] = useState<string>("");
    const [clientSeed, setClientSeed] = useState(() => {
        const s = localStorage.getItem("tx_clientSeed_v1");
        return s || "guest" + Math.floor(Math.random() * 100000);
    });
    const [nonce, setNonce] = useState(() => {
        const raw = localStorage.getItem("tx_nonce_v1");
        return raw ? Number(raw) : 0;
    });
    // roll / visible state
    const [lastDice, setLastDice] = useState([1, 1, 1]);
    const [lastHashBase, setLastHashBase] = useState("");
    const [rolling, setRolling] = useState(false);
    const [bowlOpen, setBowlOpen] = useState(false); // if bowl is open (revealed)
    const [waitingToOpen, setWaitingToOpen] = useState(false); // bowl is covering, waiting for player to open
    // history (safe version)
    const [history, setHistory] = useState(() => {
        const raw = localStorage.getItem("tx_history_v1");
        try {
            return raw ? JSON.parse(raw) : [];
        }
        catch {
            return [];
        }
    });
    // settings modal
    const [showSettings, setShowSettings] = useState(false);
    const [settingPw, setSettingPw] = useState("");
    const [settingUnlocked, setSettingUnlocked] = useState(false);
    const [depositValue, setDepositValue] = useState(0);
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
    const bowlRef = useRef(null);
    const DRAG_THRESHOLD = 160; // px to reveal
    // ---- actions ----
    const startRoll = async () => {
        if (!choice)
            return alert("Chọn TÀI hoặc XỈU trước khi lắc.");
        if (betAmount <= 0)
            return alert("Nhập số tiền cược hợp lệ (>0).");
        if (betAmount > balance)
            return alert("Số dư không đủ — nạp thêm hoặc giảm cược.");
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
        if (!waitingToOpen)
            return;
        // for non-drag fallback: open when user clicks button
        setBowlOpen(true);
        setWaitingToOpen(false);
        // compute result & apply balance changes
        const sum = lastDice.reduce((a, b) => a + b, 0);
        const res = sum >= 11 && sum <= 17 ? "tai" : "xiu";
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
        }
        else {
            alert("Mật khẩu sai.");
        }
    };
    const doDeposit = () => {
        if (depositValue <= 0)
            return alert("Nhập số tiền nạp lớn hơn 0.");
        setBalance((b) => b + depositValue);
        setDepositValue(0);
        setSettingUnlocked(false);
        setShowSettings(false);
        setSettingPw("");
    };
    const doReset = () => {
        if (!confirm("Xác nhận reset: số dư về 0 và xóa lịch sử?"))
            return;
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
    const handleDragEnd = (_, info) => {
        if (!waitingToOpen)
            return;
        const moved = info.offset.x;
        // if dragged sufficiently right -> open
        if (moved > DRAG_THRESHOLD) {
            // animate open
            setBowlOpen(true);
            setWaitingToOpen(false);
            // compute result & apply balance changes
            const sum = lastDice.reduce((a, b) => a + b, 0);
            const res = sum >= 11 && sum <= 17 ? "tai" : "xiu";
            const win = choice === res;
            const delta = win ? Math.round(betAmount * payoutMultiplier) : -betAmount;
            setBalance((prev) => prev + delta);
            setHistory((h) => [
                { dice: lastDice, sum, result: res, win, bet: betAmount, time: new Date().toISOString() },
                ...h.slice(0, 19),
            ]);
            setServerSeed(Math.random().toString(36).slice(2));
        }
        else {
            // snap back: do nothing (bowl stays covering)
        }
    };
    // small UI helpers
  const isLandscape = true; // we assume wide layout
return (
  <>
    <div className="fixed inset-0 z-0 pointer-events-none">
      <div className="w-full h-full bg-gradient-to-r from-[#021218] via-[#05202a] to-[#02121a] opacity-95" />
    </div>
    <div className="w-full max-w-full md:max-w-7xl p-4 md:p-6">
      <div className="w-full max-w-full md:max-w-7xl h-auto md:h-[78vh] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-3xl p-3 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
        {/* Game Board (Dice Bowl & Controls) */}
        <div className="col-span-1 md:col-span-8 flex flex-col gap-4">
          {/* Balance */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-300">SỐ DƯ</div>
              <div className="text-2xl font-bold text-amber-300">{fmt(balance)} ₫</div>
            </div>
            <div className="text-right text-xs text-slate-400 max-w-[360px]" />
          </div>
          {/* Dice Bowl + Dice */}
          <div className="flex-1 bg-[linear-gradient(180deg,#06202b,rgba(255,255,255,0.01))] rounded-2xl p-6 flex items-center justify-center relative">
            <div className="w-full flex items-center justify-center">
              <div className="relative w-full max-w-full sm:max-w-[640px] h-[220px] sm:h-[320px] flex items-center justify-center">
                {/* Kết quả - TAI/XIU */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 min-h-[42px]">
                  {bowlOpen && (
                    <div className={`px-4 py-2 rounded-full text-xl font-bold ${lastResult === "tai" ? "text-emerald-300" : "text-rose-300"}`}>
                      {`${lastResult?.toUpperCase() || ""} – ${sumDisplay}`}
                    </div>
                  )}
                </div>
                {/* Dice */}
                <motion.div
                  className="flex gap-6 z-10"
                  animate={rolling ? { rotate: [0, 360] } : { rotate: 0 }}
                  transition={{
                    duration: rolling ? 0.9 : 0.6,
                    repeat: rolling ? Infinity : 0
                  }}
                >
                  {lastDice.map((d, i) => (
                    <div key={i} className="flex items-center justify-center">
                      <DiceSVG value={d} />
                    </div>
                  ))}
                </motion.div>
                {/* Bowl overlay - Dùng ảnh bat.jpg */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <AnimatePresence>
                    {!bowlOpen && (
                      <motion.div
                        ref={bowlRef}
                        drag={waitingToOpen ? "x" : false}
                        dragConstraints={{ left: 0, right: 480 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        initial={{ x: 0, y: -8, scale: 1 }}
                        animate={waitingToOpen ? { x: 0 } : { x: 0 }}
                        exit={{ x: "140%" }}
                        transition={{ duration: 0.45, ease: "easeInOut" }}
                        className="pointer-events-auto z-30 w-full max-w-[620px] h-[260px] rounded-full flex items-center justify-center"
                      >
                        <div className="w-full h-full rounded-full flex items-center justify-center relative">
                          <img
                            src="1bat2.png"
                            alt="Bát úp"
                            className="w-full h-full object-contain rounded-full pointer-events-none"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-slate-300 text-sm select-none">
                              {rolling
                                ? "Đang lắc..."
                                : waitingToOpen
                                ? "Kéo để mở bát →"
                                : "Úp bát"}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
          {/* Bet Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setChoice("tai")}
                disabled={rolling || waitingToOpen}
                className={`px-4 py-2 rounded-xl font-semibold ${choice === "tai" ? "bg-amber-400 text-black" : "bg-[rgba(255,255,255,0.03)] border"}`}
              >
                Chọn TÀI
              </button>
              <button
                onClick={() => setChoice("xiu")}
                disabled={rolling || waitingToOpen}
                className={`px-4 py-2 rounded-xl font-semibold ${choice === "xiu" ? "bg-amber-400 text-black" : "bg-[rgba(255,255,255,0.03)] border"}`}
              >
                Chọn XỈU
              </button>
              <div className="flex items-center gap-2 ml-4">
                <input
                  type="number"
                  min={1}
                  value={betAmount}
                  onChange={e => setBetAmount(Number(e.target.value))}
                  className="w-28 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]"
                />
                <div className="flex gap-2">
                  {quickBets.map(b => (
                    <button
                      key={b}
                      onClick={() => setBetAmount(b)}
                      className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.01)] border"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
        {/* Sidebar: Client Seed, Settings, History, Note */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-4">
          {/* Client Seed & Setting Button */}
          <div className="rounded-2xl p-4 bg-[rgba(255,255,255,0.02)] border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Nhà cái đến từ Châu Á</div>
                <div className="font-mono text-sm text-slate-200 break-words">{clientSeed}</div>
              </div>
              <div>
                <button
                  onClick={() => {
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
          </div>
          {/* History */}
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
                <div key={idx} className="flex items-center justify-between bg-[rgba(255,255,255,0.01)] p-2 rounded">
                  <div>
                    <div className="font-mono text-xs text-slate-300">{new Date(h.time).toLocaleString()}</div>
                    <div className="text-sm text-slate-100">{h.dice.join(" · ")} → {h.result?.toUpperCase() || ""}</div>
                  </div>
                  <div className={`text-sm font-semibold ${h.win ? "text-emerald-300" : "text-rose-400"}`}>
                    {h.win
                      ? `+${fmt(Math.round(h.bet * payoutMultiplier))}`
                      : `-${fmt(h.bet)}`}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-4 bg-[rgba(255,255,255,0.02)] border text-xs text-slate-400">
              <div>Chú ý:</div>
              <ul className="list-disc pl-4 mt-2">
                <li>Win trả: cược × {payoutMultiplier.toFixed(2)} (nhà cái giữ 2%).</li>
                <li>Xỉu (tổng 4–10), Tài (tổng 11–17). 3 & 18 là trường hợp hòa, nhà cái ăn.</li>
              </ul>
            </div>
          </div>
        </div>
        {/* Modal Setting */}
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
      </div>
    </div>
  </>
);
}
