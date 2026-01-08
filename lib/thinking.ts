export type ThinkSplitResult = {
  thinking: string;
  answer: string;
  hasThink: boolean;
  isThinkingOpen: boolean;
};

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

/**
 * Split model output that uses <think>...</think> into thinking + answer parts.
 * - Supports multiple think blocks
 * - Handles streaming/incomplete output (missing </think>)
 */
export function splitThinkTags(input: string): ThinkSplitResult {
  if (!input) {
    return { thinking: "", answer: "", hasThink: false, isThinkingOpen: false };
  }

  const lower = input.toLowerCase();

  // Fast path: no <think>
  if (!lower.includes(OPEN_TAG)) {
    return {
      thinking: "",
      answer: input.trim(),
      hasThink: false,
      isThinkingOpen: false,
    };
  }

  const thinkingParts: string[] = [];
  const answerParts: string[] = [];
  let pos = 0;
  let inThinking = false;

  while (pos < input.length) {
    if (!inThinking) {
      const openIndex = lower.indexOf(OPEN_TAG, pos);
      if (openIndex === -1) {
        answerParts.push(input.slice(pos));
        break;
      }
      answerParts.push(input.slice(pos, openIndex));
      pos = openIndex + OPEN_TAG.length;
      inThinking = true;
      continue;
    }

    const closeIndex = lower.indexOf(CLOSE_TAG, pos);
    if (closeIndex === -1) {
      // Streaming/incomplete: treat the rest as thinking.
      thinkingParts.push(input.slice(pos));
      pos = input.length;
      break;
    }
    thinkingParts.push(input.slice(pos, closeIndex));
    pos = closeIndex + CLOSE_TAG.length;
    inThinking = false;
  }

  return {
    thinking: thinkingParts.join("").trim(),
    answer: answerParts.join("").trim(),
    hasThink: true,
    isThinkingOpen: inThinking,
  };
}

