/**
 * File model - a file attached to a document.
 */

import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { Annotation } from './annotations.js';
import { Color, BoundingBox, Position } from './common.js';
import { SessionResponseObject } from '../response.js';

const FILENAME_REGEX = /filename="?([^";]+)"?/;

export class File extends SessionResponseObject {
  static contentType = 'application/vnd.mendeley-file.1+json';
  get contentType() {
    return this.constructor.contentType;
  }

  static fields() {
    return ['id', 'size', 'file_name', 'mime_type', 'filehash'];
  }

  /**
   * The URL at which the file can be downloaded.  This URL is only valid
   * for a short time, so should not be cached.
   */
  async getDownloadUrl() {
    const rsp = await this.session.get(`/files/${this.id}`, { allowRedirects: false });
    return rsp.headers.get('location');
  }

  /** Resolve the parent document, if any. */
  async document(view) {
    if (this.json.document_id) {
      return this.session.documents.getLazy(this.json.document_id, { view });
    }
    if (this.json.catalog_id) {
      return this.session.catalog.getLazy(this.json.catalog_id, { view });
    }
    return null;
  }

  /**
   * Download the file to `directory`.  Returns the local path.
   */
  async download(directory) {
    const rsp = await this.session.get(`/files/${this.id}`, { stream: true });
    const cd = rsp.headers.get('content-disposition') || '';
    const match = cd.match(FILENAME_REGEX);
    const filename = match ? match[1] : this.json.file_name || `file-${this.id}`;
    const path = join(directory, filename);

    if (!rsp.body) {
      throw new Error('Response had no body to stream');
    }
    await pipeline(rsp.body, createWriteStream(path));
    return path;
  }

  async delete() {
    await this.session.delete(`/files/${this.id}`);
  }

  async addStickyNote(text, x, y, page) {
    const position = { x, y };
    const boundingBox = { top_left: position, bottom_right: position, page };
    const annotation = {
      document_id: (await this.document()).id,
      text,
      filehash: this.json.filehash,
      positions: [boundingBox],
    };
    const rsp = await this.session.post('/annotations/', {
      data: JSON.stringify(annotation),
      headers: {
        accept: Annotation.contentType,
        'content-type': Annotation.contentType,
      },
    });
    return new Annotation(this.session, await rsp.json());
  }

  async addHighlight(boundingBoxes, color) {
    const annotation = {
      document_id: (await this.document()).id,
      filehash: this.json.filehash,
      positions: boundingBoxes.map((b) => (b.json ? b.json : b)),
      color: color.json ? color.json : color,
    };
    const rsp = await this.session.post('/annotations/', {
      data: JSON.stringify(annotation),
      headers: {
        accept: Annotation.contentType,
        'content-type': Annotation.contentType,
      },
    });
    return new Annotation(this.session, await rsp.json());
  }
}
