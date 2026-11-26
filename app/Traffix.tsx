"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { DEFAULT_BRANDS } from "@/lib/brands";
import { rankBrands, type Game } from "@/lib/rank";
import { loadProfile, saveProfile, type Item, type Profile } from "@/lib/storage";

type Row = Item & { id: string };

let seq = 0;
const withId = (it: Item): Row => ({ ...it, id: "r" + ++seq });

// long press + drag tuning
const LONG_MS = 380, SLOP = 8, EDGE = 70;

type Drag = {
  id: string; pid: number; src: HTMLElement;
  x0: number; ys: number; cx: number; cy: number;
  active: boolean; timer?: number; raf?: number; y0: number; origOffset: number;
};

const label = (it: Item) => `${it.name}, ${it.n}. Apasă pentru +1`;

const when = (t: number) =>
  new Date(t).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const sumOf = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
const byCount = (counts: Record<string, number>) => Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

function bump(el: Element | null | undefined) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.18)", offset: 0.4 }, { transform: "scale(1)" }],
    { duration: 220, easing: "ease-out" },
  );
}

export default function Traffix() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [view, setView] = useState<"game" | "history">("game");
  const [gameName, setGameName] = useState("");
  const [nameError, setNameError] = useState("");
  const [notice, setNotice] = useState("");
  const [armedDel, setArmedDel] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [armed, setArmed] = useState(false);
  const [pressingId, setPressingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const armTimer = useRef<number | undefined>(undefined);
  const focusEditId = useRef<string | null>(null);
  const profile = useRef<Profile | null>(null);
  const saveDlg = useRef<HTMLDialogElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const p = loadProfile();
    profile.current = p;
    setItems(p.rows.map(withId));
    setGames(p.games);
  }, []);

  useEffect(() => {
    if (items && profile.current) saveProfile({ ...profile.current, rows: items, games });
  }, [items, games]);

  useLayoutEffect(() => {
    if (!focusEditId.current) return;
    document.getElementById("edit-" + focusEditId.current)?.focus();
    focusEditId.current = null;
  }, [items]);

  /* ---- long press to drag ---- */
  function onDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (editing || drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = {
      id, pid: e.pointerId, src: e.currentTarget,
      x0: e.clientX, ys: e.clientY, cx: e.clientX, cy: e.clientY,
      active: false, y0: 0, origOffset: 0,
    };
    setPressingId(id);
    drag.current.timer = window.setTimeout(startDrag, LONG_MS);
  }

  function cancelPress() {
    if (!drag.current) return;
    clearTimeout(drag.current.timer);
    drag.current = null;
    setPressingId(null);
  }

  function startDrag() {
    const d = drag.current;
    const li = d && rowEls.current.get(d.id);
    if (!d || !li) return;
    d.active = true;
    setPressingId(null);
    setDragId(d.id);
    d.y0 = d.cy + window.scrollY;
    d.origOffset = li.offsetTop;
    try { d.src.setPointerCapture(d.pid); } catch {}
    try { navigator.vibrate?.(15); } catch {}
    const tick = () => {
      const cur = drag.current;
      if (!cur?.active) return;
      let v = 0;
      if (cur.cy < EDGE) v = -(EDGE - cur.cy) / 4;
      else if (cur.cy > window.innerHeight - EDGE) v = (cur.cy - (window.innerHeight - EDGE)) / 4;
      if (v) { window.scrollBy(0, v); updateDrag(); }
      cur.raf = requestAnimationFrame(tick);
    };
    d.raf = requestAnimationFrame(tick);
  }

  // Swap with a neighbour while the pointer is past its midpoint; flushSync keeps
  // the DOM in step so the next rect read and the transform are exact.
  function move(id: string, delta: number) {
    flushSync(() =>
      setItems((prev) => {
        if (!prev) return prev;
        const i = prev.findIndex((r) => r.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = prev.slice();
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    );
  }

  function updateDrag() {
    const d = drag.current;
    const li = d && rowEls.current.get(d.id);
    if (!d || !li) return;
    for (let guard = 0; guard < 200; guard++) {
      const prev = li.previousElementSibling as HTMLElement | null;
      if (prev) {
        const r = prev.getBoundingClientRect();
        if (d.cy < r.top + r.height / 2) { move(d.id, -1); continue; }
      }
      const next = li.nextElementSibling as HTMLElement | null;
      if (next && !next.classList.contains("new")) {
        const r = next.getBoundingClientRect();
        if (d.cy > r.top + r.height / 2) { move(d.id, 1); continue; }
      }
      break;
    }
    const dy = d.cy + window.scrollY - d.y0 - (li.offsetTop - d.origOffset);
    li.style.transform = `translateY(${dy}px)`;
  }

  function endDrag(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.active) { cancelPress(); return; }
    cancelAnimationFrame(d.raf!);
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 400);
    const li = rowEls.current.get(d.id);
    if (li) li.style.transform = "";
    drag.current = null;
    setDragId(null);
  }

  // Document-level listeners read only refs and stable setters, so binding once is safe.
  const handlers = useRef({ updateDrag, cancelPress, endDrag });
  handlers.current = { updateDrag, cancelPress, endDrag };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pid) return;
      d.cx = e.clientX; d.cy = e.clientY;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.ys) > SLOP) handlers.current.cancelPress();
        return;
      }
      handlers.current.updateDrag();
    };
    const onUp = (e: PointerEvent) => handlers.current.endDrag(e);
    const onTouch = (e: TouchEvent) => { if (drag.current?.active) e.preventDefault(); };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("touchmove", onTouch);
    };
  }, []);

  /* ---- actions ---- */
  function change(id: string, d: number, countEl?: Element | null) {
    setItems((prev) => prev && prev.map((r) => (r.id === id ? { ...r, n: Math.max(0, r.n + d) } : r)));
    if (d > 0) bump(countEl);
  }

  function rename(id: string, name: string) {
    setItems((prev) => prev && prev.map((r) => (r.id === id ? { ...r, name } : r)));
  }

  function insertAfter(i: number) {
    const row = withId({ name: "", n: 0 });
    focusEditId.current = row.id;
    setItems((prev) => prev && [...prev.slice(0, i + 1), row, ...prev.slice(i + 1)]);
  }

  function toggleEdit() {
    if (editing) {
      setItems((prev) => prev && prev.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim() })));
    }
    setEditing(!editing);
  }

  function addBrand() {
    const v = draft.trim();
    if (!v) return;
    setItems((prev) => prev && [...prev, withId({ name: v, n: 0 })]);
    setDraft("");
  }

  function reset() {
    clearTimeout(armTimer.current);
    if (armed) {
      setItems((prev) => prev && prev.map((r) => ({ ...r, n: 0 })));
      setArmed(false);
    } else {
      setArmed(true);
      armTimer.current = window.setTimeout(() => setArmed(false), 3000);
    }
  }

  /* ---- saved games ---- */
  const nameTaken = (name: string) => games.some((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase());

  // Default name, made unique if a game was already saved in the same minute.
  function defaultName() {
    const base = "Traffix " + when(Date.now());
    let name = base;
    for (let i = 2; nameTaken(name); i++) name = `${base} (${i})`;
    return name;
  }

  function openSave() {
    setGameName(defaultName());
    setNameError("");
    saveDlg.current?.showModal();
  }

  function saveGame(e: FormEvent) {
    e.preventDefault();
    if (!items) return;
    const name = gameName.trim() || defaultName();
    if (nameTaken(name)) {
      setNameError("Ai deja un joc cu numele ăsta. Alege alt nume.");
      document.getElementById("game-name")?.focus();
      return;
    }
    const rows = items.filter((r) => r.name.trim());
    const game: Game = {
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      counts: Object.fromEntries(rows.map((r) => [r.name.trim(), r.n])),
    };
    const next = [...games, game];
    setGames(next);
    // New game: same brand list, zeroed, ordered by what this user has seen most so far.
    setItems(rankBrands(rows.map((r) => r.name.trim()), next, DEFAULT_BRANDS).map((name) => withId({ name, n: 0 })));
    saveDlg.current?.close();
    window.scrollTo({ top: 0 });
    clearTimeout(noticeTimer.current);
    setNotice(`Am salvat „${game.name}”. Joc nou pornit, cu mărcile văzute cel mai des sus.`);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 5000);
  }

  function deleteGame(id: string) {
    clearTimeout(armTimer.current);
    if (armedDel === id) {
      setGames((prev) => prev.filter((g) => g.id !== id));
      setArmedDel(null);
    } else {
      setArmedDel(id);
      armTimer.current = window.setTimeout(() => setArmedDel(null), 3000);
    }
  }

  const total = items?.reduce((s, it) => s + it.n, 0) ?? 0;

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>Traffix</h1>
          <p className="sub">Apasă pe o marcă: +1. Ține apăsat și trage ca s-o muți. Scrie jos și dă Enter pentru marcă nouă.</p>
        </div>
        <div className="head-actions">
          <div className="total" aria-label="Total mașini numărate">
            <span className="eu">RO</span>
            <span className="val">{total}</span>
          </div>
          {view === "game" && (
            <button className="btn primary" type="button" onClick={openSave} disabled={editing || total === 0}>
              Salvează jocul
            </button>
          )}
        </div>
      </header>

      <p className="notice" role="status" aria-live="polite">{notice}</p>

      {view === "history" ? (
        <section className="history" aria-labelledby="history-title">
          <div className="toolbar">
            <button className="btn" type="button" onClick={() => setView("game")}>Înapoi la joc</button>
          </div>
          <h2 id="history-title">Jocuri salvate</h2>
          {games.length === 0 ? (
            <p className="empty">Niciun joc salvat încă. Când termini de numărat, apasă „Salvează jocul” sus.</p>
          ) : (
            <ol className="games">
              {[...games].reverse().map((g) => {
                const ranked = byCount(g.counts);
                return (
                  <li key={g.id}>
                    <details>
                      <summary>
                        <span className="g-name">{g.name}</span>
                        <span className="g-meta">
                          {when(g.savedAt)} · {sumOf(g.counts)} mașini
                        </span>
                        {ranked.length > 0 && (
                          <span className="g-top">{ranked.slice(0, 3).map(([b, n]) => `${b} ${n}`).join(" · ")}</span>
                        )}
                      </summary>
                      {ranked.length > 0 ? (
                        <ol className="g-counts">
                          {ranked.map(([b, n]) => (
                            <li key={b}><span>{b}</span><span className="num">{n}</span></li>
                          ))}
                        </ol>
                      ) : (
                        <p className="empty">Nicio mașină numărată în jocul ăsta.</p>
                      )}
                      <button
                        className={"btn warn" + (armedDel === g.id ? " armed" : "")}
                        type="button"
                        onClick={() => deleteGame(g.id)}
                      >
                        {armedDel === g.id ? "Sigur? Apasă din nou" : "Șterge jocul"}
                      </button>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : (
      <>
      <div className="toolbar">
        <button className="btn" type="button" aria-pressed={editing} onClick={toggleEdit}>
          {editing ? "Gata" : "Editează lista"}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setItems((prev) => prev && [...prev].sort((a, b) => b.n - a.n))}
        >
          Sortează după număr
        </button>
        <button className={"btn warn" + (armed ? " armed" : "")} type="button" onClick={reset}>
          {armed ? "Sigur? Apasă din nou" : "Resetează numerele"}
        </button>
        <button className="btn" type="button" onClick={() => setView("history")} disabled={editing}>
          Istoric{games.length > 0 ? ` (${games.length})` : ""}
        </button>
      </div>

      {items && (
        <ol
          className={"list" + (dragId ? " sorting" : "")}
          onContextMenu={(e) => {
            if (!editing && (e.target as Element).closest(".row:not(.new)")) e.preventDefault();
          }}
        >
          {items.map((it, i) => (
            <li
              key={it.id}
              data-id={it.id}
              ref={(el) => {
                if (el) rowEls.current.set(it.id, el);
                else rowEls.current.delete(it.id);
              }}
              className={"row" + (pressingId === it.id ? " pressing" : "") + (dragId === it.id ? " dragging" : "")}
            >
              {editing ? (
                <>
                  <input
                    className="edit-name"
                    id={"edit-" + it.id}
                    value={it.name}
                    aria-label={"Nume marcă " + (i + 1)}
                    onChange={(e) => rename(it.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); insertAfter(i); }
                    }}
                  />
                  <button
                    className="del"
                    type="button"
                    aria-label={"Șterge " + it.name}
                    onClick={() => setItems((prev) => prev && prev.filter((r) => r.id !== it.id))}
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="hit"
                    type="button"
                    aria-label={label(it)}
                    onPointerDown={(e) => onDown(e, it.id)}
                    onClick={(e) => {
                      if (suppressClick.current) { suppressClick.current = false; return; }
                      change(it.id, 1, e.currentTarget.parentElement?.querySelector(".count"));
                    }}
                  >
                    <span className="idx">{i + 1}</span>
                    <span className="name">{it.name || "(fără nume)"}</span>
                  </button>
                  <button
                    className="minus"
                    type="button"
                    disabled={it.n === 0}
                    aria-label={"Scade " + it.name}
                    onClick={() => change(it.id, -1)}
                  >
                    −
                  </button>
                  <span className={"count" + (it.n > 0 ? " on" : "")}>{it.n}</span>
                </>
              )}
            </li>
          ))}

          <li className="row new">
            <span className="idx">{items.length + 1}</span>
            <input
              type="text"
              autoComplete="off"
              placeholder="Scrie o marcă nouă…"
              aria-label="Marcă nouă"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addBrand(); }
              }}
            />
            <span className="enter-hint">Enter</span>
          </li>
        </ol>
      )}

      </>
      )}

      <p className="foot">Lista ta, numerele și jocurile salvate rămân în browserul tău. „−” scade cu 1 dacă ai apăsat greșit.</p>

      <dialog ref={saveDlg} className="dlg" aria-labelledby="save-title">
        <form onSubmit={saveGame}>
          <h2 id="save-title">Salvează jocul</h2>
          <p className="dlg-sub">{total} mașini numărate. După salvare pornește un joc nou, de la 0.</p>
          <label htmlFor="game-name">Numele jocului</label>
          <input
            id="game-name"
            name="game-name"
            type="text"
            autoComplete="off"
            maxLength={80}
            value={gameName}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "game-name-err" : undefined}
            onChange={(e) => { setGameName(e.target.value); setNameError(""); }}
          />
          {nameError && <p id="game-name-err" className="field-err" role="alert">{nameError}</p>}
          <div className="dlg-actions">
            <button className="btn" type="button" onClick={() => saveDlg.current?.close()}>Anulează</button>
            <button className="btn primary" type="submit">Salvează</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
