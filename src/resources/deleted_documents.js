/**
 * Top-level resource for accessing deleted documents.
 *
 * `GET /deleted_documents` returns the ids of documents permanently
 * deleted from the user library (or a group library, via `--group`).
 * A `since` timestamp (ISO 8601) restricts the result to deletions
 * after that point — the standard incremental-sync primitive.
 *
 * https://dev.mendeley.com/methods/#retrieve-list-of-deleted-documents-ids
 */

import { DeletedDocument } from '../models/deleted_documents.js';
import { ListResource } from './base.js';

export class DeletedDocuments extends ListResource {
  constructor(session, groupId = null) {
    super();
    this.session = session;
    this.groupId = groupId;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/deleted_documents';
  }
  _objType() {
    return DeletedDocument;
  }

  async list(kwargs = {}) {
    return super.list({ ...kwargs, group_id: this.groupId });
  }
  async *iter(kwargs = {}) {
    yield* super.iter({ ...kwargs, group_id: this.groupId });
  }
}
