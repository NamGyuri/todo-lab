import { listIconName } from './tasks.js';

// 연필, 휴지통(Lucide)과 같은 규격. 네 아이콘 모두 3~21 안에 그려 크기와 무게감을 맞춘다.
const PATHS = {
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 13h18" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 20.5V10" />
      <path d="M12 14.5C12 10.5 9 8 3.5 8c0 4.5 3 7 8.5 6.5z" />
      <path d="M12 10.5c0-4 3-7 8.5-7 0 4.5-3 7.5-8.5 7z" />
      <path d="M7.5 20.5h9" />
    </>
  ),
  folder: <path d="M3 7a2.5 2.5 0 0 1 2.5-2.5h3.8a1.5 1.5 0 0 1 1.2.6l1.5 1.9h7A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />,
};

export default function ListIcon({ list, size = 18 }) {
  const name = listIconName(list);
  return (
    <svg
      className={`lucide list-icon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
