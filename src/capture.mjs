import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSnapshot } from '../contracts/growth.ts';
export async function capture({ file, remote, cursor }) {
  return file ? parseSnapshot(JSON.parse(await readFile(resolve(file), 'utf8'))) : remote.snapshot(cursor);
}
