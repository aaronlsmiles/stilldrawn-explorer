// "In plain words": the explorer's story for a bright 12-year-old, or for anyone new to the field.
// Additive: it never edits the page's own copy. The method is the hub's docs/plain-words.md.
// Every digit here comes from the data contract, and labels from the page appear only in
// quotes; words.test.ts holds both rules, the reading level and /rate's blinding.

export type Chapter = { path: string; title: string; band: string[] };

/** The trail, in reading order: "Next" walks it. */
export const CHAPTERS: Chapter[] = [
  {
    path: "/explore",
    title: "What this is",
    band: [
      "Here's what I was poking at.",
      "Artists draw pictures in ink. Some computer programs can now take a still picture and make it move, like a tiny film.",
      "I gave five of these programs the same ink drawings. I asked each one to make the drawing move, but to keep it exactly as it was drawn.",
      "There are 373 little films here in all. Pick any one to watch it beside the drawing it came from.",
    ],
  },
  {
    path: "/scatter",
    title: "The surprise",
    band: [
      "Here's the twist.",
      "The programs that kept the drawings neatest were the ones that barely moved them. Think of a statue. It never smudges, because it never moves.",
      "The busiest program moved about nine times as much as the stillest one, and its drawings wandered more too.",
      "So a top score for \"stayed the same\" can just mean \"hardly did anything\".",
    ],
  },
  {
    path: "/tax",
    title: "Being fair",
    band: [
      "So how do you judge fairly?",
      "A film is meant to move. If keeping still wins, the scores punish the programs that do the job.",
      "On this page you decide how much moving is worth. I call it the \"Stillness Tax\": a charge for standing still.",
      "Set the price, and watch who comes top.",
    ],
  },
  {
    path: "/rate",
    title: "Your turn",
    band: [
      "Now you be the judge.",
      "You'll score a few still drawings, then some short films made from them. For each film you answer two things. Does it still look drawn by hand? Is it still the same picture?",
      "You won't be told which program made which film, so nothing can sway you. Scientists call that a \"blind\" test.",
      "At the end, you'll see how your scores compare with the people who rated them first.",
    ],
  },
  {
    path: "/about",
    title: "Why it matters",
    band: [
      "Here's why I care.",
      "You'll often hear that one computer program is \"the best\". Always ask: best at what?",
      "A score that only rewards staying the same will reward doing nothing. So when someone ranks programs like these, I'd like them to show how much each one moved, right beside the score.",
      "Below is the full write-up, for people who work in this field. My blue notes walk you through it.",
    ],
  },
];

/** Pages off the trail: a band without a number, and a way back onto it. */
export const SIDE_ROOMS: Record<string, Chapter & { next: string }> = {
  "/explore/failures": {
    path: "/explore/failures",
    title: "The mistakes",
    next: "/scatter",
    band: [
      "When a program spoils a drawing, it tends to do it in a few familiar ways.",
      "The ink might go soft and smudgy, like paint. Things in the picture might turn into something else. Or the framing might slide, as if the camera wandered off.",
      "I sorted these by hand, watching films one frame at a time. Pick any picture to watch that film.",
    ],
  },
};

/** Notes pinned beside the parts that need them, by id. Each id is placed in exactly one view. */
export const NOTES = {
  "explore.grid": [
    "Each line of pictures is one drawing, moved one way. \"Idle\" is a gentle wiggle, \"Burst\" is a quick bit of action, and \"Camera push\" is a slow move in.",
    "Each program made its own film of it. The page calls the programs \"engines\".",
  ],
  "explore.player": [
    "Here's the drawing, and beside it the film a program made from it. When you compare two programs, you get two films.",
    "Press play and watch the lines. Do they stay put, or do they wobble and melt?",
    "Now press \"Difference\". The picture goes black wherever nothing changed. Anything bright has moved, or been drawn again.",
  ],
  "explore.curve": [
    "This line tracks how far the drawing's lines have wandered from where they were drawn. The page calls it \"line drift\".",
    "Think of tracing paper slowly slipping. Low and flat means the drawing held still. Climbing means it's drifting away.",
    "Drag along the line, and the film follows.",
  ],
  "explore.readouts": [
    "These are the checks on what each film kept: its lines, its dotty shading (called \"screentone\"), its edges, its style and its closed shapes.",
    "Smaller numbers mean the drawing changed less.",
    "If you see a red \"Departed\" label near the top, the lines wandered so far that the drawing counts as lost.",
  ],
  "scatter.chart": [
    "Each dot is one film. Further right means it moved more. Higher up means its lines wandered further.",
    "Each cross marks one program's typical film. See how the crosses climb from bottom left to top right? More moving, more wandering.",
  ],
  "tax.slider": [
    "Drag the slider. At zero, moving is worth nothing, and the stillest program comes top.",
    "Push it up, and moving starts to count. Watch the list below change places.",
    "There's no right price. That's the point: a ranking always has a price in it, whether or not anyone says so.",
  ],
  "rate.blind": [
    "Go with your eye. Nobody is marking you.",
    "Nothing about you is stored. Your answers are only sent if you choose to share them.",
  ],
  "about.explores": [
    "This part describes the explorer itself: the wall of little films, the line that tracks wandering, and the price slider.",
  ],
  "about.matters": [
    "This part is the proof. Programs that move more let their drawings wander more, nearly all the way down the list.",
    "One program barely moves at all, so there's hardly anything to wander.",
  ],
  "about.suggests": [
    "This part says what to do about it. There's no single fair price for moving.",
    "So scores like these should always show the movement beside them. Then you can see what a ranking costs.",
  ],
} satisfies Record<string, string[]>;

export type NoteId = keyof typeof NOTES;

/** /about's three sections, in order: a note sits before each h2. */
export const ABOUT_NOTES: NoteId[] = ["about.explores", "about.matters", "about.suggests"];

export const UI = {
  label: "In plain words",
  story: "The story",
  invite: "New to this?",
  follow: "Read it in plain words", // studionephele.com's invite says "New to this? Read it in plain words"
  notNow: "Not now",
  hide: "Hide plain words",
  toggle: "Plain words",
  next: "Next",
  again: "Back to the start",
  back: "On with the story",
  side: "a side room",
};
