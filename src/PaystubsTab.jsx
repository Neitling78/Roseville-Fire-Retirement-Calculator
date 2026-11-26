import { useState, useRef } from "react";
import { readPdfText, parseStub, analyzeStubs, MIN_MONTHS, MAX_MONTHS } from "./paystubs.js";

// The Paystubs tab. Everything here runs in the member's browser: files are read with a
// bundled copy of pdf.js and never uploaded. Only the summary (dates and dollar totals,
// no names, no addresses, no account numbers) is kept, on this device, so the figures
// survive a page reload. "Remove my paystub data" deletes it.

const fmt2 = (n) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usDate = (iso) => iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}/${iso.slice(0, 4)}` : "";

export default function PaystubsTab({
  summary, onSummary, usePaystubs, onUsePaystubs, ceasing,
  paystubComp, modelFinalComp, memberType, retirementYear, pensionCompare, onGoTo,
  COLORS, styles, isMobile,
}) {
  const [busy, setBusy] = useState(null);          // { done, total }
  const [drag, setDrag] = useState(false);
  const [readError, setReadError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = [...fileList].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    setReadError(null);
    if (!files.length) { setReadError("Those files aren't PDFs. Add the paystub PDFs you downloaded from the City."); return; }
    setBusy({ done: 0, total: files.length });
    const stubs = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const pages = await readPdfText(await files[i].arrayBuffer());
        stubs.push({ ...parseStub(pages), fileName: files[i].name });
      } catch {
        stubs.push({ ok: false, fileName: files[i].name });
      }
      setBusy({ done: i + 1, total: files.length });
    }
    setBusy(null);
    const result = analyzeStubs(stubs, { ceasing });
    onSummary({ ...result, readOn: new Date().toISOString().slice(0, 10) });
    if (!result.ok) onUsePaystubs(false);
  };

  const box = (tone) => ({
    background: tone === "bad" ? "rgba(179,38,30,0.08)" : tone === "warn" ? "rgba(180,120,20,0.10)" : "rgba(60,90,60,0.07)",
    border: `1px solid ${tone === "bad" ? "rgba(179,38,30,0.35)" : tone === "warn" ? "rgba(180,120,20,0.35)" : COLORS.borderSoft}`,
    borderRadius: "8px", padding: "10px 14px", fontSize: "13px", lineHeight: 1.5, marginBottom: "10px",
    color: tone === "bad" ? "#7d1a14" : COLORS.text,
  });
  const row = { display: "flex", justifyContent: "space-between", gap: "12px", padding: "6px 0", borderBottom: `1px solid ${COLORS.borderSoft}`, fontSize: "13px" };
  const kindLabel = { base: "Base pay — reported to CalPERS", special: "Special pay — reported to CalPERS", unknown: "Not on our list", not: "Not reported to CalPERS" };

  const s = summary;
  const last12 = s?.last12;
  const groups = s?.breakdown ? ["base", "special", "unknown", "not"].map((k) => ({ k, lines: s.breakdown.filter((b) => b.kind === k) })).filter((g) => g.lines.length) : [];

  return (
    <>
      <div className="rff-card" style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
        <p style={{ ...styles.cardTitle, marginBottom: "6px" }}>Paystubs · optional</p>
        <div style={{ fontSize: "14px", lineHeight: 1.6, color: COLORS.text }}>
          Add your City paystubs and the calculator uses the pensionable pay the City actually
          reported to CalPERS, not an estimate from your rank, step and incentives.
          Everything else on this site works the same with or without them.
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: COLORS.textMuted, marginTop: "8px" }}>
          <strong>What to add:</strong> your most recent paystubs, in a row — at least {MIN_MONTHS} months
          (about 26 stubs). Up to {MAX_MONTHS} months is used; anything older is ignored. PEPRA members:
          add the full {MAX_MONTHS} months if you have them, since your pension uses a 36-month average.
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: COLORS.textMuted, marginTop: "8px" }}>
          <strong>Where to get them:</strong> City employee self-service → Pay → Payslips. Open a stub,
          choose Payslip Preview, and download the PDF.
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: COLORS.textMuted, marginTop: "8px" }}>
          <strong>Privacy:</strong> your paystubs are read inside this browser and are never uploaded.
          Only the dollar totals and dates are kept on this device. No name, address or account number is kept.
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) handleFiles(e.dataTransfer.files); }}
          onClick={() => !busy && inputRef.current?.click()}
          style={{
            marginTop: "14px", border: `2px dashed ${drag ? COLORS.accent : COLORS.border}`, borderRadius: "10px",
            padding: isMobile ? "22px 12px" : "30px 20px", textAlign: "center", cursor: busy ? "wait" : "pointer",
            background: drag ? "rgba(179,23,42,0.05)" : "transparent",
          }}>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple style={{ display: "none" }}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          {busy ? (
            <div style={{ fontSize: "14px", color: COLORS.text }}>Reading paystub {busy.done} of {busy.total}…</div>
          ) : (
            <>
              <div style={{ fontSize: "15px", fontWeight: 700, color: COLORS.text }}>Drop your paystub PDFs here</div>
              <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "4px" }}>or click to choose them. Select them all at once.</div>
            </>
          )}
        </div>
        {readError && <div style={{ ...box("bad"), marginTop: "10px" }}>{readError}</div>}
      </div>

      {s && (
        <div className="rff-card" style={styles.card}>
          <p style={{ ...styles.cardTitle, marginBottom: "10px" }}>What your paystubs show</p>
          {s.errors?.map((e, i) => <div key={"e" + i} style={box("bad")}>✗ {e}</div>)}
          {s.warnings?.map((w, i) => <div key={"w" + i} style={box("warn")}>⚠ {w}</div>)}
          {s.notes?.map((n, i) => <div key={"n" + i} style={box()}>{n}</div>)}

          {s.ok && last12 && (
            <>
              <div style={{ ...box(), background: "rgba(40,110,60,0.08)" }}>
                ✓ {s.stubCount} paystubs, {usDate(s.coverageStart)} to {usDate(s.coverageEnd)} ({s.coverageMonths} months, none missing).
                {s.reconciledStubs === s.stubCount
                  ? " Every stub ties out to the penny with the PERS deduction the City took."
                  : ` ${s.reconciledStubs} of ${s.stubCount} stubs tie out to the penny; the rest are counted from what CalPERS was charged.`}
              </div>

              <div style={row}><span>Plan on your stubs</span><strong>{s.plan || "—"}{s.memberRate ? ` · you pay ${(s.memberRate * 100).toFixed(2)}%` : ""}</strong></div>
              <div style={row}><span>Hourly rate on your newest stub</span><strong>{fmt2(s.hourlyRate)} → {fmt0(s.baseMonthlyNow)}/mo base</strong></div>

              <p style={{ ...styles.cardTitle, margin: "18px 0 6px" }}>Last 12 months · {usDate(last12.start)} – {usDate(last12.end)}</p>
              <div style={row}><span>Base pay reported to CalPERS</span><strong>{fmt2(last12.base)}</strong></div>
              <div style={row}><span>Special pay reported to CalPERS</span><strong>{fmt2(last12.special)}</strong></div>
              <div style={{ ...row, fontSize: "14px" }}><span><strong>Pensionable pay</strong></span><strong style={{ color: COLORS.accent }}>{fmt2(last12.total)} · {fmt0(last12.monthly)}/mo</strong></div>
              <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.5, marginTop: "6px" }}>
                {last12.holiday > 0 && <>Holiday Buy Up ({fmt2(last12.holiday)} of the special pay) counts for CalPERS at
                  168 hours a year at most, at your hourly rate plus longevity. Hours carried over from a prior year and cashed
                  out later are not counted. </>}
                {last12.uniform > 0 && <>Uniform allowance is a flat $1,300 a year ($50 a check), so it is carried forward at that
                  amount, not grown with your pay. </>}
                The rest of your special pay ran at {(last12.specialRatio * 100).toFixed(1)}% of base pay. Going forward the
                calculator carries that percentage on your projected base pay{last12.holiday > 0 ? ", and adds holiday at 168 hours a year" : ""}.
                {last12.ceasing > 0 && <> {fmt0(last12.ceasing)} of it is pay the MOU ends on 1/9/2027; after that date it is
                  taken out ({(last12.specialRatioAfterCease * 100).toFixed(1)}% of base).</>}
              </div>

              {s.flsa && (
                <>
                  <p style={{ ...styles.cardTitle, margin: "18px 0 6px" }}>FLSA overtime reported to CalPERS</p>
                  <div style={row}><span>{s.flsa.line} · {s.flsa.stubsWithIt} of {s.flsa.stubs} stubs</span><strong>{fmt2(s.flsa.amount)}</strong></div>
                  <div style={row}><span>Base pay reported, same 12 months</span><strong>{fmt2(s.flsa.base)}</strong></div>
                  <div style={{ ...row, fontSize: "14px" }}><span><strong>FLSA pensionable rate</strong></span><strong style={{ color: COLORS.accent }}>{(s.flsa.pct * 100).toFixed(3)}% of base</strong></div>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.5, marginTop: "6px" }}>
                    Only the "Over 64 Hours" line is reported to CalPERS; the separate "FLSA Overtime" line is not.
                    With the paystub switch on, this rate replaces the calculator's estimate everywhere FLSA pensionable pay is used.
                  </div>
                </>
              )}

              <details style={{ marginTop: "14px" }}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 700, color: COLORS.text }}>Stub-by-stub tie-out to the penny</summary>
                <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.5, margin: "8px 0" }}>
                  For each stub: the pay lines × your {s.memberRate ? (s.memberRate * 100).toFixed(2) + "%" : ""} PERS rate, against the PERS deduction actually taken.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead><tr style={{ textAlign: "right", color: COLORS.textMuted }}>
                      <th style={{ textAlign: "left", padding: "4px" }}>Pay date</th><th style={{ padding: "4px" }}>Base lines</th><th style={{ padding: "4px" }}>PERS base</th>
                      <th style={{ padding: "4px" }}>Special lines</th><th style={{ padding: "4px" }}>PERS special</th><th style={{ padding: "4px" }}>FLSA 64</th><th style={{ padding: "4px" }}></th>
                    </tr></thead>
                    <tbody>{[...(s.tieOut || [])].reverse().map((t) => (
                      <tr key={t.checkDate + t.baseLines} style={{ textAlign: "right", borderTop: `1px solid ${COLORS.borderSoft}` }}>
                        <td style={{ textAlign: "left", padding: "4px" }}>{usDate(t.checkDate)}</td>
                        <td style={{ padding: "4px" }}>{fmt2(t.baseLines)}</td><td style={{ padding: "4px" }}>{fmt2(t.persNormal)}</td>
                        <td style={{ padding: "4px" }}>{fmt2(t.specialLines)}</td><td style={{ padding: "4px" }}>{fmt2(t.persSpecial)}</td>
                        <td style={{ padding: "4px" }}>{fmt2(t.flsa)}</td>
                        <td style={{ padding: "4px", color: t.ok ? COLORS.green : "#b3261e", fontWeight: 700 }}>{t.ok ? "✓" : "✗"}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              </details>

              <details style={{ marginTop: "14px" }}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 700, color: COLORS.text }}>Every pay line, last 12 months</summary>
                {groups.map((g) => (
                  <div key={g.k} style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: g.k === "not" ? COLORS.textDim : COLORS.textMuted }}>{kindLabel[g.k]}</div>
                    {g.lines.map((l) => (
                      <div key={l.label} style={{ ...row, color: g.k === "not" ? COLORS.textDim : COLORS.text }}>
                        <span>{l.label}</span><span>{fmt2(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.5, marginTop: "8px" }}>
                  Which lines count is read from your own stubs: the PERS contribution lines show what the City
                  reported, and the lines above add up to it. Overtime you volunteer for is never pensionable.
                </div>
              </details>

              {paystubComp && pensionCompare?.stubs && (() => {
                const P = pensionCompare, E = P.estimate, S = P.stubs;
                const diff = (a, b) => { const d = b - a; return (d >= 0 ? "+" : "−") + fmt0(Math.abs(d)); };
                const cell = { padding: "6px 4px", textAlign: "right", whiteSpace: "nowrap" };
                const lineRows = [
                  ["base", "Base pay"], ["longevity", "Longevity"], ["incentives", "Incentives & certificates"],
                  ["holiday", "Holiday (168 hrs a year)"], ["uniform", "Uniform allowance"], ["flsa", "FLSA scheduled overtime"],
                ];
                return (
                  <>
                    <p style={{ ...styles.cardTitle, margin: "22px 0 6px" }}>Your pension both ways · retiring {retirementYear}</p>
                    <div style={row}>
                      <span>CalPERS service credit at retirement <span style={{ color: COLORS.textDim, fontSize: "11px" }}>· from Member details</span></span>
                      <strong>{P.serviceYears.toFixed(3)} yrs</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: P.usingCalpersCredit ? COLORS.textMuted : "#8a5a00", lineHeight: 1.5, padding: "4px 0 6px" }}>
                      {P.serviceSource}.{" "}
                      {onGoTo && <button type="button" onClick={() => onGoTo("member")} style={{ background: "none", border: "none", padding: 0, color: COLORS.accent, cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>Change it on Member details</button>}
                    </div>
                    <div style={row}><span>Pension percentage {P.capped ? "(at the 90% cap)" : ""}</span><strong>{(P.pct * 100).toFixed(2)}%</strong></div>

                    <div style={{ overflowX: "auto", marginTop: "10px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead><tr style={{ color: COLORS.textMuted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                          <th style={{ ...cell, textAlign: "left" }}></th><th style={cell}>Switch off<br />estimate</th><th style={cell}>Switch on<br />paystubs</th><th style={cell}>Difference</th>
                        </tr></thead>
                        <tbody>
                          {S.lines && S.hasItems && lineRows.map(([k, label]) => (
                            <tr key={k} style={{ borderTop: `1px solid ${COLORS.borderSoft}` }}>
                              <td style={{ ...cell, textAlign: "left" }}>{label}</td>
                              <td style={cell}>{fmt0(E.lines[k])}</td><td style={cell}>{fmt0(S.lines[k])}</td>
                              <td style={{ ...cell, color: Math.abs(S.lines[k] - E.lines[k]) < 1 ? COLORS.textDim : COLORS.text, fontWeight: Math.abs(S.lines[k] - E.lines[k]) >= 25 ? 700 : 400 }}>{diff(E.lines[k], S.lines[k])}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
                            <td style={{ ...cell, textAlign: "left" }}><strong>Final compensation</strong><div style={{ fontSize: "10px", color: COLORS.textDim }}>{memberType === "classic" ? "12 months before you retire" : "36-month average"}</div></td>
                            <td style={cell}><strong>{fmt0(E.final)}</strong></td><td style={cell}><strong>{fmt0(S.final)}</strong></td><td style={cell}><strong>{diff(E.final, S.final)}</strong></td>
                          </tr>
                          <tr style={{ borderTop: `1px solid ${COLORS.borderSoft}` }}>
                            <td style={{ ...cell, textAlign: "left" }}><strong>Gross pension</strong><div style={{ fontSize: "10px", color: COLORS.textDim }}>unmodified, {(P.pct * 100).toFixed(2)}% × final comp</div></td>
                            <td style={cell}><strong>{fmt0(E.pension)}</strong></td><td style={{ ...cell, color: COLORS.accent }}><strong>{fmt0(S.pension)}</strong></td><td style={cell}><strong>{diff(E.pension, S.pension)}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.5, marginTop: "8px" }}>
                      The line rows are monthly pay at your {retirementYear} rates. The service credit and percentage are the same
                      on both sides, so any difference comes only from pay. A gap on one line usually means a setting on
                      Member details or Compensation (rank, step, incentives) doesn't match your stub.
                      {memberType !== "classic" && " PEPRA: final compensation averages 36 months, so it won't equal the sum of one year's lines."}
                      {paystubComp.actualShare > 0 && ` ${Math.round(paystubComp.actualShare * 100)}% of the paystub window is pay already on your stubs.`}
                      {" "}Estimates only — CalPERS calculates the real benefit.
                    </div>
                    {S.hasItems === false && (
                      <div style={{ ...box("warn"), marginTop: "8px" }}>Add your paystubs again to see the line-by-line split. These were read before it existed.</div>
                    )}
                    {S.incentiveItems && S.hasItems && (
                      <details style={{ marginTop: "10px" }}>
                        <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 700, color: COLORS.text }}>Incentives & certificates, item by item</summary>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px", marginTop: "8px" }}>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: COLORS.textMuted }}>Switch off · your settings</div>
                            {E.incentiveItems.length ? E.incentiveItems.map((i) => <div key={i.label} style={row}><span>{i.label}</span><span>{fmt0(i.monthly)}</span></div>)
                              : <div style={{ ...row, color: COLORS.textDim }}>None selected</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: COLORS.textMuted }}>Switch on · your stubs</div>
                            {S.incentiveItems.length ? S.incentiveItems.map((i) => <div key={i.label} style={row}><span>{i.label}</span><span>{fmt0(i.monthly)}</span></div>)
                              : <div style={{ ...row, color: COLORS.textDim }}>None on your stubs</div>}
                          </div>
                        </div>
                      </details>
                    )}
                    {paystubComp.holidayExcluded > 0.5 && (
                      <div style={{ ...row, color: COLORS.textMuted }}><span>Holiday pay on your stubs above 168 hrs a year, not counted</span><span>{fmt0(paystubComp.holidayExcluded)}/mo</span></div>
                    )}
                  </>
                );
              })()}

              <label style={{ ...styles.checkRow, marginTop: "16px", cursor: "pointer" }}>
                <input type="checkbox" style={styles.checkbox} checked={!!usePaystubs} onChange={(e) => onUsePaystubs(e.target.checked)} />
                <span style={{ ...styles.checkLabel, fontWeight: 700 }}>Use my paystubs for the pension figures</span>
              </label>
            </>
          )}

          <button onClick={() => { onSummary(null); onUsePaystubs(false); }}
            style={{ marginTop: "14px", background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, cursor: "pointer", fontSize: "12px", borderRadius: "8px", padding: "6px 14px" }}>
            Remove my paystub data
          </button>
        </div>
      )}
    </>
  );
}
