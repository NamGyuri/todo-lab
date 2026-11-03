import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STORAGE_KEY,
  combinedLabel,
  shortDate,
  addDays,
  dateKey,
  dateLabel,
  dayStatus,
  dayTasks,
  listIconName,
  dayTitle,
  deletedLabel,
  doneLast,
  groupByDate,
  monthGrid,
  homeView,
  initialState,
  loadState,
  remainingCount,
  saveState,
  viewTasks,
} from './tasks.js';

const TODAY = '2026-11-02';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const task = (over) => ({ id: 'x', title: 't', date: null, done: false, deletedAt: null, ...over });

test('dateKey는 UTC가 아니라 현지 날짜를 쓴다', () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 0, 30)), '2026-01-05');
});

test('addDays는 월·연 경계를 넘는다', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('dateLabel', () => {
  assert.equal(dateLabel(null, TODAY), '날짜 없음');
  assert.equal(dateLabel(TODAY, TODAY), '오늘');
  assert.equal(dateLabel('2026-11-03', TODAY), '내일');
  assert.equal(dateLabel('2026-12-25', TODAY), '12월 25일');
  assert.equal(dateLabel('2027-01-01', TODAY), '2027년 1월 1일');
});

test('viewTasks는 보기별로 나누고, 어떤 할 일도 보이지 않게 두지 않는다', () => {
  const tasks = [
    task({ id: 'none' }),
    task({ id: 'today', date: TODAY }),
    task({ id: 'late', date: '2026-10-30' }),
    task({ id: 'lateDone', date: '2026-10-30', done: true }),
    task({ id: 'soon', date: '2026-11-05' }),
    task({ id: 'gone', date: TODAY, deletedAt: '2026-11-02T00:00:00Z' }),
  ];
  const ids = (view) => viewTasks(tasks, view, TODAY).map((t) => t.id);
  assert.deepEqual(ids('all'), ['none', 'today', 'late', 'lateDone', 'soon']);
  assert.deepEqual(ids('today'), ['late', 'today']);
  assert.deepEqual(ids('upcoming'), ['soon']);
  assert.deepEqual(ids('completed'), ['lateDone']);
  assert.deepEqual(ids('trash'), ['gone']);
  const seen = new Set(['all', 'trash'].flatMap(ids));
  assert.equal(seen.size, tasks.length);
});

test('전체는 휴지통만 빼고, 날짜순으로 묶고, 날짜 없음은 맨 아래다', () => {
  const tasks = [
    task({ id: 'none' }),
    task({ id: 'b', date: '2026-11-05' }),
    task({ id: 'a1', date: '2026-10-30', done: true }),
    task({ id: 'a2', date: '2026-10-30' }),
    task({ id: 'gone', date: TODAY, deletedAt: '2026-11-02T00:00:00Z' }),
  ];
  const groups = groupByDate(viewTasks(tasks, 'all', TODAY));
  assert.deepEqual(groups.map((g) => g.date), ['2026-10-30', '2026-11-05', null]);
  assert.deepEqual(groups[0].tasks.map((t) => t.id), ['a1', 'a2']);
});

test('개수 뱃지는 남은 할 일만 센다', () => {
  const tasks = [
    task({ id: 'none' }),
    task({ id: 'd', date: TODAY }),
    task({ id: 'done', date: TODAY, done: true }),
    task({ id: 'gone', deletedAt: '2026-11-02T00:00:00Z' }),
  ];
  assert.equal(remainingCount(tasks, 'all', TODAY), 2);
  assert.equal(remainingCount(tasks, 'today', TODAY), 1);
  assert.equal(remainingCount(tasks, 'completed', TODAY), 0);
  assert.equal(remainingCount(tasks, 'trash', TODAY), 0);
});

test('monthGrid는 일요일 시작이고 빈칸을 채운다', () => {
  const weeks = monthGrid('2026-11-02'); // 2026-11-01은 일요일
  assert.equal(weeks[0][0], '2026-11-01');
  assert.equal(weeks.flat().filter(Boolean).length, 30);
  assert.ok(weeks.every((w) => w.length === 7));
  const feb = monthGrid('2027-02-10'); // 2027-02-01은 월요일
  assert.equal(feb[0][0], null);
  assert.equal(feb[0][1], '2027-02-01');
  assert.equal(feb.flat().filter(Boolean).at(-1), '2027-02-28');
});

test('dayStatus는 휴지통을 빼고 판단한다', () => {
  const tasks = [
    task({ date: TODAY, done: true }),
    task({ date: '2026-11-03', done: true }),
    task({ date: '2026-11-03' }),
    task({ date: '2026-11-04', deletedAt: '2026-11-02T00:00:00Z' }),
  ];
  assert.equal(dayStatus(tasks, TODAY), 'done');
  assert.equal(dayStatus(tasks, '2026-11-03'), 'open');
  assert.equal(dayStatus(tasks, '2026-11-04'), null);
});

test('dayTitle과 dayTasks', () => {
  assert.equal(dayTitle('2026-11-02'), '11월 2일 (월)');
  assert.equal(dayTitle('2026-11-01'), '11월 1일 (일)');
  const tasks = [
    task({ id: 'a', date: TODAY, done: true }),
    task({ id: 'b', date: '2026-11-03' }),
    task({ id: 'c', date: TODAY, deletedAt: '2026-11-02T00:00:00Z' }),
  ];
  assert.deepEqual(dayTasks(tasks, TODAY).map((t) => t.id), ['a']);
});

test('deletedLabel', () => {
  const now = new Date(2026, 10, 3, 0, 30);
  assert.equal(deletedLabel(new Date(2026, 10, 3, 0, 10).toISOString(), now), '오늘 삭제');
  assert.equal(deletedLabel(new Date(2026, 10, 2, 23, 50).toISOString(), now), '1일 전 삭제');
  assert.equal(deletedLabel(new Date(2026, 9, 31, 12).toISOString(), now), '3일 전 삭제');
  assert.equal(deletedLabel(new Date(2026, 10, 4).toISOString(), now), '오늘 삭제');
  assert.equal(deletedLabel('깨진 값', now), '삭제됨');
});

test('doneLast: 미완료 순서 유지, 완료는 완료한 순서, 풀면 제자리', () => {
  const ids = (list) => list.map((t) => t.id);
  const a = task({ id: 'a' });
  const b = task({ id: 'b', done: true, doneAt: '2026-11-02T10:00:00.000Z' });
  const c = task({ id: 'c' });
  const d = task({ id: 'd', done: true, doneAt: '2026-11-02T09:00:00.000Z' });
  const tasks = [a, b, c, d];
  assert.deepEqual(ids(doneLast(tasks)), ['a', 'c', 'd', 'b']);
  assert.deepEqual(ids(tasks), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(doneLast([a, { ...b, done: false, doneAt: null }, c, d])), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(doneLast([task({ id: 'x', done: true, doneAt: null }), a])), ['a', 'x']);
});

test('저장된 리스트에 아이콘이 없으면 채우고, 나머지는 그대로 둔다', () => {
  const stored = {
    intro: false,
    lists: [
      { id: 'l1', name: 'Work', order: 1 },
      { id: 'l2', name: 'Personal', emoji: '🏠', order: 2 },
      { id: 'l3', name: 'Daily Habits', order: 3 },
      { id: 'l4', name: '취미', emoji: '🎨', order: 4 },
      { id: 'l5', name: 'Work', icon: 'folder', order: 5 },
      { id: 'l6', name: 'constructor', order: 6 },
    ],
    tasks: [task({ id: 'keep', listId: 'l4', title: '내 할 일' })],
  };
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(stored) });
  const { state } = loadState(storage, TODAY);
  assert.deepEqual(state.lists.map((l) => l.icon), ['briefcase', 'home', 'sprout', 'folder', 'briefcase', 'folder']);
  assert.ok(state.lists.every((l) => !('emoji' in l)));
  assert.deepEqual(state.lists.map((l) => [l.id, l.name, l.order]), stored.lists.map((l) => [l.id, l.name, l.order]));
  assert.deepEqual(state.tasks, stored.tasks);
  assert.equal(state.intro, false);
  assert.equal(storage.data[`${STORAGE_KEY}:corrupt`], undefined);
});

test('listIconName: 없음, 이모지, 알 수 없는 값, 잘못 저장된 folder', () => {
  const name = (n, icon) => listIconName({ name: n, icon });
  for (const bad of [undefined, null, '', '🎯', 'rocket', 'constructor', '__proto__', 'folder', 3]) {
    assert.equal(name('Work', bad), 'briefcase', String(bad));
    assert.equal(name('Personal', bad), 'home', String(bad));
    assert.equal(name('Daily Habits', bad), 'sprout', String(bad));
    assert.equal(name('취미', bad), 'folder', String(bad));
    assert.equal(name('toString', bad), 'folder', String(bad));
  }
  assert.equal(name('취미', 'sprout'), 'sprout');
  assert.equal(name('Work', 'home'), 'home');
  assert.equal(listIconName(undefined), 'folder');
});

test('바로잡아도 할 일과 리스트의 다른 값은 그대로', () => {
  const stored = {
    intro: false,
    lists: [{ id: 'l1', name: 'Work', emoji: '🎯', icon: 'folder', order: 7, extra: 'x' }],
    tasks: [task({ id: 'keep', title: '내 할 일', listId: 'l1' })],
  };
  const { state } = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(stored) }), TODAY);
  assert.deepEqual(state.lists, [{ id: 'l1', name: 'Work', icon: 'briefcase', order: 7, extra: 'x' }]);
  assert.deepEqual(state.tasks, stored.tasks);
});

test('기본 리스트의 아이콘', () => {
  assert.deepEqual(initialState(TODAY).lists.map((l) => l.icon), ['briefcase', 'home', 'sprout']);
});

test('shortDate', () => {
  assert.equal(shortDate(null, TODAY), '—');
  assert.equal(shortDate(TODAY, TODAY), '오늘');
  assert.equal(shortDate('2026-11-03', TODAY), '내일');
  assert.equal(shortDate('2026-11-18', TODAY), '11/18');
  assert.equal(shortDate('2027-01-05', TODAY), '1/5');
});

test('combinedLabel', () => {
  const work = { name: 'Work' };
  assert.equal(combinedLabel('2026-11-18', work, TODAY), '날짜 11월 18일, 리스트 Work, 변경하기');
  assert.equal(combinedLabel(TODAY, work, TODAY), '날짜 오늘, 리스트 Work, 변경하기');
  assert.equal(combinedLabel(null, work, TODAY), '날짜 없음, 리스트 Work, 변경하기');
  assert.equal(combinedLabel(TODAY, undefined, TODAY), '날짜 오늘, 리스트 없음, 변경하기');
});

test('homeView', () => {
  assert.equal(homeView(task({}), TODAY), 'all');
  assert.equal(homeView(task({ date: TODAY }), TODAY), 'today');
  assert.equal(homeView(task({ date: '2026-11-03' }), TODAY), 'upcoming');
});

test('첫 접속: 예시를 보여주고 개인정보 기본값은 없다', () => {
  const { state, persistent } = loadState(memoryStorage(), TODAY);
  assert.equal(persistent, true);
  assert.equal(state.intro, true);
  assert.ok(state.tasks.length > 0 && state.tasks.every((t) => t.sample));
  assert.equal(state.profile, undefined);
});

test('저장한 상태를 다시 읽는다', () => {
  const storage = memoryStorage();
  const state = { ...initialState(TODAY), intro: false };
  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage, TODAY).state, state);
});

test('저장소를 쓸 수 없으면 예외 없이 메모리로 동작한다', () => {
  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  assert.equal(loadState(broken, TODAY).persistent, false);
  assert.equal(loadState(null, TODAY).persistent, false);
  assert.equal(saveState(broken, initialState(TODAY)), false);
  assert.equal(saveState(null, initialState(TODAY)), false);
});

test('망가진 데이터는 덮어쓰기 전에 원본을 남긴다', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{깨진 JSON' });
  const { state } = loadState(storage, TODAY);
  assert.ok(Array.isArray(state.tasks));
  assert.equal(storage.data[`${STORAGE_KEY}:corrupt`], '{깨진 JSON');
});

test('형식이 틀린 항목만 걸러내고 원본을 남긴다', () => {
  const raw = JSON.stringify({ lists: [], tasks: [task({ id: 'ok' }), { title: 1 }] });
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  assert.deepEqual(loadState(storage, TODAY).state.tasks.map((t) => t.id), ['ok']);
  assert.equal(storage.data[`${STORAGE_KEY}:corrupt`], raw);
});
