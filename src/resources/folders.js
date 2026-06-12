/**
 * Top-level resource for folders.
 *
 * The Mendeley API exposes folders under `/folders`.  Documents in a
 * folder are accessed via `/folders/{id}/documents` (see
 * `FolderDocuments`).
 */

import { Folder } from '../models/folders.js';
import { addQueryParams, GetByIdResource, ListResource } from './base.js';

export class Folders extends GetByIdResource {
  constructor(session) {
    super();
    this.session = session;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/folders';
  }
  _objType() {
    return Folder;
  }

  async list(kwargs = {}) {
    return super.list(kwargs);
  }

  async create({ name, parentId, groupId } = {}) {
    const body = { name };
    if (parentId) body.parent_id = parentId;
    if (groupId) body.group_id = groupId;
    const rsp = await this.session.post('/folders', {
      data: JSON.stringify(body),
      headers: {
        accept: Folder.contentType,
        'content-type': Folder.contentType,
      },
    });
    return new Folder(this.session, await rsp.json());
  }
}
