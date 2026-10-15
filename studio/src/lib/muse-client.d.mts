import type { Credentials, VM, Diagnostic } from "../types";
export interface ReplyUpdate {
  id: string;
  text: string;
  done: boolean;
}
export interface ConnectOptions {
  base?: string;
  accountPath?: string;
  noisePath?: string;
  vmId?: string;
  deviceName?: string;
}
export class MuseClient {
  constructor(options?: {
    base?: string;
    onState?: (state: string) => void;
    onReply?: (reply: ReplyUpdate) => void;
    onDiagnostics?: (event: Diagnostic) => void;
  });
  ready: boolean;
  vms: VM[];
  onReply: (reply: ReplyUpdate) => void;
  connect(credentials: Credentials, options?: ConnectOptions): Promise<void>;
  chat(
    message: string,
    sessionId?: string | null,
  ): Promise<{ sessionId: string; isThread: boolean }>;
  cancelTurn(): void;
  close(): void;
}
