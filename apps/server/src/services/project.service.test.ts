import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PROJECTS_PER_USER } from "@repo/types";
import { appErrorCode } from "../constants/appErrorCode";

const mocks = vi.hoisted(() => ({
    owned: [] as { id: string }[],
    /** Older rows another request sneaks in between the pre-check and the re-check. */
    racing: [] as { id: string }[],
    listCalls: 0,
    deleted: [] as string[],
}));

vi.mock("../prisma/db", () => ({
    orm: {
        Project: {
            where: (filter: { ownerId?: string; id?: string }) => ({
                orderBy: () => ({
                    select: () => ({
                        all: async () => {
                            mocks.listCalls += 1;
                            return mocks.listCalls > 1 ? [...mocks.racing, ...mocks.owned] : [...mocks.owned];
                        },
                    }),
                }),
                delete: async () => {
                    if (filter.id) mocks.deleted.push(filter.id);
                },
            }),
            create: async (data: { name: string }) => {
                const row = {
                    id: `new-${mocks.owned.length}`,
                    name: data.name,
                    description: null,
                    status: "DRAFT",
                    createdAt: "now",
                    updatedAt: "now",
                };
                mocks.owned.push({ id: row.id });
                return row;
            },
        },
    },
}));
vi.mock("../utils/storage", () => ({ referenceFor: (p: string) => p, removeObject: async () => {}, storagePaths: {} }));
vi.mock("../realtime/roomManager", () => ({ roomManager: { destroyRoom: async () => {} } }));

import { createProjectService } from "./project.service";

const seed = (count: number) => {
    mocks.owned = Array.from({ length: count }, (_, i) => ({ id: `p${i}` }));
};

describe("createProjectService project limit", () => {
    beforeEach(() => {
        mocks.owned = [];
        mocks.racing = [];
        mocks.listCalls = 0;
        mocks.deleted = [];
    });

    it("allows creating up to the limit", async () => {
        seed(MAX_PROJECTS_PER_USER - 1);
        const project = await createProjectService("u1", { name: "Last one" });
        expect(project.name).toBe("Last one");
        expect(project.role).toBe("owner");
    });

    it("rejects the next project with PROJECT_LIMIT_REACHED and creates nothing", async () => {
        seed(MAX_PROJECTS_PER_USER);
        await expect(createProjectService("u1", {})).rejects.toMatchObject({
            errorCode: appErrorCode.ProjectLimitReached,
        });
        expect(mocks.owned).toHaveLength(MAX_PROJECTS_PER_USER);
    });

    it("removes the row again when a concurrent request pushed it past the limit", async () => {
        seed(MAX_PROJECTS_PER_USER - 1);
        // Another request inserted an older project between our pre-check and re-check.
        mocks.racing = [{ id: "older" }];
        await expect(createProjectService("u1", {})).rejects.toMatchObject({
            errorCode: appErrorCode.ProjectLimitReached,
        });
        expect(mocks.deleted).toEqual([`new-${MAX_PROJECTS_PER_USER - 1}`]);
    });
});
