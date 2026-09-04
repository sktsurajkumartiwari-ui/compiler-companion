import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStore } from "./store.js";

describe("LocalStore", () => {
  let tempDir: string;
  let store: LocalStore;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "compiler-store-test-"));
    process.env.DATA_DIR = tempDir;
    store = new LocalStore();
  });

  afterAll(async () => {
    delete process.env.DATA_DIR;
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("creates, renames, and deletes a project", async () => {
    const ownerId = "user-123";
    const project = await store.createProject(ownerId, "Test Project", "python");
    expect(project.name).toBe("Test Project");
    expect(project.files).toHaveLength(1);

    const renamed = await store.renameProject(ownerId, project.id, "Renamed Project");
    expect(renamed?.name).toBe("Renamed Project");

    const fetched = await store.getProject(ownerId, project.id);
    expect(fetched?.name).toBe("Renamed Project");

    const deleted = await store.deleteProject(ownerId, project.id);
    expect(deleted).toBe(true);

    const notFound = await store.getProject(ownerId, project.id);
    expect(notFound).toBeUndefined();
  });

  it("creates, renames, and deletes files within a project", async () => {
    const ownerId = "user-456";
    const project = await store.createProject(ownerId, "MultiFile Project", "cpp");

    const file = await store.createFile(ownerId, project.id, "utils.h", "cpp");
    expect(file?.name).toBe("utils.h");

    const renamed = await store.renameFile(ownerId, project.id, file!.id, "helpers.hpp");
    expect(renamed?.name).toBe("helpers.hpp");

    const saved = await store.saveFile(ownerId, project.id, renamed!.id, "int calculate(int x);");
    expect(saved?.content).toBe("int calculate(int x);");

    const deleted = await store.deleteFile(ownerId, project.id, renamed!.id);
    expect(deleted).toBe(true);

    const updatedProject = await store.getProject(ownerId, project.id);
    expect(updatedProject?.files.some((f) => f.name === "helpers.hpp")).toBe(false);
  });
});
