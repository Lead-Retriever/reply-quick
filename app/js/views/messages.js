// ============================================================
// Receptionist inbox: text and email conversations with callers,
// one thread per person, with an Email / Text toggle (GoHighLevel style).
// PROTOTYPE: sending saves the message here. In the live version texts go
// out from the firm's Live Service number (Twilio) and emails from a
// firm-branded address, and replies land back in the same thread.
// ============================================================
import * as S from '../store.js';
import { esc, toast, openPanel } from '../ui.js';

const SMS_LIMIT = 160;

export function createInbox(agent, rerender) {
  const ui = { selected: null, channel: 'sms', search: '', firm: '', draft: { body: '', subject: '' }, template: '' };

  const myFirms = () => agent.firmIds.map(S.getFirm).filter(Boolean);
  const list = () => S.getConversations(agent.firmIds).filter(c =>
    (!ui.firm || c.firmId === ui.firm) &&
    (!ui.search || (c.name + ' ' + c.phone + ' ' + c.email).toLowerCase().includes(ui.search.toLowerCase())));
  const unreadCount = () => S.getConversations(agent.firmIds).filter(c => c.unread).length;

  function templates(firm, conv) {
    const first = (conv.name || '').split(' ')[0] || 'there';
    return [
      { label: 'Thanks for calling', subject: 'Thanks for calling ' + firm.name, body: 'Hi ' + first + ', this is ' + agent.name.split(' ')[0] + ' from ' + firm.name + '. Thanks for calling today. Reply here anytime if anything else comes up.' },
      { label: 'Consultation reminder', subject: 'Your consultation with ' + firm.name, body: 'Hi ' + first + ', a reminder about your consultation with ' + firm.name + '. Please bring any paperwork related to your case. Reply here if you need to reschedule.' },
      { label: 'We tried to reach you', subject: 'We tried to reach you', body: 'Hi ' + first + ', we tried to reach you from ' + firm.name + '. Reply here or call us back at ' + S.fmtPhone(firm.rqNumber) + ' whenever works for you.' },
    ];
  }

  function open(convId) {
    ui.selected = convId; ui.draft = { body: '', subject: '' }; ui.template = '';
    const c = S.getConversation(convId);
    if (c) {
      if (c.unread) S.updateConversation(c.id, { unread: false });
      if (ui.channel === 'sms' && !c.phone && c.email) ui.channel = 'email';
      if (ui.channel === 'email' && !c.email && c.phone) ui.channel = 'sms';
    }
  }

  // ---------- Rendering ----------
  function html() {
    const convs = list();
    if (!ui.selected && convs.length) open(convs[0].id);
    const c = ui.selected ? S.getConversation(ui.selected) : null;
    return `
    <div class="inbox">
      <div class="inbox-list card">
        <div class="btn-row" style="margin-bottom:10px">
          <input type="text" data-in="search" placeholder="Search name, phone or email" value="${esc(ui.search)}" />
          <button class="btn primary sm" data-in-do="new" style="width:100%">New message</button>
        </div>
        <select data-in="firm" style="margin-bottom:10px"><option value="">All my firms</option>${myFirms().map(f => `<option value="${f.id}" ${ui.firm === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
        <div class="conv-scroll">
        ${convs.length ? convs.map(x => {
          const last = x.messages[x.messages.length - 1];
          const firm = S.getFirm(x.firmId);
          return `<button class="conv ${x.id === ui.selected ? 'active' : ''}" data-in-do="open" data-id="${x.id}">
            <div class="conv-top"><b>${esc(x.name)}</b>${x.unread ? '<span class="unread-dot"></span>' : ''}<span class="small muted num">${last ? esc(S.fmtDay(last.at) === 'Today' ? S.fmtTime(last.at) : S.fmtDay(last.at)) : ''}</span></div>
            <div class="small muted">${esc(firm ? firm.name : '')}</div>
            <div class="conv-prev">${last ? (last.channel === 'email' ? '<span class="ch email">Email</span>' : '<span class="ch sms">Text</span>') + esc(last.dir === 'in' ? '' : 'You: ') + esc(last.subject || last.body) : '<span class="muted">No messages yet</span>'}</div>
          </button>`;
        }).join('') : '<div class="empty">No conversations yet.</div>'}
        </div>
      </div>
      <div class="inbox-thread card">${c ? thread(c) : '<div class="empty">Pick a conversation, or start a new message.</div>'}</div>
    </div>`;
  }

  function thread(c) {
    const firm = S.getFirm(c.firmId);
    const tpls = templates(firm, c);
    const canSms = !!c.phone, canEmail = !!c.email;
    const firstText = !c.messages.some(m => m.channel === 'sms' && m.dir === 'out');
    const len = ui.draft.body.length + (ui.channel === 'sms' && firstText ? 25 : 0);
    return `
      <div class="thread-head">
        <div><h3>${esc(c.name)}</h3><div class="small muted">${esc(firm.name)} · ${c.phone ? esc(S.fmtPhone(c.phone)) : 'no phone'} · ${c.email ? esc(c.email) : 'no email'}</div></div>
        <div class="btn-row">${c.callId ? '<span class="tag">From a call</span>' : ''}<button class="btn sm" data-in-do="edit">Edit contact</button><button class="btn sm" data-in-do="reply" title="Prototype only: adds a fake reply from the caller">Demo: simulate reply</button></div>
      </div>
      <div class="thread-body" id="threadBody">
        ${c.messages.length ? c.messages.map(m => `
          <div class="msg ${m.dir}">
            <div class="bubble ${m.channel}">
              ${m.channel === 'email' && m.subject ? `<div class="msg-subj">${esc(m.subject)}</div>` : ''}
              <div class="msg-text">${esc(m.body).replace(/\n/g, '<br>')}</div>
            </div>
            <div class="msg-meta">${m.channel === 'email' ? 'Email' : 'Text'} · ${esc(S.fmtDay(m.at))} ${esc(S.fmtTime(m.at))}${m.by ? ' · ' + esc(m.by) : ''}</div>
          </div>`).join('') : '<div class="empty">No messages yet. Say hello below.</div>'}
      </div>
      <div class="composer">
        <div class="composer-top">
          <div class="seg">
            <button data-in-do="ch" data-ch="sms" class="${ui.channel === 'sms' ? 'active' : ''}" ${canSms ? '' : 'disabled title="No phone number on file"'}>Text</button>
            <button data-in-do="ch" data-ch="email" class="${ui.channel === 'email' ? 'active' : ''}" ${canEmail ? '' : 'disabled title="No email on file"'}>Email</button>
          </div>
          <select data-in="template" style="width:auto"><option value="">Insert template</option>${tpls.map((t, i) => `<option value="${i}">${esc(t.label)}</option>`).join('')}</select>
          <span class="small muted">${ui.channel === 'sms' ? 'From ' + esc(S.fmtPhone(firm.rqNumber)) : 'From ' + esc(firm.name)}</span>
        </div>
        ${ui.channel === 'email' ? `<input type="text" data-in="subject" placeholder="Subject" value="${esc(ui.draft.subject)}" style="margin-bottom:8px" />` : ''}
        <textarea data-in="body" placeholder="${ui.channel === 'sms' ? 'Type a text message' : 'Write an email'}" style="min-height:${ui.channel === 'email' ? 120 : 70}px">${esc(ui.draft.body)}</textarea>
        <div class="composer-foot">
          <span class="small muted" id="smsCount">${ui.channel === 'sms' ? smsInfo(len, firstText) : ''}</span>
          <button class="btn primary" data-in-do="send">${ui.channel === 'sms' ? 'Send text' : 'Send email'}</button>
        </div>
      </div>`;
  }

  function smsInfo(len, firstText) {
    const parts = Math.max(1, Math.ceil(len / SMS_LIMIT));
    return len + ' characters · ' + parts + ' text' + (parts > 1 ? 's' : '') + (firstText ? ' · "Reply STOP to opt out." is added to the first text' : '');
  }

  function afterRender(root) {
    const tb = root.querySelector('#threadBody'); if (tb) tb.scrollTop = tb.scrollHeight;
  }

  // ---------- Actions ----------
  function send(root) {
    const c = S.getConversation(ui.selected); if (!c) return;
    const body = ui.draft.body.trim();
    if (!body) { toast('Type a message first'); return; }
    if (ui.channel === 'email' && !ui.draft.subject.trim()) { toast('Add a subject for the email'); return; }
    const firstText = ui.channel === 'sms' && !c.messages.some(m => m.channel === 'sms' && m.dir === 'out');
    S.addMessage(c.id, {
      channel: ui.channel, dir: 'out', by: agent.name,
      body: firstText ? body + ' Reply STOP to opt out.' : body,
      subject: ui.channel === 'email' ? ui.draft.subject.trim() : undefined,
    });
    ui.draft = { body: '', subject: '' }; ui.template = '';
    toast(ui.channel === 'sms' ? 'Text sent' : 'Email sent');
    rerender();
  }

  function simulateReply() {
    const c = S.getConversation(ui.selected); if (!c) return;
    const lastOut = [...c.messages].reverse().find(m => m.dir === 'out');
    const ch = lastOut ? lastOut.channel : (c.phone ? 'sms' : 'email');
    S.addMessage(c.id, ch === 'email'
      ? { channel: 'email', dir: 'in', subject: 'Re: ' + ((lastOut && lastOut.subject) || 'Your message'), body: 'Thanks for the quick reply. That works for me.' }
      : { channel: 'sms', dir: 'in', body: 'Got it, thank you!' });
    S.updateConversation(c.id, { unread: false });
    rerender();
  }

  function contactForm(title, c, onSave) {
    const { el, close } = openPanel(`
      <div class="card-head"><h2>${title}</h2><button class="btn sm" data-close>Close</button></div>
      <form class="stack" id="cForm">
        ${c ? '' : `<label class="field"><span>Firm</span><select name="firmId">${myFirms().map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></label>`}
        <label class="field"><span>Name</span><input type="text" name="name" value="${esc(c ? c.name : '')}" required /></label>
        <label class="field"><span>Mobile number</span><input type="tel" name="phone" value="${esc(c && c.phone ? S.fmtPhone(c.phone) : '')}" /></label>
        <label class="field"><span>Email</span><input type="email" name="email" value="${esc(c ? c.email : '')}" /></label>
        <div class="error hidden" id="cErr">Add a mobile number or an email.</div>
        <button class="btn primary" type="submit">${c ? 'Save' : 'Start conversation'}</button>
      </form>`, { center: true });
    el.querySelector('#cForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const phone = S.toE164(f.phone.value) || '';
      const email = f.email.value.trim();
      if (!phone && !email) { el.querySelector('#cErr').classList.remove('hidden'); return; }
      onSave({ firmId: f.firmId ? f.firmId.value : null, name: f.name.value.trim(), phone, email });
      close();
    });
  }

  function onClick(e, root) {
    const b = e.target.closest('[data-in-do]'); if (!b) return false;
    const d = b.dataset.inDo;
    if (d === 'open') { open(b.dataset.id); rerender(); }
    if (d === 'ch') { ui.channel = b.dataset.ch; rerender(); }
    if (d === 'send') send(root);
    if (d === 'reply') simulateReply();
    if (d === 'new') contactForm('New message', null, (v) => { const id = S.startConversation(v); open(id); rerender(); });
    if (d === 'edit') { const c = S.getConversation(ui.selected); contactForm('Edit contact', c, (v) => { S.updateConversation(c.id, { name: v.name, phone: v.phone, email: v.email }); rerender(); }); }
    return true;
  }

  function onInput(e, root) {
    const el = e.target; const k = el.dataset.in; if (!k) return false;
    if (k === 'body') { ui.draft.body = el.value; const c = S.getConversation(ui.selected); const first = c && !c.messages.some(m => m.channel === 'sms' && m.dir === 'out'); const sc = root.querySelector('#smsCount'); if (sc && ui.channel === 'sms') sc.textContent = smsInfo(el.value.length + (first ? 25 : 0), first); }
    if (k === 'subject') ui.draft.subject = el.value;
    if (k === 'search') { ui.search = el.value; rerender(true); }
    return true;
  }

  function onChange(e) {
    const el = e.target; const k = el.dataset.in; if (!k) return false;
    if (k === 'firm') { ui.firm = el.value; ui.selected = null; rerender(); }
    if (k === 'template' && el.value !== '') {
      const c = S.getConversation(ui.selected); const t = templates(S.getFirm(c.firmId), c)[Number(el.value)];
      ui.draft.body = t.body; if (ui.channel === 'email') ui.draft.subject = t.subject; rerender();
    }
    return true;
  }

  // Start (or reopen) a conversation with a caller from the call log.
  function fromCall(call) {
    const id = S.startConversation({ firmId: call.firmId, name: call.callerName, phone: call.callerPhone, email: '', callId: call.id });
    ui.firm = ''; ui.search = ''; open(id);
  }

  return { html, afterRender, onClick, onInput, onChange, unreadCount, fromCall };
}
