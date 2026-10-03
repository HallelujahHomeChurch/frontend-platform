import { createOperationsClient } from "./client.js";
import type { components } from "./generated.js";
export type ServiceOccurrence = components["schemas"]["Occurrence"];
export type ServiceAssignment = components["schemas"]["ServiceAssignment"];
export type ServiceTeam = components["schemas"]["ServiceTeam"];
export type ServiceCandidate = components["schemas"]["ServiceCandidate"];
export type ServiceCreateInput = components["schemas"]["ServiceCreateInput"];
export type ServiceCommand = components["schemas"]["ServiceCommand"];
export function createServiceClient(
  options: Parameters<typeof createOperationsClient>[0],
) {
  const { raw } = createOperationsClient(options);
  async function unwrap<T>(
    result: Promise<{ data?: T; error?: unknown; response: Response }>,
  ): Promise<T> {
    const r = await result;
    if (!r.response.ok || r.data === undefined)
      throw new Error(
        r.response.status === 412
          ? "班表已更新，請重新整理後再操作。"
          : "無法完成操作，請重新整理後重試。",
      );
    return r.data;
  }
  return {
    teams: () => unwrap(raw.GET("/api/operations/me/service/teams")),
    candidates: async (id: string) => {
      const all: ServiceCandidate[] = [];
      let cursor: string | undefined;
      for (;;) {
        const page = await unwrap(
          raw.GET("/api/operations/me/service/teams/{id}/candidates", {
            params: { path: { id }, query: { cursor } },
          }),
        );
        all.push(...page);
        if (page.length < 100) return all;
        const next = page.at(-1)!.id;
        if (next === cursor) throw new Error("Invalid pagination cursor");
        cursor = next;
      }
    },
    occurrences: (id: string, from: string, to: string) =>
      unwrap(
        raw.GET("/api/operations/me/service/teams/{id}/occurrences", {
          params: { path: { id }, query: { from, to } },
        }),
      ),
    list: (teamId: string, from: string, to: string, cursor?: string) =>
      unwrap(
        raw.GET("/api/operations/me/service/assignments", {
          params: { query: { teamId, from, to, cursor } },
        }),
      ),
    create: (body: ServiceCreateInput, key: string) =>
      unwrap(
        raw.POST("/api/operations/me/service/assignments", {
          body,
          params: { header: { "Idempotency-Key": key } },
        }),
      ),
    command: (id: string, body: ServiceCommand, key: string) =>
      unwrap(
        raw.POST("/api/operations/me/service/assignments/{id}/commands", {
          body,
          params: { path: { id }, header: { "Idempotency-Key": key } },
        }),
      ),
  };
}
