// simple deterministic analyzer - no fake probabilities
// rules combine to produce ranked interpretations and "evidence" for transparency

const messageInput = document.getElementById('message-input');
const contextInput = document.getElementById('context-input');
const delayInput = document.getElementById('delay-input');
const analyzeBtn = document.getElementById('analyze-btn');
const harderBtn = document.getElementById('harder-btn');
const clearBtn = document.getElementById('clear-btn');
const interpretationsEl = document.getElementById('interpretations');
const evidenceList = document.getElementById('evidence-list');
const meterBadge = document.getElementById('meter-badge');
const shortSummary = document.getElementById('short-summary');

function normalize(s){ return (s||'').trim().toLowerCase(); }

function analyzeMessage(message, context, delayMinutes){
  const m = normalize(message);
  const ctx = normalize(context);
  const evidence = [];
  const signals = {};

  // basic signals
  signals.length = m.length;
  signals.words = m.split(/\s+/).filter(Boolean).length;
  signals.endsWithDot = /\.$/.test(message);
  signals.endsWithEllipsis = /\.{2,}$/.test(message) || /\. \.\.$/.test(message);
  signals.exclaim = /!$/.test(message);
  signals.kSingle = m === 'k';
  signals.okVariants = ['ok','okay','ok.','okay.','okkk','okk','okey','okeyy'].includes(m);
  signals.allLower = (message === message.toLowerCase());
  signals.allCaps = /[A-Z]/.test(message) && message === message.toUpperCase();
  signals.repeatedLetters = /(.)\1\1/.test(message); // e.g. loool or okkk
  signals.ellipsis = message.includes('...');
  signals.onlyEmoji = /^\p{Emoji}+$/.test(message) || /^\p{Emoji_Presentation}+$/u.test(message);
  signals.isShort = m.length <= 3 || signals.words <= 1;

  // context analysis - compare energies
  let contextLines = ctx.split('\n').map(s=>s.trim()).filter(Boolean);
  const last = contextLines[contextLines.length - 1] || '';
  signals.energyMismatch = false;
  if (contextLines.length >= 1){
    const lastWords = last.split(/\s+/).length;
    if (lastWords >= 8 && signals.isShort) {
      signals.energyMismatch = true;
      evidence.push('energy mismatch - reply is far shorter than prior message');
    }
  }

  // delay logic
  if (delayMinutes !== null && delayMinutes !== undefined && !Number.isNaN(delayMinutes)){
    if (delayMinutes >= 60) {
      evidence.push('long delay before reply');
      signals.longDelay = true;
    } else if (delayMinutes >= 10) {
      evidence.push('moderate delay before reply');
      signals.mediumDelay = true;
    } else {
      signals.quick = true;
    }
  }

  // rule set to build interpretations (ordered by likelihood given signals)
  const interpretations = [];

  if (signals.kSingle) {
    interpretations.push({
      text: 'dismissive or rushed - "k" is often used to cut a conversation short',
      reason: 'single-letter reply "k"'
    });
  }

  if (signals.okVariants && !signals.kSingle){
    let base = 'acknowledgement - short acceptance of what you said';
    if (signals.endsWithDot) base = 'flat/serious acknowledgement - dot can signal finality';
    if (signals.repeatedLetters) base = 'playful or drawn-out "ok" - repeated letters often mean teasing';
    interpretations.push({text: base, reason: `ok variant detected (${message})`});
  }

  if (signals.ellipsis || signals.endsWithEllipsis){
    interpretations.push({text: 'hesitation or thinking - they may be uncertain or withholding a longer reply', reason: 'ellipsis detected'});
  }

  if (signals.exclaim){
    interpretations.push({text: 'enthusiastic or urgent - exclamation often adds energy to short replies', reason: 'exclamation mark present'});
  }

  if (signals.onlyEmoji){
    interpretations.push({text: 'nonverbal reaction - using emoji instead of words; can mean mood or tone shorthand', reason: 'emoji-only reply'});
  }

  if (signals.energyMismatch){
    interpretations.push({text: 'low engagement relative to your message - they may be distracted or uninterested', reason: 'reply much shorter than your preceding message'});
  }

  if (signals.longDelay){
    interpretations.push({text: 'busy or deprioritized - long response time suggests they were occupied', reason: 'long delay before reply'});
  }
  if (signals.mediumDelay){
    interpretations.push({text: 'delayed but not long - likely busy or interrupted', reason: 'moderate delay before reply'});
  }

  if (signals.allCaps){
    interpretations.push({text: 'strong emotion - all caps can indicate anger or strong emphasis', reason: 'all caps detected'});
  }
  if (signals.endsWithDot && !signals.okVariants){
    interpretations.push({text: 'serious or clipped tone - ending with a dot can sound final', reason: 'ends with dot'});
  }

  if (interpretations.length === 0){
    interpretations.push({text: 'neutral acknowledgement - likely nothing major, just a short reply', reason: 'no strong signals detected'});
  }

  const seen = new Set();
  const unique = [];
  for (const it of interpretations){
    if (!seen.has(it.reason)){
      unique.push(it);
      seen.add(it.reason);
    }
  }

  let meter = 'calm';
  if (signals.kSingle || signals.allCaps || signals.endsWithDot && signals.isShort) meter = 'concerned';
  if (signals.energyMismatch || signals.longDelay) meter = 'spiraling';
  if (signals.kSingle && signals.allCaps) meter = 'detective mode';

  return {
    meter,
    summary: unique[0] ? unique[0].text : 'neutral',
    interpretations: unique,
    evidence: evidence.length ? evidence : ['rules matched: ' + unique.map(u=>u.reason).join('; ')]
  };
}

function renderResult(res){
  meterBadge.textContent = res.meter;
  shortSummary.textContent = res.summary;

  interpretationsEl.innerHTML = '';
  res.interpretations.forEach((it, i) => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<span class="rank">${i+1}.</span> ${escapeHtml(it.text)}`;
    interpretationsEl.appendChild(el);
  });

  evidenceList.innerHTML = '';
  res.evidence.forEach(e => {
    const li = document.createElement('li');
    li.textContent = e;
    evidenceList.appendChild(li);
  });
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

analyzeBtn.addEventListener('click', () => {
  const msg = messageInput.value || '';
  const ctx = contextInput.value || '';
  const delay = Number(delayInput.value || 0);
  const res = analyzeMessage(msg, ctx, isNaN(delay) ? null : delay);
  renderResult(res);
});

harderBtn.addEventListener('click', () => {
  const msg = messageInput.value || '';
  const ctx = contextInput.value || '';
  const delay = Number(delayInput.value || 0);
  const base = analyzeMessage(msg, ctx, isNaN(delay) ? null : delay);

  const extras = [];

  if (msg.trim().length === 0) extras.push({text:'empty message - they may have hit send by mistake', reason:'empty input'});
  if (base.interpretations.some(i=>/acknowledge/i.test(i.text))) extras.push({text:'they agreed but may be considering how to respond later', reason:'deeper: considering reply'});
  if (msg.includes('?')) extras.push({text:'short question - they might expect a one-line answer', reason:'question mark present'});

  for (const ex of extras){
    if (!base.interpretations.some(i=>i.reason === ex.reason)){
      base.interpretations.push(ex);
    }
  }
  base.evidence.push('deepened analysis (deterministic extra interpretations)');
  renderResult(base);
});

clearBtn.addEventListener('click', () => {
  messageInput.value = '';
  contextInput.value = '';
  delayInput.value = '';
  interpretationsEl.innerHTML = '';
  evidenceList.innerHTML = '';
  meterBadge.textContent = 'calm';
  shortSummary.textContent = 'enter a message to analyze';
});
