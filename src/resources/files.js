/**
 * Top-level resource for accessing files.
 */

import { File } from '../models/files.js';
import { ListResource } from './base.js';

export class Files extends ListResource {
  constructor(session, opts = {}) {
    super();
    this.session = session;
    this.catalogId = opts.catalogId || null;
    this.documentId = opts.documentId || null;
    this.groupId = opts.groupId || null;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/files';
  }
  _objType() {
    return File;
  }

  async list(kwargs = {}) {
    return super.list({
      ...kwargs,
      catalog_id: this.catalogId,
      document_id: this.documentId,
      group_id: this.groupId,
    });
  }
  async *iter(kwargs = {}) {
    yield* super.iter({
      ...kwargs,
      catalog_id: this.catalogId,
      document_id: this.documentId,
      group_id: this.groupId,
    });
  }
}
