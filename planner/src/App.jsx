import {
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ListTodo,
  Menu,
  Pencil,
  Plus,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ListIcon from './ListIcon.jsx';
import {
  STORAGE_KEY,
  addDays,
  combinedLabel,
  createTask,
  dateKey,
  dateLabel,
  WEEKDAYS,
  dayStatus,
  dayTasks,
  dayTitle,
  deletedLabel,
  doneLast,
  groupByDate,
  homeView,
  loadState,
  monthGrid,
  parseState,
  remainingCount,
  saveState,
  shortDate,
  viewTasks,
} from './tasks.js';

const VIEWS = [
  { id: 'all', name: 'All', icon: ListTodo, empty: '할 일이 없습니다.' },
  { id: 'today', name: 'Today', icon: Sun, empty: '오늘 할 일이 없습니다.' },
  { id: 'upcoming', name: 'Upcoming', icon: CalendarDays, empty: '앞으로 예정된 할 일이 없습니다.' },
  { id: 'completed', name: 'Completed', icon: CheckCircle2, empty: '아직 완료한 할 일이 없습니다.' },
  { id: 'trash', name: 'Trash', icon: Trash2, empty: '휴지통이 비어 있어요' },
];
const viewName = (id) => VIEWS.find((v) => v.id === id).name;
const TOAST_MS = 3000;
const ICON_SIZE = 18;

// 서랍 공통 동작: 열리면 닫기 버튼으로, 닫히면 연 버튼으로 포커스를 옮기고 Esc로 닫는다.
function useDrawer(open, close) {
  const trigger = useRef(null);
  const closeButton = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return { trigger, closeButton };
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onDismiss }) {
  const dialog = useRef(null);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="confirm"
      aria-labelledby="confirm-title"
      onClose={onDismiss}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="confirm-body">
      <h2 id="confirm-title" className="confirm-title">
        {title}
      </h2>
      <p>{message}</p>
      <div className="confirm-actions">
        {/* 처음 포커스가 취소에 오도록 먼저 둔다. */}
        <button className="button outline" type="button" onClick={() => dialog.current.close()}>
          취소
        </button>
        <button
          className="button danger"
          type="button"
          onClick={() => {
            dialog.current.close();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
      </div>
    </dialog>
  );
}

// 순서가 바뀐 줄을 이전 자리에서 새 자리로 움직인다. ul의 자식이 tasks와 같은 순서라고 가정한다.
function useReorderMotion(tasks) {
  const list = useRef(null);
  const previous = useRef(new Map());
  const previousOrder = useRef('');

  useLayoutEffect(() => {
    const rows = [...list.current.children];
    const order = tasks.map((t) => t.id).join();
    const tops = new Map(tasks.map((t, i) => [t.id, rows[i].offsetTop]));
    const animate = order !== previousOrder.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate) {
      tasks.forEach((t, i) => {
        const from = previous.current.get(t.id);
        const distance = from === undefined ? 0 : from - tops.get(t.id);
        if (distance) {
          rows[i].animate([{ transform: `translateY(${distance}px)` }, { transform: 'none' }], {
            duration: 200,
            easing: 'ease-out',
          });
        }
      });
    }
    previous.current = tops;
    previousOrder.current = order;
  });

  return list;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultDate(view, today) {
  if (view === 'all') return null;
  return view === 'upcoming' ? addDays(today, 1) : today;
}

function Dropdown({ icon, label, value, children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const panel = root.current.querySelector('.dropdown-panel');
    (panel.querySelector('[aria-pressed="true"]') ?? panel.querySelector('button'))?.focus();
    const onPointerDown = (e) => {
      if (!root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      className="dropdown"
      ref={root}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.stopPropagation(); // 수정 폼 안에서는 메뉴만 닫고 수정은 유지한다.
          close();
        }
      }}
      onBlur={(e) => {
        if (e.relatedTarget && !root.current.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="dropdown-trigger"
        type="button"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span className="dropdown-value">{value}</span>
        <ChevronDown size={ICON_SIZE} aria-hidden="true" />
      </button>
      {open && (
        <div className="dropdown-panel" role="group" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

function Option({ selected, onClick, children }) {
  return (
    <button className="dropdown-option" type="button" aria-pressed={selected} onClick={onClick}>
      <span className="option-label">{children}</span>
      {selected && <Check size={ICON_SIZE} aria-hidden="true" />}
    </button>
  );
}

function CustomDate({ value, today, onConfirm }) {
  const [draft, setDraft] = useState(value ?? today);
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);
  const valid = draft.length === 10;
  const confirm = () => {
    if (valid) onConfirm(draft);
  };
  return (
    <div className="custom-date">
      <input
        ref={input}
        className="field"
        type="date"
        max="9999-12-31"
        aria-label="날짜 직접 선택"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault(); // 메뉴를 닫기만 하고 할 일 추가 폼은 제출하지 않는다.
          confirm();
        }}
      />
      <button className="button primary" type="button" disabled={!valid} onClick={confirm}>
        확인
      </button>
    </div>
  );
}

function DateField({ value, onChange, today }) {
  return (
    <Dropdown icon={<Calendar size={ICON_SIZE} aria-hidden="true" />} label="날짜" value={dateLabel(value, today)}>
      {(close) => <DateOptions value={value} onChange={onChange} today={today} close={close} />}
    </Dropdown>
  );
}

// 메뉴가 닫히면 언마운트되어 직접 선택 입력칸도 함께 초기화된다.
function DateOptions({ value, onChange, today, close }) {
  const tomorrow = addDays(today, 1);
  const [custom, setCustom] = useState(false);
  const isCustom = value !== null && value !== today && value !== tomorrow;
  const pick = (next) => {
    onChange(next);
    close();
  };
  return (
    <>
      <Option selected={value === today} onClick={() => pick(today)}>오늘</Option>
      <Option selected={value === tomorrow} onClick={() => pick(tomorrow)}>내일</Option>
      <Option selected={isCustom} onClick={() => setCustom(true)}>직접 선택</Option>
      {custom && <CustomDate value={value} today={today} onConfirm={pick} />}
      <Option selected={value === null} onClick={() => pick(null)}>날짜 없음</Option>
    </>
  );
}

function ListSelect({ lists, value, onChange }) {
  const current = lists.find((l) => l.id === value);
  return (
    <Dropdown icon={<ListIcon list={current} />} label="리스트" value={current?.name ?? '리스트 없음'}>
      {(close) =>
        lists.map((l) => (
          <Option
            key={l.id}
            selected={l.id === value}
            onClick={() => {
              onChange(l.id);
              close();
            }}
          >
            <ListIcon list={l} />
            {l.name}
          </Option>
        ))
      }
    </Dropdown>
  );
}

// 좁은 화면에서 날짜·리스트 선택을 대신한다. 보이는 폭은 CSS 미디어 쿼리가 정한다.
function CombinedPicker({ date, setDate, listId, setListId, lists, today }) {
  const [open, setOpen] = useState(false);
  const list = lists.find((l) => l.id === listId);
  return (
    <>
      <div className="form-combined">
        <button
          className="combined-trigger"
          type="button"
          aria-label={combinedLabel(date, list, today)}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Calendar size={ICON_SIZE} aria-hidden="true" />
          <span className="combined-date">{shortDate(date, today)}</span>
          <span aria-hidden="true">·</span>
          <ListIcon list={list} />
          <ChevronDown size={ICON_SIZE} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <PickerSheet
          date={date}
          setDate={setDate}
          listId={listId}
          setListId={setListId}
          lists={lists}
          today={today}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PickerSheet({ date, setDate, listId, setListId, lists, today, onClose }) {
  const dialog = useRef(null);
  const tomorrow = addDays(today, 1);
  const [custom, setCustom] = useState(false);
  const input = useRef(null);
  const isCustom = date !== null && date !== today && date !== tomorrow;

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    if (custom) input.current?.focus();
  }, [custom]);

  const pick = (next) => {
    setCustom(false);
    setDate(next);
  };

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-label="날짜와 리스트 선택"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
      onKeyDown={(e) => {
        // 시트가 수정 폼 안에 있어 Esc가 수정까지 취소하지 않게 막는다.
        if (e.key === 'Escape') e.stopPropagation();
      }}
    >
      <div className="sheet-body">
        <h2 className="sheet-title">날짜</h2>
        <Option selected={date === today} onClick={() => pick(today)}>오늘</Option>
        <Option selected={date === tomorrow} onClick={() => pick(tomorrow)}>내일</Option>
        <Option selected={isCustom} onClick={() => setCustom(true)}>직접 선택</Option>
        {custom && (
          <div className="custom-date">
            <input
              ref={input}
              className="field"
              type="date"
              max="9999-12-31"
              aria-label="날짜 직접 선택"
              value={date ?? ''}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault(); // 바깥 폼을 제출하지 않는다.
              }}
            />
          </div>
        )}
        <Option selected={date === null} onClick={() => pick(null)}>날짜 없음</Option>

        <h2 className="sheet-title">리스트</h2>
        {lists.map((l) => (
          <Option key={l.id} selected={l.id === listId} onClick={() => setListId(l.id)}>
            <ListIcon list={l} />
            {l.name}
          </Option>
        ))}

        <button className="button primary sheet-done" type="button" onClick={() => dialog.current.close()}>
          완료
        </button>
      </div>
    </dialog>
  );
}

function Composer({ date, setDate, lists, today, onAdd }) {
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState(lists[0]?.id ?? '');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd({ title: trimmed, date, listId });
    setTitle('');
  };

  return (
    <form className="composer" onSubmit={submit}>
      <input
        className="field"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="새 할 일을 입력하세요"
        aria-label="새 할 일"
      />
      <div className="form-footer">
        <CombinedPicker date={date} setDate={setDate} listId={listId} setListId={setListId} lists={lists} today={today} />
        <div className="form-options">
          <DateField value={date} onChange={setDate} today={today} />
          <ListSelect lists={lists} value={listId} onChange={setListId} />
        </div>
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={!title.trim()}>
            <Plus size={18} aria-hidden="true" />
            추가
          </button>
        </div>
      </div>
    </form>
  );
}

function TaskCheck({ task, onToggle }) {
  const input = useRef(null);
  const refocus = useRef(false);

  // 줄이 옮겨지면 DOM 이동으로 포커스가 풀려 키보드 사용자가 자리를 잃는다.
  useLayoutEffect(() => {
    if (refocus.current) input.current.focus({ preventScroll: true });
    refocus.current = false;
  }, [task.done]);

  return (
    <label className="check">
      <input
        ref={input}
        type="checkbox"
        checked={task.done}
        onChange={() => {
          refocus.current = true;
          onToggle(task);
        }}
        aria-label={`${task.title} ${task.done ? '완료 취소' : '완료'}`}
      />
      <span className="check-box" aria-hidden="true">
        {task.done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      </span>
    </label>
  );
}

function TaskRow({ task, lists, today, trashed, grouped, onToggle, onSave, onDelete, onRestore, onPurge }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const editButton = useRef(null);
  const wasEditing = useRef(false);
  const list = lists.find((l) => l.id === task.listId);
  let dateTone = '';
  if (!task.done && !trashed && task.date === today) dateTone = ' chip-today';
  if (!task.done && !trashed && task.date && task.date < today) dateTone = ' chip-late';

  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const startEdit = () => {
    setDraft({ title: task.title, date: task.date, listId: task.listId });
    setEditing(true);
  };

  const save = (e) => {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    setEditing(false);
    onSave(task.id, { ...draft, title });
  };

  if (editing) {
    return (
      <li className="task editing">
        <form
          className="edit-form"
          onSubmit={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
        >
          <input
            className="field"
            autoFocus
            aria-label="할 일 제목"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="form-footer">
            <CombinedPicker
              date={draft.date}
              setDate={(date) => setDraft((d) => ({ ...d, date }))}
              listId={draft.listId}
              setListId={(listId) => setDraft((d) => ({ ...d, listId }))}
              lists={lists}
              today={today}
            />
            <div className="form-options">
              <DateField value={draft.date} onChange={(date) => setDraft({ ...draft, date })} today={today} />
              <ListSelect lists={lists} value={draft.listId} onChange={(listId) => setDraft({ ...draft, listId })} />
            </div>
            <div className="form-actions">
              <button className="button outline" type="button" onClick={() => setEditing(false)}>
                취소
              </button>
              <button className="button primary" type="submit" disabled={!draft.title.trim()}>
                저장
              </button>
            </div>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`task${task.done ? ' done' : ''}${trashed ? ' trashed' : ''}`}>
      {!trashed && <TaskCheck task={task} onToggle={onToggle} />}
      <div className="task-body">
        <p className="task-title" onDoubleClick={trashed ? undefined : startEdit}>
          {task.title}
        </p>
        <p className="task-meta">
          {list && (
            <span className="chip">
              <ListIcon list={list} size={14} />
              {list.name}
            </span>
          )}
          {!grouped && <span className={`chip${dateTone}`}>{dateLabel(task.date, today)}</span>}
          {trashed && <span className="deleted-at">{deletedLabel(task.deletedAt)}</span>}
        </p>
      </div>
      {trashed && (
        <div className="trash-actions">
          <button className="button outline small" type="button" onClick={() => onRestore(task)} aria-label={`${task.title} 복원`}>
            복원
          </button>
          <button className="button text-danger small" type="button" onClick={() => onPurge(task)} aria-label={`${task.title} 완전 삭제`}>
            완전 삭제
          </button>
        </div>
      )}
      {!trashed && (
        <div className="task-actions">
          <button ref={editButton} className="icon-button" type="button" onClick={startEdit} aria-label={`${task.title} 수정`}>
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => onDelete(task)} aria-label={`${task.title} 삭제`}>
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

function TaskList({ tasks, ...rowProps }) {
  const list = useReorderMotion(tasks);
  return (
    <ul ref={list} className="task-list">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} {...rowProps} />
      ))}
    </ul>
  );
}

function DayTasks({ tasks, lists, onToggleTask }) {
  const list = useReorderMotion(tasks);
  return (
    <ul ref={list} className="day-tasks">
      {tasks.map((task) => {
        const taskList = lists.find((l) => l.id === task.listId);
        return (
          <li key={task.id} className={task.done ? 'day-task done' : 'day-task'}>
            <TaskCheck task={task} onToggle={onToggleTask} />
            <span className="day-task-title" title={task.title}>
              {task.title}
            </span>
            {taskList && (
              <span className="chip">
                <ListIcon list={taskList} size={14} />
                {taskList.name}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CalendarPanel({ tasks, lists, today, selected, onSelect, onToggleTask, open, onClose, closeRef, inert }) {
  const [year, month] = today.split('-').map(Number);
  const items = doneLast(dayTasks(tasks, selected));

  return (
    <aside id="calendar-panel" className={open ? 'panel open' : 'panel'} aria-label="달력과 날짜별 할 일" inert={inert}>
      <div className="panel-head">
        <h2 className="calendar-title">
          {year}년 {month}월
        </h2>
        <button ref={closeRef} className="icon-button" type="button" aria-label="달력 닫기" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div>
        {/* CSS로 flex 배치를 하면 표 의미가 사라지는 브라우저가 있어 role을 직접 준다. */}
        <table className="calendar" role="table">
          <thead role="rowgroup">
            <tr role="row">
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" role="columnheader">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {monthGrid(today).map((week, i) => (
              <tr key={i} role="row">
                {week.map((key, j) => {
                  if (!key) return <td key={j} role="cell" />;
                  const status = dayStatus(tasks, key);
                  const classes = ['cal-day'];
                  if (key === selected) classes.push('selected');
                  if (key === today) classes.push('today');
                  const note = status && (status === 'done' ? ', 모두 완료' : ', 할 일 있음');
                  return (
                    <td key={key} role="cell">
                      <button
                        type="button"
                        className={classes.join(' ')}
                        aria-label={`${dayTitle(key)}${note || ''}`}
                        aria-pressed={key === selected}
                        aria-current={key === today ? 'date' : undefined}
                        onClick={() => onSelect(key)}
                      >
                        {Number(key.slice(8))}
                      </button>
                      <span className={status ? `cal-dot ${status}` : 'cal-dot'} aria-hidden="true" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <section className="day-list" aria-label="선택한 날짜의 할 일">
          <div className="day-head" aria-live="polite">
            <h3 className="day-title">{dayTitle(selected)}</h3>
            <span className="day-count">{items.length}개</span>
          </div>
          {items.length === 0 ? (
            <p className="day-empty">이 날은 할 일이 없어요</p>
          ) : (
            <DayTasks key={selected} tasks={items} lists={lists} onToggleTask={onToggleTask} />
          )}
        </section>
      </div>
    </aside>
  );
}

function todayPercent(tasks, today) {
  const items = dayTasks(tasks, today);
  return items.length ? Math.round((items.filter((t) => t.done).length / items.length) * 100) : 0;
}

export default function App() {
  const today = dateKey();
  const [data, setData] = useState(() => loadState(getStorage(), today).state);
  const [saved, setSaved] = useState(true);
  const [view, setView] = useState('today');
  const [status, setStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState(null);
  const viewTitle = useRef(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [composerDate, setComposerDate] = useState(() => defaultDate('today', today));
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeCalendar = useCallback(() => setCalendarOpen(false), []);
  const menuDrawer = useDrawer(menuOpen, closeMenu);
  const calendarDrawer = useDrawer(calendarOpen, closeCalendar);
  const drawerOpen = menuOpen || calendarOpen;

  useEffect(() => {
    setSaved(saveState(getStorage(), data));
  }, [data]);

  // 다른 탭의 변경을 받지 않으면 이 탭의 다음 저장이 그 내용을 지운다.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        setData(parseState(e.newValue).state);
      } catch {
        // 형식이 틀린 값은 무시하고 현재 상태를 유지한다.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 서랍을 연 채 창을 넓히면 본문이 inert로 남지 않게 닫는다.
  useEffect(() => {
    const queries = [
      [window.matchMedia('(min-width: 841px)'), closeMenu],
      [window.matchMedia('(min-width: 1280px)'), closeCalendar],
    ];
    queries.forEach(([q, close]) => q.addEventListener('change', close));
    return () => queries.forEach(([q, close]) => q.removeEventListener('change', close));
  }, [closeMenu, closeCalendar]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const updateTask = (id, patch) =>
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  const selectView = (id) => {
    setView(id);
    setComposerDate(defaultDate(id, today));
    if (id === 'today') setSelectedDate(today);
    setStatus('');
    setMenuOpen(false);
  };

  const add = (fields) => {
    const task = createTask(fields);
    setData((d) => ({ ...d, tasks: [task, ...d.tasks] }));
    const shown = viewTasks([task], view, today).length > 0;
    setStatus(`"${task.title}"을(를) ${shown ? '' : `${viewName(homeView(task, today))}에 `}추가했습니다.`);
  };

  const toggle = (task) => {
    const done = !task.done;
    updateTask(task.id, { done, doneAt: done ? new Date().toISOString() : null });
  };

  const save = (id, fields) => {
    updateTask(id, { ...fields, sample: false }); // 고친 예시는 방문자의 할 일이므로 "예시 지우기"에서 보호한다.
    const moved = { ...data.tasks.find((t) => t.id === id), ...fields };
    const stays = viewTasks([moved], view, today).length > 0;
    setStatus(stays ? '수정했습니다.' : `수정한 할 일을 ${viewName(homeView(moved, today))}로 옮겼습니다.`);
  };

  const remove = (task) => {
    updateTask(task.id, { deletedAt: new Date().toISOString() });
    setStatus(`"${task.title}"을(를) 휴지통으로 옮겼습니다.`);
  };

  const selectDate = (key) => {
    setSelectedDate(key);
    setComposerDate(key);
  };

  // 처리한 줄이 사라져 포커스를 잃으므로 제목으로 옮긴다.
  const restore = (task) => {
    updateTask(task.id, { deletedAt: null });
    setStatus('');
    setToast('복원했어요');
    viewTitle.current?.focus();
  };

  const purge = (task) =>
    setConfirm({
      title: `"${task.title}"을(를) 완전히 삭제할까요?`,
      message: '삭제하면 되돌릴 수 없어요.',
      confirmLabel: '완전 삭제',
      onConfirm: () => {
        setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }));
        setStatus('완전히 삭제했어요.');
        viewTitle.current?.focus();
      },
    });

  const emptyTrash = () =>
    setConfirm({
      title: `휴지통의 할 일 ${visible.length}개를 완전히 삭제할까요?`,
      message: '삭제하면 되돌릴 수 없어요.',
      confirmLabel: '휴지통 비우기',
      onConfirm: () => {
        setData((d) => ({ ...d, tasks: d.tasks.filter((t) => !t.deletedAt) }));
        setStatus('휴지통을 비웠어요.');
        viewTitle.current?.focus();
      },
    });

  const clearSamples = () => {
    setData((d) => ({ ...d, intro: false, tasks: d.tasks.filter((t) => !t.sample) }));
    setStatus('예시 할 일을 지웠습니다.');
  };

  const visible = viewTasks(data.tasks, view, today);
  const current = VIEWS.find((v) => v.id === view);
  const trashed = view === 'trash';
  const percent = todayPercent(data.tasks, today);
  const renderTasks = (tasks, grouped) => (
    <TaskList
      tasks={trashed ? tasks : doneLast(tasks)}
      lists={data.lists}
      today={today}
      trashed={trashed}
      grouped={grouped}
      onToggle={toggle}
      onSave={save}
      onDelete={remove}
      onRestore={restore}
      onPurge={purge}
    />
  );

  return (
    <div className="app">
      <header className="topbar" inert={drawerOpen}>
        <button
          ref={menuDrawer.trigger}
          className="icon-button"
          type="button"
          aria-label="메뉴 열기"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className="brand">To-Do List</span>
      </header>

      {drawerOpen && (
        <div
          className="backdrop"
          onClick={() => {
            closeMenu();
            closeCalendar();
          }}
        />
      )}

      <aside id="sidebar" className={menuOpen ? 'sidebar open' : 'sidebar'} inert={calendarOpen}>
        <div className="sidebar-head">
          <span className="brand">To-Do List</span>
          <button ref={menuDrawer.closeButton} className="icon-button drawer-close" type="button" aria-label="메뉴 닫기" onClick={closeMenu}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="보기">
          <ul className="nav-list">
            {VIEWS.map(({ id, name, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  className={view === id ? 'nav-row active' : 'nav-row'}
                  aria-current={view === id ? 'page' : undefined}
                  onClick={() => selectView(id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {name}
                  {remainingCount(data.tasks, id, today) > 0 && (
                    <span className="nav-count">{remainingCount(data.tasks, id, today)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <CalendarPanel
        tasks={data.tasks}
        lists={data.lists}
        today={today}
        selected={selectedDate}
        onSelect={selectDate}
        onToggleTask={toggle}
        open={calendarOpen}
        onClose={closeCalendar}
        closeRef={calendarDrawer.closeButton}
        inert={menuOpen}
      />

      <main className="main" inert={drawerOpen}>
        <p className="greeting-hello">안녕하세요!</p>
        <div className="greeting-row">
          <h1 className="greeting-title">오늘 할 일 {remainingCount(data.tasks, 'today', today)}개</h1>
          <span className="progress-percent">{percent}%</span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="오늘 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>

        {!saved && (
          <p className="notice" role="alert">
            이 브라우저에는 저장할 수 없습니다. 창을 닫으면 지금 입력한 할 일이 사라집니다.
          </p>
        )}

        {data.intro && (
          <section className="intro" aria-label="처음 사용 안내">
            <p>
              할 일은 이 브라우저에만 자동으로 저장됩니다. 로그인도 서버도 필요 없습니다. 아래 할 일은 예시입니다.
            </p>
            <div className="intro-actions">
              <button className="button primary" type="button" onClick={clearSamples}>
                예시 지우기
              </button>
              <button className="button outline" type="button" onClick={() => setData((d) => ({ ...d, intro: false }))}>
                안내 닫기
              </button>
            </div>
          </section>
        )}

        <div className="view-head">
          <h2 ref={viewTitle} className="view-title" tabIndex={-1}>
            {current.name}
          </h2>
          {trashed && visible.length > 0 && (
            <button className="button text-danger small" type="button" onClick={emptyTrash}>
              휴지통 비우기
            </button>
          )}
        </div>

        {view !== 'completed' && view !== 'trash' && (
          <Composer date={composerDate} setDate={setComposerDate} lists={data.lists} today={today} onAdd={add} />
        )}

        <p className="status" role="status">
          {status}
        </p>

        {visible.length === 0 ? (
          <p className="empty">{current.empty}</p>
        ) : view === 'all' ? (
          groupByDate(visible).map((group) => (
            <section key={group.date ?? 'none'} className="task-group">
              <h3 className="group-title">{dateLabel(group.date, today)}</h3>
              {renderTasks(group.tasks, true)}
            </section>
          ))
        ) : (
          <div key={view}>{renderTasks(visible, false)}</div>
        )}
      </main>

      <button
        ref={calendarDrawer.trigger}
        className="calendar-fab"
        type="button"
        aria-label="달력 열기"
        aria-expanded={calendarOpen}
        aria-controls="calendar-panel"
        inert={drawerOpen}
        onClick={() => setCalendarOpen(true)}
      >
        <Calendar size={24} aria-hidden="true" />
      </button>

      {/* 안내가 읽히려면 이 영역이 먼저 화면에 있어야 한다. */}
      <div className="toast-region" aria-live="polite">
        {toast && <p className="toast">{toast}</p>}
      </div>

      {confirm && <ConfirmDialog {...confirm} onDismiss={() => setConfirm(null)} />}
    </div>
  );
}
