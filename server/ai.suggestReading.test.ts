import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

// Mock the LLM and db modules
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          role: "assistant",
          content: JSON.stringify({
            suggestions: [
              { title: "Dom Casmurro", author: "Machado de Assis", reason: "Um clássico da literatura brasileira." },
              { title: "1984", author: "George Orwell", reason: "Distopia atemporal sobre controle e liberdade." },
              { title: "O Pequeno Príncipe", author: "Antoine de Saint-Exupéry", reason: "Uma reflexão poética sobre a vida." },
            ],
          }),
        },
        finish_reason: "stop",
      },
    ],
  }),
}));

vi.mock("./db", () => ({
  getUserReadingList: vi.fn().mockResolvedValue([]),
  getBookById: vi.fn().mockResolvedValue(null),
  searchBooks: vi.fn().mockResolvedValue([
    {
      id: 42,
      title: "Dom Casmurro",
      author: "Machado de Assis",
      coverUrl: "https://example.com/cover.jpg",
      averageRating: 4.5,
      genre: "Romance",
    },
  ]),
}));

describe("ai.suggestReading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns suggestions with book info from local database", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.suggestReading();

    expect(result).toBeDefined();
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0].title).toBe("Dom Casmurro");
    expect(result.suggestions[0].author).toBe("Machado de Assis");
    expect(result.suggestions[0].reason).toContain("clássico");
    // The first suggestion should have book info from the local DB
    expect(result.suggestions[0].book).not.toBeNull();
    expect(result.suggestions[0].book?.id).toBe(42);
    expect(result.suggestions[0].book?.coverUrl).toBe("https://example.com/cover.jpg");
    expect(result.suggestions[0].book?.averageRating).toBe(4.5);
  });

  it("returns suggestions with null book when not found locally", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Override searchBooks to return empty for this test
    const db = await import("./db");
    vi.mocked(db.searchBooks).mockResolvedValueOnce([]);

    const result = await caller.ai.suggestReading();

    expect(result.suggestions).toHaveLength(3);
    // The first suggestion should have null book since searchBooks returned empty
    expect(result.suggestions[0].book).toBeNull();
    // But title/author/reason should still be present
    expect(result.suggestions[0].title).toBeDefined();
    expect(result.suggestions[0].author).toBeDefined();
    expect(result.suggestions[0].reason).toBeDefined();
  });

  it("returns empty suggestions array on LLM parse failure", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Override invokeLLM to return invalid content
    const llm = await import("./_core/llm");
    vi.mocked(llm.invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { role: "assistant", content: "not valid json" }, finish_reason: "stop" }],
    } as any);

    const result = await caller.ai.suggestReading();

    expect(result.suggestions).toHaveLength(0);
  });
});
