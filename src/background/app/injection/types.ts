export interface ExecuteScriptAttempt {
  name: string;
  success: boolean;
}

export interface ExecuteScriptInjectionResult {
  status: string;
  error?: string;
  selector?: string;
  strategy?: string;
  inputType?: string;
  elapsedMs?: number;
  attempts?: ExecuteScriptAttempt[];
}

export interface ServiceTestProbeSuccess {
  ok: true;
  input: {
    found: boolean;
    selector?: string;
    actualType?: string;
    expectedType?: string;
    typeMatches?: boolean;
  };
  submit: {
    status: string;
    method?: string;
    selector?: string;
  };
}

export interface ServiceTestProbeFailure {
  ok: false;
  error: string;
}

export type ServiceTestProbeResult = ServiceTestProbeSuccess | ServiceTestProbeFailure;

export type InjectPromptFn =
  (prompt: string, config: any) => Promise<ExecuteScriptInjectionResult> | ExecuteScriptInjectionResult;

export type SubmitPromptFn =
  (config: any) => Promise<ExecuteScriptInjectionResult> | ExecuteScriptInjectionResult;

declare global {
  // Injected into page worlds by content/injector scripts.
  // eslint-disable-next-line no-var
  var __aiPromptBroadcasterInjectPrompt: InjectPromptFn | undefined;
  // eslint-disable-next-line no-var
  var __aiPromptBroadcasterSubmitPrompt: SubmitPromptFn | undefined;

  interface HTMLElement {
    __lexicalEditor?: {
      parseEditorState: (state: string) => unknown;
      setEditorState: (state: unknown) => void;
      focus?: () => void;
    };
  }
}

export {};
