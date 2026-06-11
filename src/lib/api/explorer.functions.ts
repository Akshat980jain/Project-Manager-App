export interface FileNode {
  name: string;
  relativePath: string;
  fullPath: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

// 1. Scan Projects
export async function scanProjects() {
  const res = await fetch("/api/scan-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 2. Get File Tree
export async function getFileTree(args: { data: { projectDir: string } }): Promise<FileNode[]> {
  const res = await fetch("/api/get-file-tree", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 3. Get File Content
export async function getFileContent(args: { data: { fullPath: string } }): Promise<string> {
  const res = await fetch("/api/get-file-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

// 4. Get Project Detail
export async function getProjectDetail(args: { data: { projectDir: string } }) {
  const res = await fetch("/api/get-project-detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 5. Exclude Project
export async function excludeProject(args: { data: { projectDir: string } }) {
  const res = await fetch("/api/exclude-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 6. Delete Project Folder
export async function deleteProjectFolder(args: { data: { projectDir: string } }) {
  const res = await fetch("/api/delete-project-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 7. Get Git History
export async function getGitHistory(args: { data: { projectDir: string } }): Promise<CommitInfo[]> {
  const res = await fetch("/api/get-git-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
