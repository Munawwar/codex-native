import { getNativeBinding } from "./nativeBinding";
import type {
  NativeTuiRequest,
  NativeTuiExitInfo,
  NativeTokenUsage,
  NativeUpdateActionInfo,
  NativeUpdateActionKind,
  NativeTuiSession,
} from "./nativeBinding";

export interface TuiSession {
  wait(): Promise<NativeTuiExitInfo>;
  shutdown(): void;
  readonly closed: boolean;
}

export interface RunTuiOptions {
  signal?: AbortSignal;
}

/**
 * Starts the Codex TUI (Terminal User Interface) and returns a controllable session handle.
 *
 * Use {@link TuiSession.wait} to await completion or {@link TuiSession.shutdown} to
 * request a graceful exit from another part of your program.
 */
export function startTui(request: NativeTuiRequest): TuiSession {
  const binding = getNativeBinding();
  if (!binding) {
    throw new Error("Native binding is not available");
  }

  if (typeof binding.startTui === "function") {
    const nativeSession = binding.startTui(request);
    return wrapNativeSession(nativeSession);
  }

  throw new Error("Native binding does not expose startTui");
}

/**
 * Launches the Codex TUI and waits for it to exit. Supports optional cancellation via AbortSignal.
 */
export async function runTui(
  request: NativeTuiRequest,
  options: RunTuiOptions = {},
): Promise<NativeTuiExitInfo> {
  const session = startTui(request);
  const { signal } = options;
  let abortListener: (() => void) | undefined;

  try {
    if (signal) {
      if (signal.aborted) {
        session.shutdown();
      } else {
        abortListener = () => session.shutdown();
        signal.addEventListener("abort", abortListener, { once: true });
      }
    }
    return await session.wait();
  } finally {
    if (abortListener && signal) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}

function wrapNativeSession(nativeSession: NativeTuiSession): TuiSession {
  return {
    wait: () => nativeSession.wait(),
    shutdown: () => nativeSession.shutdown(),
    get closed() {
      return nativeSession.closed;
    },
  };
}

export type {
  NativeTuiRequest,
  NativeTuiExitInfo,
  NativeTokenUsage,
  NativeUpdateActionInfo,
  NativeUpdateActionKind,
};
