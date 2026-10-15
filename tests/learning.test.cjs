const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// A small DOM stand-in keeps session and scheduling checks dependency-free.
function app() {
  const elements = new Map();
  for (const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const classes = new Set((tag[0].match(/class="([^"]*)"/)?.[1] || '').split(' '));
    elements.set(tag[1], {
      value: '', textContent: '', disabled: false, innerHTML: '',
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, force) { const show = force ?? !classes.has(name); show ? classes.add(name) : classes.delete(name); return show; },
      },
      focus() {}, setAttribute() {}, removeAttribute() {},
    });
  }
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id), querySelectorAll: () => [] },
    window: { scrollTo() {} },
    localStorage: { getItem: () => null, setItem() {} },
    Intl, Date, console,
  });
  vm.runInContext(script, context);
  return { run: code => vm.runInContext(code, context), el: id => elements.get(id) };
}

test('new sentences do not appear in the due-review count', () => {
  const a = app();
  assert.equal(a.el('total').textContent, 10);
  assert.equal(a.el('due').textContent, 0);
  a.run('schedule(data[0],0)');
  assert.equal(a.el('due').textContent, 1);
});

test('study completion preserves the card and supports a new session', () => {
  const a = app();
  a.run('startStudy()');
  const count = a.run('studyQueue.length');
  for (let i = 0; i < count; i++) a.run('revealStudy();grade(2)');
  assert.equal(a.el('studydone').classList.contains('hidden'), false);
  assert.equal(a.el('studyprogress').value, count);
  a.run('startStudy()');
  assert.equal(a.el('studybox').classList.contains('hidden'), false);
  assert.equal(a.el('studydone').classList.contains('hidden'), true);
  assert.ok(a.el('studyprompt').textContent);
  assert.equal(a.el('studyprogress').value, 0);
});

test('opening a session from navigation initializes its questions', () => {
  const a = app();
  a.run('showTab("study")');
  assert.ok(a.el('studyprompt').textContent);
  a.run('showTab("quiz")');
  assert.ok(a.el('quizprompt').textContent);
});

test('quiz requires an answer or an explicit skip and records each grade once', () => {
  const a = app();
  a.run('startQuiz();checkQuiz()');
  assert.equal(a.el('quizinput').disabled, false);
  assert.equal(a.el('quizresult').classList.contains('hidden'), true);
  a.run('checkQuiz(true);quizGrade(0);quizGrade(2)');
  assert.equal(a.run('quizRatings[0]'), 1);
  assert.equal(a.run('quizRatings[2]'), 0);
  assert.equal(a.run('quizQueue[0].seen'), 1);
  a.run('nextQuiz();nextQuiz()');
  assert.equal(a.run('quizIndex'), 1);
});

test('quiz completion summarizes self-assessment and can restart', () => {
  const a = app();
  a.run('startQuiz()');
  const count = a.run('quizQueue.length');
  for (let i = 0; i < count; i++) a.run('checkQuiz(true);quizGrade(1);nextQuiz()');
  assert.equal(a.el('quizdone').classList.contains('hidden'), false);
  assert.match(a.el('quizbreakdown').textContent, new RegExp('再練習 '+count+' 項'));
  a.run('startQuiz()');
  assert.equal(a.run('quizRatings.reduce((sum,n)=>sum+n,0)'), 0);
  assert.equal(a.el('quizbox').classList.contains('hidden'), false);
});

test('library combines status filtering with search and escapes imported content', () => {
  const a = app();
  a.run('schedule(data[0],0);setFilter("due")');
  assert.equal(a.el('librarycount').textContent, '1 / 10 項');
  a.el('search').value = 'not in this collection';
  a.run('renderLibrary()');
  assert.equal(a.el('librarycount').textContent, '0 / 10 項');
  a.el('search').value = '';
  a.run('data[0].english="<img src=x onerror=alert(1)>";renderLibrary()');
  assert.ok(a.el('items').innerHTML.includes('&lt;img'));
  assert.ok(!a.el('items').innerHTML.includes('<img'));
});

test('storage failure shows a visible warning instead of hiding lost persistence', () => {
  const a = app();
  a.run('localStorage.setItem=()=>{throw new Error("quota")};save()');
  assert.equal(a.el('storageStatus').classList.contains('hidden'), false);
  assert.match(a.el('storageStatus').textContent, /下載備份/);
});

test('practice kind separates vocabulary and sentences while honoring an explicit kind', () => {
  const a = app();
  assert.equal(a.run('itemKind({english:"perfume"})'), 'word');
  assert.equal(a.run('itemKind({english:"highly efficient"})'), 'word');
  assert.equal(a.run('itemKind({english:"Let me think about it."})'), 'sentence');
  assert.equal(a.run('itemKind({english:"How are you?"})'), 'sentence');
  assert.equal(a.run('itemKind({english:"I prefer tea",kind:"sentence"})'), 'sentence');
  a.run('data.push({id:"word-test",english:"perfume",chinese:"香水",seen:0,level:0});setPracticeKind("word","study")');
  assert.equal(a.run('studyQueue.length'), 1);
  assert.equal(a.el('studyenglish').textContent, 'perfume');
  a.run('startQuiz()');
  assert.equal(a.run('quizQueue.length'), 1);
  assert.equal(a.el('quizprompt').textContent, '香水');
});

test('a kind with no content shows an empty state rather than an unrelated question', () => {
  const a = app();
  a.run('setPracticeKind("word","study")');
  assert.equal(a.el('studyempty').classList.contains('hidden'), false);
  assert.equal(a.el('studydone').classList.contains('hidden'), true);
  assert.equal(a.el('studybox').classList.contains('hidden'), true);
  a.run('showTab("quiz")');
  assert.equal(a.el('quizempty').classList.contains('hidden'), false);
  a.run('setPracticeKind("sentence","study")');
  assert.equal(a.el('studyempty').classList.contains('hidden'), true);
  assert.ok(a.run('studyQueue.length') > 0);
});

test('import and manual kind corrections retain content and learning progress', () => {
  const a = app();
  assert.equal(a.run('parseItems([{english:"I prefer tea",kind:"sentence"}])[0].kind'), 'sentence');
  assert.equal(a.run('parseItems({vocabulary:[{word:"efficient",chinese:"有效率的"}]})[0].kind'), 'word');
  assert.equal(a.run('parseItems({sentences:[{english:"I prefer tea",chinese:"我偏好茶"}]})[0].kind'), 'sentence');
  a.run('schedule(data[0],2)');
  const due = a.run('data[0].due');
  a.run('setItemKind(0,"word")');
  assert.equal(a.run('data[0].seen'), 1);
  assert.equal(a.run('data[0].due'), due);
  assert.equal(a.run('itemKind(data[0])'), 'word');
});

test('normal and slow speech reuse the shared reader and report playback errors', () => {
  const a = app();
  a.run('window.speechSynthesis={cancel(){},speak(u){window.lastUtterance=u}};speechSynthesis=window.speechSynthesis;SpeechSynthesisUtterance=function(text){this.text=text};speak("perfume",1)');
  assert.equal(a.run('window.lastUtterance.text'), 'perfume');
  assert.equal(a.run('window.lastUtterance.rate'), 1);
  a.run('speak("Let me think about it.",0.7)');
  assert.equal(a.run('window.lastUtterance.rate'), 0.7);
  a.run('window.lastUtterance.onerror({error:"audio-busy"})');
  assert.equal(a.el('speechstatus').classList.contains('hidden'), false);
});


test('shadowing can hide and reveal English without changing the material or grade', () => {
  const a = app();
  a.run('startStudy();revealStudy()');
  const english = a.el('studyenglish').textContent;
  a.run('toggleStudyText()');
  assert.equal(a.el('studyenglish').classList.contains('hidden'), true);
  assert.equal(a.el('studyextra').classList.contains('hidden'), true);
  assert.equal(a.el('hideEnglish').textContent, '顯示英文');
  a.run('toggleStudyText()');
  assert.equal(a.el('studyenglish').classList.contains('hidden'), false);
  assert.equal(a.el('studyenglish').textContent, english);
  assert.equal(a.run('studyQueue[0].seen'), 0);
});

test('adding missing vocabulary refreshes a previously empty practice session', () => {
  const a = app();
  a.run('setPracticeKind("word","study");mergeItems([{english:"efficient",chinese:"有效率的",kind:"word"}]);showTab("study")');
  assert.equal(a.el('studyempty').classList.contains('hidden'), true);
  assert.equal(a.el('studyenglish').textContent, 'efficient');
});

test('vocabulary examples speak the English sentence without its Chinese translation', () => {
  const a = app();
  assert.equal(a.run('exampleEnglish({english:"perfume",note:"She sprayed a little perfume on her wrist.（她在手腕噴了香水。）"})'), 'She sprayed a little perfume on her wrist.');
  assert.equal(a.run('exampleEnglish({english:"efficient",note:"The new machine is efficient."})'), 'The new machine is efficient.');
  assert.equal(a.run('exampleEnglish({english:"efficient",note:"這是一個形容詞。"})'), '');
  assert.equal(a.run('exampleEnglish({english:"It works.",note:"It works."})'), '');
});
