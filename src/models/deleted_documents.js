/**
 * Deleted-document model.
 *
 * `GET /deleted_documents` returns the ids of documents that have been
 * permanently deleted (used by sync clients to reconcile local caches).
 * Each record exposes only an `id`.
 *
 * Content-Type: application/vnd.mendeley-deleted-document.1+json
 * (see https://dev.mendeley.com/methods/#retrieve-list-of-deleted-documents-ids)
 */

import { SessionResponseObject } from '../response.js';

export class DeletedDocument extends SessionResponseObject {
  static contentType = 'application/vnd.mendeley-deleted-document.1+json';
  get contentType() {
    return this.constructor.contentType;
  }

  static fields() {
    return ['id'];
  }
}
