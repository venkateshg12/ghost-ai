import { auth, tasks } from "@trigger.dev/sdk";
import type { AiRunKind, AiRunStarted, AiRunToken, DesignRequestSchema, SpecRequestSchema } from "@repo/types";
import { orm } from "../prisma/db";
import appAssert from "../utils/errors/appAssert";
import { NOT_FOUND } from "../constants/http";
import { publishStatus } from "../utils/liveblocks";
import { assertProjectAccess } from "./project.service";
import type { designAgentTask } from "../trigger/design-agent";
import type { generateSpecTask } from "../trigger/generate-spec";

// Tokens re-issued by createRunTokenService; the browser asks for a fresh one if a page outlives the first.
const RUN_TOKEN_EXPIRY = "1h";

/*
  Request handlers never run model calls: they check access, trigger the Trigger.dev task, record who
  started it, and hand back the run id plus a token that can read only that run. The TaskRun row is
  what later lets only that user get a new token for the run.
 */
const recordRun = (runId: string, kind: AiRunKind, projectId: string, userId: string) =>
    orm.TaskRun.create({ runId, kind, projectId, userId });

export const startDesignRunService = async (userId: string, data: DesignRequestSchema): Promise<AiRunStarted> => {
    const { project } = await assertProjectAccess(data.roomId, userId);

    // Type-only import of the task: the API process never loads task code, only triggers it by id.
    const handle = await tasks.trigger<typeof designAgentTask>(
        "design-agent",
        { projectId: project.id, userId, prompt: data.prompt },
        { tags: [`project_${project.id}`, `user_${userId}`] }
    );

    await recordRun(handle.id, "design", project.id, userId);
    await publishStatus(project.id, { kind: "design", runId: handle.id, step: "queued", text: "Ghost AI is getting ready…" });

    return { runId: handle.id, kind: "design", publicAccessToken: handle.publicAccessToken };
};

export const startSpecRunService = async (userId: string, data: SpecRequestSchema): Promise<AiRunStarted> => {
    // The project comes from the room the caller can access — never from a client-supplied id.
    const { project } = await assertProjectAccess(data.roomId, userId);

    const handle = await tasks.trigger<typeof generateSpecTask>(
        "generate-spec",
        { projectId: project.id, userId, chatHistory: data.chatHistory },
        { tags: [`project_${project.id}`, `user_${userId}`] }
    );

    await recordRun(handle.id, "spec", project.id, userId);
    await publishStatus(project.id, { kind: "spec", runId: handle.id, step: "queued", text: "Queued technical spec generation…" });

    return { runId: handle.id, kind: "spec", publicAccessToken: handle.publicAccessToken };
};

/** A fresh read-only token for a run, issued only to the user who started it. */
export const createRunTokenService = async (userId: string, runId: string): Promise<AiRunToken> => {
    const run = await orm.TaskRun.where({ runId, userId }).select("runId").first();
    appAssert(run, NOT_FOUND, "Run not found");

    const publicAccessToken = await auth.createPublicToken({
        scopes: { read: { runs: [runId] } },
        expirationTime: RUN_TOKEN_EXPIRY,
    });

    return { runId, publicAccessToken };
};
