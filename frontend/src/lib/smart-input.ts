import {
  addDays,
  nextMonday, nextTuesday, nextWednesday, nextThursday,
  nextFriday, nextSaturday, nextSunday,
  format,
  parse,
  isValid,
  startOfToday,
} from "date-fns"

export interface ParsedInput {
  title: string
  dueDate: string | null      // YYYY-MM-DD
  dueDateLabel: string | null  // "Tomorrow", "Next Friday", etc.
  listTag: string | null       // raw tag without #
}

// ── Date patterns ──────────────────────────────────────────────────────────

const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
const DAY_SHORT = ["sun","mon","tue","wed","thu","fri","sat"]

const MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december"
]
const MONTH_SHORT = [
  "jan","feb","mar","apr","may","jun",
  "jul","aug","sep","oct","nov","dec"
]

const NEXT_DAY_FNS: Record<string, (d: Date) => Date> = {
  monday: nextMonday, tuesday: nextTuesday, wednesday: nextWednesday,
  thursday: nextThursday, friday: nextFriday, saturday: nextSaturday,
  sunday: nextSunday,
}

interface DateMatch {
  date: Date
  label: string
  start: number
  end: number
}

function findDate(text: string): DateMatch | null {
  const lower = text.toLowerCase()
  const today = startOfToday()

  // ── "today" ──
  const todayMatch = /\b(today)\b/i.exec(lower)
  if (todayMatch) {
    return { date: today, label: "Today", start: todayMatch.index, end: todayMatch.index + todayMatch[0].length }
  }

  // ── "tomorrow" / "tmr" / "tmrw" ──
  const tmrMatch = /\b(tomorrow|tmr|tmrw)\b/i.exec(lower)
  if (tmrMatch) {
    return { date: addDays(today, 1), label: "Tomorrow", start: tmrMatch.index, end: tmrMatch.index + tmrMatch[0].length }
  }

  // ── "in N days/weeks" ──
  const inMatch = /\bin\s+(\d+)\s+(days?|weeks?)\b/i.exec(lower)
  if (inMatch) {
    const n = parseInt(inMatch[1])
    const unit = inMatch[2].toLowerCase().startsWith("w") ? 7 : 1
    const d = addDays(today, n * unit)
    const label = unit === 7
      ? `In ${n} week${n > 1 ? "s" : ""}`
      : `In ${n} day${n > 1 ? "s" : ""}`
    return { date: d, label, start: inMatch.index, end: inMatch.index + inMatch[0].length }
  }

  // ── "next monday", "next fri", etc. ──
  const nextDayMatch = /\b(next)\s+(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i.exec(lower)
  if (nextDayMatch) {
    const dayInput = nextDayMatch[2].toLowerCase()
    let fullDay = DAY_NAMES.find(d => d.startsWith(dayInput.slice(0, 3)))
    if (fullDay && NEXT_DAY_FNS[fullDay]) {
      const d = NEXT_DAY_FNS[fullDay](today)
      // "next" means the one after this coming one
      const dNext = NEXT_DAY_FNS[fullDay](d)
      const label = `Next ${fullDay.charAt(0).toUpperCase() + fullDay.slice(1)}`
      return { date: dNext, label, start: nextDayMatch.index, end: nextDayMatch.index + nextDayMatch[0].length }
    }
  }

  // ── "monday", "friday", "wed" (this coming one) ──
  const dayMatch = /\b(on\s+)?(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i.exec(lower)
  if (dayMatch) {
    const prefix = dayMatch[1] || ""
    const dayInput = dayMatch[2].toLowerCase()
    let fullDay = DAY_NAMES.find(d => d.startsWith(dayInput.slice(0, 3)))
    if (fullDay && NEXT_DAY_FNS[fullDay]) {
      const d = NEXT_DAY_FNS[fullDay](today)
      const label = fullDay.charAt(0).toUpperCase() + fullDay.slice(1)
      return { date: d, label, start: dayMatch.index, end: dayMatch.index + prefix.length + dayMatch[2].length }
    }
  }

  // ── "by friday", "by next week", "by tomorrow" (treat "by" as prefix to strip) ──
  const byMatch = /\bby\s+/i.exec(lower)
  if (byMatch) {
    const rest = text.slice(byMatch.index + byMatch[0].length)
    const sub = findDate(rest)
    if (sub) {
      return {
        date: sub.date,
        label: sub.label,
        start: byMatch.index,
        end: byMatch.index + byMatch[0].length + sub.end,
      }
    }
  }

  // ── "Jan 15", "March 3", "Dec 25" ──
  const monthDayMatch = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(lower)
  if (monthDayMatch) {
    const monthInput = monthDayMatch[1].toLowerCase()
    const monthIdx = MONTH_SHORT.findIndex(m => monthInput.startsWith(m))
    const day = parseInt(monthDayMatch[2])
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      let year = today.getFullYear()
      let d = new Date(year, monthIdx, day)
      // If date is in the past, use next year
      if (d < today) d = new Date(year + 1, monthIdx, day)
      const label = `${MONTH_NAMES[monthIdx].charAt(0).toUpperCase() + MONTH_NAMES[monthIdx].slice(1)} ${day}`
      return { date: d, label, start: monthDayMatch.index, end: monthDayMatch.index + monthDayMatch[0].length }
    }
  }

  // ── "12/25", "1/15" (MM/DD) ──
  const slashMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(lower)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]) - 1
    const d = parseInt(slashMatch[2])
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      let year = today.getFullYear()
      let date = new Date(year, m, d)
      if (date < today) date = new Date(year + 1, m, d)
      const label = format(date, "MMM d")
      return { date, label, start: slashMatch.index, end: slashMatch.index + slashMatch[0].length }
    }
  }

  return null
}

// ── List tag pattern: #listname ────────────────────────────────────────────

function findListTag(text: string): { tag: string; start: number; end: number } | null {
  const match = /#([a-zA-Z0-9_-]+)\b/.exec(text)
  if (!match) return null
  return {
    tag: match[1],
    start: match.index,
    end: match.index + match[0].length,
  }
}

// ── Main parser ────────────────────────────────────────────────────────────

export function parseSmartInput(text: string): ParsedInput {
  let remaining = text
  let dueDate: string | null = null
  let dueDateLabel: string | null = null
  let listTag: string | null = null

  // Extract list tag first
  const tagResult = findListTag(remaining)
  if (tagResult) {
    listTag = tagResult.tag
    remaining = remaining.slice(0, tagResult.start) + remaining.slice(tagResult.end)
  }

  // Extract date
  const dateResult = findDate(remaining)
  if (dateResult) {
    dueDate = format(dateResult.date, "yyyy-MM-dd")
    dueDateLabel = dateResult.label
    remaining = remaining.slice(0, dateResult.start) + remaining.slice(dateResult.end)
  }

  // Clean up title
  const title = remaining
    .replace(/\s{2,}/g, " ")  // collapse multiple spaces
    .replace(/^\s+|\s+$/g, "") // trim
    .replace(/^[-–—]\s*/, "")  // strip leading dashes

  return { title, dueDate, dueDateLabel, listTag }
}
