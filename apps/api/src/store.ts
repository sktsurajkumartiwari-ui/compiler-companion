import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  LanguageId,
  Project,
  ProjectSummary,
  WorkspaceFile,
} from "@compiler-companion/shared";
import type { AuthUser } from "./auth.js";

interface StoredProject extends Project {
  ownerId: string;
}
interface Database {
  users: AuthUser[];
  projects: StoredProject[];
}
const dataFile = join(
  process.env.DATA_DIR ?? join(process.cwd(), "../../data"),
  "compiler-companion.json",
);
const empty = (): Database => ({ users: [], projects: [] });

async function read(): Promise<Database> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as Database;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw error;
  }
}
async function write(data: Database) {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
  await rename(temporary, dataFile);
}

export class LocalStore {
  async createUser(email: string, passwordHash: string) {
    const db = await read();
    if (db.users.some((user) => user.email === email))
      throw new Error("An account with that email already exists.");
    const user: AuthUser = {
      id: randomUUID(),
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    await write(db);
    return user;
  }
  async userByEmail(email: string) {
    return (await read()).users.find((user) => user.email === email);
  }
  async updateUserPassword(email: string, passwordHash: string) {
    const db = await read();
    const user = db.users.find((u) => u.email === email);
    if (!user) throw new Error("Account not found.");
    user.passwordHash = passwordHash;
    await write(db);
    return user;
  }
  async listProjects(ownerId: string): Promise<ProjectSummary[]> {
    return (await read()).projects
      .filter((project) => project.ownerId === ownerId)
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  }
  async getProject(ownerId: string, id: string): Promise<Project | undefined> {
    const project = (await read()).projects.find(
      (item) => item.id === id && item.ownerId === ownerId,
    );
    return (
      project && {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        files: project.files,
      }
    );
  }
  async createProject(ownerId: string, name: string, language: LanguageId) {
    const db = await read();
    const now = new Date().toISOString();
    const file: WorkspaceFile = {
      id: randomUUID(),
      name: language === "python" ? "main.py" : "main.cpp",
      language,
      content:
        language === "python"
          ? "print('Hello, Compiler Companion!')\n"
          : '#include <iostream>\nint main() { std::cout << "Hello, Compiler Companion!\\n"; }\n',
      updatedAt: now,
    };
    const project: StoredProject = {
      id: randomUUID(),
      ownerId,
      name,
      files: [file],
      updatedAt: now,
    };
    db.projects.push(project);
    await write(db);
    return project;
  }
  async createFile(ownerId: string, projectId: string, name: string, language: LanguageId) {
    const db = await read();
    const project = db.projects.find((item) => item.id === projectId && item.ownerId === ownerId);
    if (!project) return undefined;
    if (project.files.some((file) => file.name === name))
      throw new Error("A file with that name already exists.");
    const file: WorkspaceFile = {
      id: randomUUID(),
      name,
      language,
      content: "",
      updatedAt: new Date().toISOString(),
    };
    project.files.push(file);
    project.updatedAt = file.updatedAt;
    await write(db);
    return file;
  }
  async saveFile(ownerId: string, projectId: string, fileId: string, content: string) {
    const db = await read();
    const project = db.projects.find((item) => item.id === projectId && item.ownerId === ownerId);
    const file = project?.files.find((item) => item.id === fileId);
    if (!file) return undefined;
    file.content = content;
    file.updatedAt = new Date().toISOString();
    project!.updatedAt = file.updatedAt;
    await write(db);
    return file;
  }

  async deleteProject(ownerId: string, projectId: string): Promise<boolean> {
    const db = await read();
    const index = db.projects.findIndex((p) => p.id === projectId && p.ownerId === ownerId);
    if (index === -1) return false;
    db.projects.splice(index, 1);
    await write(db);
    return true;
  }

  async renameProject(
    ownerId: string,
    projectId: string,
    newName: string,
  ): Promise<StoredProject | undefined> {
    const db = await read();
    const project = db.projects.find((p) => p.id === projectId && p.ownerId === ownerId);
    if (!project) return undefined;
    project.name = newName;
    project.updatedAt = new Date().toISOString();
    await write(db);
    return project;
  }

  async deleteFile(ownerId: string, projectId: string, fileId: string): Promise<boolean> {
    const db = await read();
    const project = db.projects.find((p) => p.id === projectId && p.ownerId === ownerId);
    if (!project) return false;
    const fileIndex = project.files.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) return false;
    project.files.splice(fileIndex, 1);
    project.updatedAt = new Date().toISOString();
    await write(db);
    return true;
  }

  async renameFile(
    ownerId: string,
    projectId: string,
    fileId: string,
    newName: string,
  ): Promise<WorkspaceFile | undefined> {
    const db = await read();
    const project = db.projects.find((p) => p.id === projectId && p.ownerId === ownerId);
    if (!project) return undefined;
    if (
      project.files.some((f) => f.id !== fileId && f.name.toLowerCase() === newName.toLowerCase())
    ) {
      throw new Error("A file with that name already exists.");
    }
    const file = project.files.find((f) => f.id === fileId);
    if (!file) return undefined;
    file.name = newName;
    file.language = /\.(cpp|cc|cxx|h|hpp)$/i.test(newName) ? "cpp" : "python";
    file.updatedAt = new Date().toISOString();
    project.updatedAt = file.updatedAt;
    await write(db);
    return file;
  }
}
