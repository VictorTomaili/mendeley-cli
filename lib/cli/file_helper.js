/**
 * Helper to stream a fetch Response to a file on disk.
 */

import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const FILENAME_REGEX = /filename="?([^";]+)"?/;

/**
 * Stream a `Response` (with a binary body) to a file inside `directory`.
 * Returns the full path to the saved file.
 */
export async function streamToFile(rsp, directory) {
  const cd = rsp.headers.get('content-disposition') || '';
  const match = cd.match(FILENAME_REGEX);
  const filename = match ? match[1] : 'mendeley-file';
  const path = join(directory, filename);
  if (!rsp.body) {
    throw new Error('Response had no body');
  }
  await pipeline(rsp.body, createWriteStream(path));
  return path;
}
