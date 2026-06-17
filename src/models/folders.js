/**
 * Folder model.
 *
 * Mendeley folders organise documents in a user's library.  The Python
 * SDK did not expose folders, but the underlying API does - and an AI
 * agent that wants to keep a tidy library needs them.
 */

import { encodePathSegment } from '../resources/base.js';
import { SessionResponseObject } from '../response.js';

export class Folder extends SessionResponseObject {
  static contentType = 'application/vnd.mendeley-folder.1+json';
  get contentType() {
    return this.constructor.contentType;
  }

  static fields() {
    return [
      'id',
      'name',
      'parent_id',
      'group_id',
      'profile_id',
      'created',
      'last_modified',
      'document_count',
    ];
  }

  get created() {
    return this.json.created ? new Date(this.json.created) : null;
  }
  get last_modified() {
    return this.json.last_modified ? new Date(this.json.last_modified) : null;
  }
  get documents() {
    return this.session.folderDocuments(this.id);
  }

  async update(kwargs) {
    const rsp = await this.session.patch(`/folders/${encodePathSegment(this.id)}`, {
      data: JSON.stringify(kwargs),
      headers: {
        accept: this.contentType,
        'content-type': this.contentType,
      },
    });
    return new Folder(this.session, await rsp.json());
  }

  async delete() {
    await this.session.delete(`/folders/${encodePathSegment(this.id)}`);
  }
}
