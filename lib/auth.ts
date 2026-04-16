import "server-only";

import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { buildOwnedHouseholdInviteCode } from "@/lib/household";
import { AuthAccount, Role } from "@/lib/types";

const AUTH_STORE_PATH = path.join(process.cwd(), "data", "auth-store.json");
const SESSION_COOKIE_NAME = "roadready_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_ACCOUNT = {
  name: "Maya Chen",
  email: "demo@roadready.local",
  role: "teen" as const
};

interface StoredUser extends AuthAccount {
  createdAt: string;
  passwordHash: string;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

interface AuthStore {
  users: StoredUser[];
  sessions: StoredSession[];
}

interface AuthResult {
  sessionToken: string;
  user: AuthAccount;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function isRole(value: string): value is Role {
  return value === "teen" || value === "parent";
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const expected = Buffer.from(expectedHash, "hex");
  const candidate = scryptSync(password, salt, expected.length);

  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(user: StoredUser): AuthAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function getCookieConfig() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

function emptyStore(): AuthStore {
  return { users: [], sessions: [] };
}

function pruneExpiredSessions(store: AuthStore) {
  const now = Date.now();
  const sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);

  return {
    changed: sessions.length !== store.sessions.length,
    store: {
      ...store,
      sessions
    }
  };
}

async function writeAuthStore(store: AuthStore) {
  await mkdir(path.dirname(AUTH_STORE_PATH), { recursive: true });
  await writeFile(AUTH_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function readAuthStore() {
  try {
    const raw = await readFile(AUTH_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthStore>;
    const hydrated: AuthStore = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
    const { store, changed } = pruneExpiredSessions(hydrated);

    if (changed) {
      await writeAuthStore(store);
    }

    return store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyStore();
    }

    throw error;
  }
}

function validateCredentials(email: string, password: string) {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new AuthError("Enter a valid email address.");
  }

  if (password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.");
  }
}

async function issueSession(store: AuthStore, userId: string) {
  const now = new Date();
  const sessionToken = randomBytes(32).toString("hex");
  const session: StoredSession = {
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(sessionToken),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
  };

  store.sessions = store.sessions
    .filter((existing) => existing.userId !== userId)
    .concat(session);

  await writeAuthStore(store);

  return sessionToken;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<AuthResult> {
  const name = sanitizeName(input.name);
  const email = normalizeEmail(input.email);
  const password = input.password;
  const role = input.role;

  if (!name) {
    throw new AuthError("Enter your name to create an account.");
  }

  if (!isRole(role)) {
    throw new AuthError("Choose whether this account is for a teen or a parent.");
  }

  validateCredentials(email, password);

  const store = await readAuthStore();

  if (store.users.some((user) => user.email === email)) {
    throw new AuthError("That email already has an account. Sign in instead.", 409);
  }

  const user: StoredUser = {
    id: randomUUID(),
    name,
    email,
    role,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password)
  };

  store.users.push(user);

  const sessionToken = await issueSession(store, user.id);

  return {
    sessionToken,
    user: publicUser(user)
  };
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const password = input.password;

  validateCredentials(email, password);

  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthError("That email and password combination did not match.", 401);
  }

  const sessionToken = await issueSession(store, user.id);

  return {
    sessionToken,
    user: publicUser(user)
  };
}

export async function loginDemoAccount(): Promise<AuthResult> {
  const store = await readAuthStore();
  let user = store.users.find((candidate) => candidate.email === DEMO_ACCOUNT.email);

  if (!user) {
    user = {
      id: randomUUID(),
      name: DEMO_ACCOUNT.name,
      email: DEMO_ACCOUNT.email,
      role: DEMO_ACCOUNT.role,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(randomBytes(24).toString("hex"))
    };

    store.users.push(user);
  } else {
    user = {
      ...user,
      name: DEMO_ACCOUNT.name,
      role: DEMO_ACCOUNT.role
    };
    store.users = store.users.map((candidate) => (candidate.id === user?.id ? user : candidate));
  }

  const sessionToken = await issueSession(store, user.id);

  return {
    sessionToken,
    user: publicUser(user)
  };
}

export async function clearSession(sessionToken?: string) {
  if (!sessionToken) {
    return;
  }

  const store = await readAuthStore();
  const tokenHash = hashSessionToken(sessionToken);
  const nextSessions = store.sessions.filter((session) => session.tokenHash !== tokenHash);

  if (nextSessions.length === store.sessions.length) {
    return;
  }

  await writeAuthStore({
    ...store,
    sessions: nextSessions
  });
}

export async function getUserForSessionToken(sessionToken?: string) {
  if (!sessionToken) {
    return null;
  }

  const store = await readAuthStore();
  const tokenHash = hashSessionToken(sessionToken);
  const session = store.sessions.find((candidate) => candidate.tokenHash === tokenHash);

  if (!session) {
    return null;
  }

  const user = store.users.find((candidate) => candidate.id === session.userId);

  return user ? publicUser(user) : null;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return getUserForSessionToken(sessionToken);
}

export async function findTeenAccountByInviteCode(inviteCode: string) {
  const normalizedCode = inviteCode.trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  const store = await readAuthStore();
  const teen = store.users.find(
    (user) => user.role === "teen" && normalizedCode === buildOwnedHouseholdInviteCode(user.id)
  );

  return teen ? publicUser(teen) : null;
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieConfig() {
  return getCookieConfig();
}
