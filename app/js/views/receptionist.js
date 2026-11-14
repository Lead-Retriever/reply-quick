// ============================================================
// Receptionist workspace (PROTOTYPE)
// Calls are simulated with the "Simulate incoming call" button.
// In Phase 3 the ring comes from Twilio (Voice JS SDK + TaskRouter)
// and the same screen handles a real call.
// ============================================================
import * as S from '../store.js';
import { esc, toast, STATUS_LABEL, outcomePill } from '../ui.js';

const CALLERS = ['James Carter', 'Ana Morales', 'Unknown caller', 'Keisha Brown', 'Unknown caller', 'Luis Ortega', 'Megan Walsh'];
const DISPOSITIONS = ['Intake complete', 'Message taken', 'Transferred', 'Callback requested', 'Wrong number / spam'];

export function mount(root) {
  const user = S.currentUser();
  const agent = S.getAgent(user.agentId);
  if (!agent) { root.innerHTML = '<div class="main"><div class="card">No receptionist profile is linked to this login.</div></div>'; return; }

  // ---------- Local desk state ----------
  const desk = {
    phase: 'idle',        // idle | ringing | on_call | after_call
    queue: [],            // callers waiting while this agent is busy
    incoming: null,       // { firmId, phone, ringStart }
    call: null,           // active call details
    contextTab: 'script',
    auto: false,
  };
  let autoTimer = null;

  const firmsFor = () => agent.firmIds.map(S.getFirm).filter(Boolean);
  const activeFirm = () => desk.call ? S.getFirm(desk.call.firmId) : desk.incoming ? S.getFirm(desk.incoming.firmId) : null;
  const greet = (firm) => firm.greeting.replace(/\{agent\}/g, agent.name.split(' ')[0]);

  function lookupCaller(phone) {
    const prev = S.getCalls().filter(c => c.callerPhone === phone && c.callerName);
    return prev.length ? prev[0] : null;
  }

  // ---------- Call simulation ----------
  function newCaller() {
    const firms = firmsFor();
    const firm = firms[Math.floor(Math.random() * firms.length)];
    // 1 in 4 simulated calls is a returning caller, to show caller lookup.
    const past = S.getCalls(firm.id).filter(c => c.callerName);
    const returning = Math.random() < 0.25 && past.length;
    const phone = returning ? past[Math.floor(Math.random() * past.length)].callerPhone : '+1' + Math.floor(2000000000 + Math.random() * 7000000000);
    return { firmId: firm.id, phone, ringStart: Date.now(), queuedAt: Date.now() };
  }

  function simulateIncoming() {
    const c = newCaller();
    if (agent.status !== 'available' || desk.phase !== 'idle') {
      desk.queue.push(c);
      toast('Caller for ' + S.getFirm(c.firmId).name + ' is waiting in the queue');
      render(); return;
    }
    ring(c);
  }

  function ring(c) {
    c.ringStart = Date.now();
    desk.incoming = c; desk.phase = 'ringing'; desk.contextTab = 'script';
    S.setAgentStatus(agent.id, 'ringing');
    render();
  }

  function answer() {
    const inc = desk.incoming; if (!inc) return;
    const known = lookupCaller(inc.phone);
    desk.call = {
      id: 'call_' + Date.now(), firmId: inc.firmId, phone: inc.phone,
      waitSec: Math.round((Date.now() - inc.queuedAt) / 1000),
      startedAt: Date.now(), muted: false, held: false, transfer: null, transferLog: [],
      known,
      form: { callerName: known ? known.callerName : '', callback: S.fmtPhone(inc.phone), callerType: known ? 'Existing client' : 'New inquiry', reason: '', notes: '' },
      wrap: { outcome: 'Message taken', makeTask: false, due: '' },
    };
    desk.incoming = null; desk.phase = 'on_call';
    S.setAgentStatus(agent.id, 'on_call');
    render();
  }

  function endCall() {
    const c = desk.call; if (!c) return;
    c.endedAt = Date.now();
    if (c.transfer && c.transfer.state === 'accepted') c.wrap.outcome = 'Transferred';
    else if (c.form.callerType === 'New inquiry' && c.form.reason) c.wrap.outcome = 'Intake complete';
    desk.phase = 'after_call';
    S.setAgentStatus(agent.id, 'after_call');
    render();
  }

  function saveWrapUp() {
    const c = desk.call;
    const lastTransfer = c.transferLog[c.transferLog.length - 1] || null;
    const record = {
      id: c.id, firmId: c.firmId, callerName: c.form.callerName || 'Unknown caller', callerPhone: c.phone,
      callbackNumber: c.form.callback, startedAt: c.startedAt, waitSec: c.waitSec,
      durationSec: Math.round((c.endedAt - c.startedAt) / 1000), agent: agent.name, status: 'answered',
      callerType: c.form.callerType, reason: c.form.reason, notes: c.form.notes, outcome: c.wrap.outcome,
      transfer: lastTransfer ? { to: lastTransfer.to, type: lastTransfer.type, result: lastTransfer.result } : null,
      transferAttempts: c.transferLog,
    };
    S.logCall(record);
    if (c.wrap.makeTask || c.wrap.outcome === 'Callback requested') {
      S.addTask({ id: S.uid('task'), firmId: c.firmId, callId: c.id, title: 'Call back ' + record.callerName, detail: c.form.reason || c.form.notes, due: c.wrap.due ? new Date(c.wrap.due).getTime() : Date.now() + 86400000, done: false, createdAt: Date.now() });
    }
    toast('Call saved to ' + S.getFirm(c.firmId).name + "'s dashboard");
    desk.call = null; desk.phase = 'idle';
    S.setAgentStatus(agent.id, 'available');
    nextFromQueue();
    render();
  }

  function nextFromQueue() {
    if (agent.status === 'available' && desk.phase === 'idle' && desk.queue.length) ring(desk.queue.shift());
  }

  // ---------- Transfers ----------
  function startTransfer(contactId, type) {
    const firm = activeFirm(); const c = firm.directory.find(x => x.id === contactId);
    desk.call.transfer = { contactId, to: c.name, phone: c.phone, type, state: 'ringing', at: Date.now() };
    desk.call.held = true; // caller hears hold music while we ring the contact
    render();
  }
  function transferResult(ok) {
    const t = desk.call.transfer; if (!t) return;
    t.state = ok ? 'accepted' : 'failed';
    desk.call.transferLog.push({ to: t.to, type: t.type, result: t.state, at: Date.now() });
    if (!ok) desk.call.held = false; // caller comes back to the receptionist
    if (ok && t.type === 'blind') { endCall(); return; }
    render();
  }
  function completeWarm() { endCall(); }

  // ---------- Rendering ----------
  function topBar() {
    const mine = S.getCalls().filter(c => c.agent === agent.name && S.isToday(c.startedAt));
    const aht = mine.length ? mine.reduce((s, c) => s + c.durationSec, 0) / mine.length : 0;
    const locked = desk.phase !== 'idle';
    return `
    <div class="desk-bar">
      <div class="brand"><div class="brand-dot">RQ</div>ReplyQuick</div>
      <div><span class="status-dot st-${agent.status}"></span>
        <select id="statusSel" ${locked ? 'disabled' : ''} aria-label="Your status">
          ${['available', 'break', 'offline'].map(s => `<option value="${s}" ${agent.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
          ${locked ? `<option selected>${STATUS_LABEL[agent.status]}</option>` : ''}
        </select>
      </div>
      <div class="desk-stats">
        <div>Answered today<b>${mine.length}</b></div>
        <div>Avg handle<b>${S.fmtDur(aht)}</b></div>
        <div>In queue<b>${desk.queue.length}</b></div>
        <div>On shift<b>${agent.shiftStart ? S.fmtShift((Date.now() - agent.shiftStart) / 1000) : 'Off'}</b></div>
      </div>
      <div class="spacer"></div>
      <button class="btn ghost sm" data-do="simulate">Simulate incoming call</button>
      <label class="check small" style="color:#fff"><input type="checkbox" id="autoSim" ${desk.auto ? 'checked' : ''}/> Auto</label>
      <span class="small" style="opacity:.8">${esc(agent.name)}</span>
      <button class="btn ghost sm" data-action="logout">Log out</button>
    </div>`;
  }

  function mainPanel() {
    if (desk.phase === 'ringing') {
      const firm = activeFirm(); const known = lookupCaller(desk.incoming.phone);
      return `
      <div class="ring-card">
        <div class="pill info">Incoming call</div>
        <div class="ring-firm">${esc(firm.name)}</div>
        <div class="muted">${esc(firm.practice)} · Caller ${esc(S.fmtPhone(desk.incoming.phone))}${known ? ' · <b>Returning caller: ' + esc(known.callerName) + '</b>' : ''} · Waiting <span class="num" data-since="${desk.incoming.queuedAt}">0:00</span></div>
        <div class="greeting-box">"${esc(greet(firm))}"</div>
        <div class="btn-row"><button class="btn success lg" data-do="answer">Answer</button></div>
      </div>`;
    }
    if (desk.phase === 'on_call') {
      const firm = activeFirm(); const c = desk.call; const t = c.transfer;
      return `
      <div class="card">
        <div class="call-head">
          <div>
            <div class="small muted">ON CALL FOR</div>
            <div class="call-firm">${esc(firm.name)}</div>
            <div class="muted">${esc(S.fmtPhone(c.phone))}${c.known ? ' · Returning caller, last called ' + esc(S.fmtDay(c.known.startedAt)) + ' about: ' + esc(c.known.reason) : ''}</div>
          </div>
          <div style="text-align:right">
            <div class="timer" data-since="${c.startedAt}">0:00</div>
            ${c.held ? '<span class="pill warning">Caller on hold</span>' : c.muted ? '<span class="pill warning">Muted</span>' : '<span class="pill danger">Live</span>'}
          </div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn ${c.muted ? 'on' : ''}" data-do="mute">${c.muted ? 'Unmute' : 'Mute'}</button>
          <button class="btn ${c.held ? 'on' : ''}" data-do="hold" ${t && t.state === 'ringing' ? 'disabled' : ''}>${c.held ? 'Resume' : 'Hold'}</button>
          <button class="btn" data-do="tab" data-tab="directory">Transfer</button>
          <button class="btn danger" data-do="end">End call</button>
        </div>
        ${t ? transferBox(t) : ''}
      </div>
      <div class="card">
        <div class="card-head"><h3>Intake</h3><span class="small muted">Saved to ${esc(firm.name)} only</span></div>
        ${firm.instructions ? `<div class="greeting-box" style="font-size:13.5px;font-weight:400;margin-top:0">${esc(firm.instructions)}</div>` : ''}
        <div class="form-grid">
          <label class="field"><span>Caller name</span><input type="text" data-f="callerName" value="${esc(c.form.callerName)}" /></label>
          <label class="field"><span>Callback number</span><input type="tel" data-f="callback" value="${esc(c.form.callback)}" /></label>
          <label class="field"><span>Caller type</span><select data-f="callerType">${['New inquiry', 'Existing client', 'Other'].map(o => `<option ${c.form.callerType === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
          <label class="field"><span>Reason for calling</span><input type="text" data-f="reason" value="${esc(c.form.reason)}" /></label>
          <label class="field full"><span>Notes</span><textarea data-f="notes">${esc(c.form.notes)}</textarea></label>
        </div>
      </div>`;
    }
    if (desk.phase === 'after_call') {
      const firm = activeFirm(); const c = desk.call;
      return `
      <div class="card">
        <div class="card-head"><div><div class="small muted">AFTER-CALL WORK</div><h2>${esc(firm.name)}</h2></div><span class="pill warning">Wrap-up</span></div>
        <p class="muted" style="margin-top:0">${esc(c.form.callerName || 'Unknown caller')} · ${esc(c.form.callback)} · ${S.fmtDur((c.endedAt - c.startedAt) / 1000)}</p>
        <div class="form-grid">
          <label class="field"><span>Outcome</span><select data-w="outcome">${DISPOSITIONS.map(o => `<option ${c.wrap.outcome === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
          <label class="field"><span>Callback due (optional)</span><input type="datetime-local" data-w="due" value="${esc(c.wrap.due)}" /></label>
          <label class="check full"><input type="checkbox" data-w="makeTask" ${c.wrap.makeTask ? 'checked' : ''}/> Create a callback task for the firm</label>
          <label class="field full"><span>Final notes for the firm</span><textarea data-f="notes">${esc(c.form.notes)}</textarea></label>
        </div>
        <div class="btn-row" style="margin-top:16px"><button class="btn primary lg" data-do="save">Save and go available</button></div>
      </div>`;
    }
    // idle
    const mine = S.getCalls().filter(c => c.agent === agent.name).slice(0, 8);
    const msg = agent.status === 'available' ? ['Waiting for the next call', 'You are available. Calls for any of your assigned firms will ring here.']
      : agent.status === 'break' ? ['On break', 'Calls will not ring until you set yourself to Available.']
      : ['Offline', 'Set yourself to Available to start your shift.'];
    return `
      <div class="card idle"><div class="big">${msg[0]}</div><div class="muted">${msg[1]}</div>
        ${desk.queue.length && agent.status === 'available' ? '' : desk.queue.length ? `<p><span class="pill warning">${desk.queue.length} waiting in queue</span></p>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h3>Your recent calls</h3></div>
        ${mine.length ? mine.map(c => `<div class="list-item"><div><b>${esc(c.callerName)}</b> · ${esc(S.getFirm(c.firmId)?.name || '')}<div class="small muted">${esc(S.fmtDay(c.startedAt))} ${esc(S.fmtTime(c.startedAt))} · ${esc(c.reason)}</div></div>${outcomePill(c.outcome)}</div>`).join('') : '<div class="empty">No calls yet.</div>'}
      </div>`;
  }

  function transferBox(t) {
    if (t.state === 'ringing') return `
      <div class="transfer-state ringing"><b>${t.type === 'warm' ? 'Warm' : 'Blind'} transfer: ringing ${esc(t.to)}</b> (${esc(S.fmtPhone(t.phone))}). Caller is on hold.
        <div class="small muted" style="margin:6px 0">Prototype: pick what happens.</div>
        <div class="btn-row"><button class="btn success sm" data-do="tx-ok">${esc(t.to)} answered</button><button class="btn danger sm" data-do="tx-fail">No answer</button></div></div>`;
    if (t.state === 'failed') return `
      <div class="transfer-state failed"><b>${esc(t.to)} didn't answer.</b> The caller is back with you, off hold.
        <div class="small" style="margin-top:4px">Say: "I wasn't able to reach ${esc(t.to.split(' ')[0])} right now. Let me take down your details so they can call you right back."</div>
        <div class="btn-row" style="margin-top:8px"><button class="btn sm" data-do="tab" data-tab="directory">Try someone else</button><button class="btn sm" data-do="take-msg">Take a message</button></div></div>`;
    return `
      <div class="transfer-state accepted"><b>Connected with ${esc(t.to)}.</b> ${t.type === 'warm' ? 'Introduce the caller, then complete the transfer to drop off.' : ''}
        <div class="btn-row" style="margin-top:8px"><button class="btn success sm" data-do="tx-complete">Complete transfer</button></div></div>`;
  }

  function contextPanel() {
    const firm = activeFirm();
    if (!firm) {
      return `<div class="card"><div class="card-head"><h3>Your assigned firms</h3></div>
        ${firmsFor().map(f => `<div class="list-item"><div><b>${esc(f.name)}</b><div class="small muted">${esc(f.practice)} · ${esc(S.firmLocalTime(f))} local</div></div>${S.officeOpenNow(f) ? '<span class="pill success">Office open</span>' : '<span class="pill">Office closed</span>'}</div>`).join('')}
      </div>`;
    }
    const open = S.officeOpenNow(firm);
    const tabs = [['script', 'Greeting'], ['faqs', 'FAQs'], ['hours', 'Hours'], ['directory', 'Transfer directory']];
    let body = '';
    if (desk.contextTab === 'script') body = `<div class="greeting-box">"${esc(greet(firm))}"</div><div class="small muted">Instructions</div><p>${esc(firm.instructions || 'None')}</p><div class="small muted">Never give legal advice. If asked, say an attorney will need to answer that.</div>`;
    if (desk.contextTab === 'faqs') body = firm.faqs.length ? firm.faqs.map(f => `<div class="list-item" style="display:block"><b>${esc(f.q)}</b><div>${esc(f.a)}</div></div>`).join('') : '<div class="empty">No FAQs yet.</div>';
    if (desk.contextTab === 'hours') body = hoursTable(firm);
    if (desk.contextTab === 'directory') {
      const canTransfer = desk.phase === 'on_call' && !(desk.call.transfer && desk.call.transfer.state === 'ringing');
      body = (!open ? '<div class="transfer-state failed small" style="margin:0 0 10px">Office is closed. Only after-hours contacts can receive transfers.</div>' : '') +
        firm.directory.map(c => {
          const allowed = c.transfer && (open || c.afterHours);
          return `<div class="list-item"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.role)} · ${esc(S.fmtPhone(c.phone))}${c.afterHours ? ' · after hours OK' : ''}</div></div>
          ${allowed && canTransfer ? `<div class="btn-row"><button class="btn sm" data-do="tx" data-c="${c.id}" data-type="warm">Warm</button><button class="btn sm" data-do="tx" data-c="${c.id}" data-type="blind">Blind</button></div>` : allowed ? '' : '<span class="pill">Not available</span>'}</div>`;
        }).join('');
    }
    return `<div class="card">
      <div class="card-head"><div><h3>${esc(firm.name)}</h3><div class="small muted">${esc(S.firmLocalTime(firm))} local · ${esc(firm.address)}</div></div>${open ? '<span class="pill success">Office open</span>' : '<span class="pill">Office closed</span>'}</div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-do="tab" data-tab="${k}" class="${desk.contextTab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      ${body}
    </div>`;
  }

  function render() {
    const focused = document.activeElement && document.activeElement.dataset ? (document.activeElement.dataset.f || document.activeElement.dataset.w) : null;
    root.innerHTML = `<div class="desk">${topBar()}<div class="desk-body"><div class="stack">${mainPanel()}</div><div class="stack">${contextPanel()}</div></div></div>`;
    if (focused) { const el = root.querySelector(`[data-f="${focused}"],[data-w="${focused}"]`); if (el) { el.focus(); if (el.setSelectionRange && el.value) try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* ignore */ } } }
    tick();
  }

  function tick() {
    root.querySelectorAll('[data-since]').forEach(el => { const s = Number(el.dataset.since); if (s) el.textContent = S.fmtDur((Date.now() - s) / 1000); });
  }

  // ---------- Events (delegated, bound once) ----------
  function onClick(e) {
    const b = e.target.closest('[data-do]'); if (!b) return;
    const d = b.dataset.do;
    if (d === 'simulate') simulateIncoming();
    if (d === 'answer') answer();
    if (d === 'mute') { desk.call.muted = !desk.call.muted; render(); }
    if (d === 'hold') { desk.call.held = !desk.call.held; render(); }
    if (d === 'end') endCall();
    if (d === 'save') saveWrapUp();
    if (d === 'tab') { desk.contextTab = b.dataset.tab; render(); }
    if (d === 'tx') startTransfer(b.dataset.c, b.dataset.type);
    if (d === 'tx-ok') transferResult(true);
    if (d === 'tx-fail') transferResult(false);
    if (d === 'tx-complete') completeWarm();
    if (d === 'take-msg') { desk.call.transfer = null; desk.call.wrap.outcome = 'Message taken'; render(); const n = root.querySelector('[data-f="notes"]'); if (n) n.focus(); }
  }
  function onInput(e) {
    const el = e.target;
    if (el.dataset.f && desk.call) desk.call.form[el.dataset.f] = el.value;
    if (el.dataset.w && desk.call) desk.call.wrap[el.dataset.w] = el.type === 'checkbox' ? el.checked : el.value;
  }
  function onChange(e) {
    const el = e.target;
    if (el.id === 'statusSel') { S.setAgentStatus(agent.id, el.value); nextFromQueue(); render(); }
    if (el.id === 'autoSim') { desk.auto = el.checked; scheduleAuto(); }
    if (el.dataset.w === 'outcome') { desk.call.wrap.outcome = el.value; if (el.value === 'Callback requested') { desk.call.wrap.makeTask = true; render(); } }
    onInput(e);
  }
  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (!desk.auto) return;
    autoTimer = setTimeout(() => { simulateIncoming(); scheduleAuto(); }, 12000 + Math.random() * 20000);
  }

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  const clock = setInterval(tick, 1000);

  if (agent.status === 'ringing' || agent.status === 'on_call' || agent.status === 'after_call') S.setAgentStatus(agent.id, 'available');
  render();

  return () => {
    clearInterval(clock); clearTimeout(autoTimer);
    root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange);
  };
}

function hoursTable(firm) {
  const names = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const to12 = (t) => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
  return `<table>${Object.keys(names).map(k => `<tr><td>${names[k]}</td><td>${firm.hours[k] ? to12(firm.hours[k].open) + ' to ' + to12(firm.hours[k].close) : '<span class="muted">Closed</span>'}</td></tr>`).join('')}</table>
  <div class="small muted" style="margin-top:8px">These are the firm's office hours. ReplyQuick answers 24/7; hours only decide who can take transfers.</div>`;
}
