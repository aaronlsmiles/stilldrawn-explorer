// The grease-pencil keeper loop from the studio site concept: gold marks what is selected.
export function Keep() {
  return (
    <svg className="keepmark" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M8 33 C 6 14, 40 4, 62 6 C 86 8, 97 20, 93 36 C 89 52, 52 58, 30 54 C 12 51, 4 43, 9 30 C 12 22, 22 16, 34 13" />
    </svg>
  );
}

export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" width="20" height="20" aria-hidden="true" focusable="false">
      <rect x="9" y="10" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M6 15c1-6 9-9 15-8 6 1 7 7 5 11-2 5-10 7-15 5-4-1-6-4-5-8" fill="none" stroke="var(--gold-line)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
