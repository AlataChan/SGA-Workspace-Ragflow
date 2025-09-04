import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Locale from "./locales";

type Command = (param: string) => void;
interface Commands {
  fill?: Command;
  submit?: Command;
  mask?: Command;
  code?: Command;
  settings?: Command;
}

export function useCommand(commands: Commands = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!searchParams) return;

    let shouldUpdate = false;
    const newParams = new URLSearchParams(searchParams.toString());

    searchParams.forEach((param, name) => {
      const commandName = name as keyof Commands;
      if (typeof commands[commandName] === "function") {
        commands[commandName]!(param);
        newParams.delete(name);
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) {
      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      router.replace(newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, commands, router]);
}

interface ChatCommands {
  new?: Command;
  newm?: Command;
  next?: Command;
  prev?: Command;
  clear?: Command;
  fork?: Command;
  del?: Command;
}

// Compatible with Chinese colon character "："
export const ChatCommandPrefix = /^[:：]/;

export function useChatCommand(commands: ChatCommands = {}) {
  function extract(userInput: string) {
    const match = userInput.match(ChatCommandPrefix);
    if (match) {
      return userInput.slice(1) as keyof ChatCommands;
    }
    return userInput as keyof ChatCommands;
  }

  function search(userInput: string) {
    const input = extract(userInput);
    const desc = Locale.Chat.Commands;
    return Object.keys(commands)
      .filter((c) => c.startsWith(input))
      .map((c) => ({
        title: desc[c as keyof ChatCommands],
        content: ":" + c,
      }));
  }

  function match(userInput: string) {
    const command = extract(userInput);
    const matched = typeof commands[command] === "function";

    return {
      matched,
      invoke: () => matched && commands[command]!(userInput),
    };
  }

  return { match, search };
}
