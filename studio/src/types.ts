export type CredentialSource = "esp32" | "linux";
export type ConnectionMode = "official" | "relay";
export interface Credentials {
  access_token: string;
  relay_key?: string;
  refresh_token?: string;
  sdk_token?: string;
  device_id?: string;
}
export interface Vault {
  salt: string;
  iv: string;
  data: string;
}
export interface Profile {
  id: string;
  name: string;
  deviceName: string;
  credentialSource?: CredentialSource;
  mode: ConnectionMode;
  server: string;
  vmId?: string;
  vault?: Vault;
  createdAt: number;
  disabled?: boolean;
}
export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  createdAt: number;
  status?: "streaming" | "done" | "stopped";
}
export interface Conversation {
  id: string;
  accountId: string;
  title: string;
  kind: "thread" | "main";
  sessionId: string | null;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  verified?: boolean;
}
export interface VM {
  vm_id: string;
  vm_name: string;
  default?: boolean;
}
export type Phase = "offline" | "connecting" | "ready" | "sending" | "error";
export interface Diagnostic {
  stage: string;
  status?: number;
  isThread?: boolean;
  sessionMatched?: boolean;
  noise?: boolean;
  vmCount?: number;
}
