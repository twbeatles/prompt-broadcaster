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
