/**
 * Documents contained in a particular folder.
 */

import { UserDocument } from '../models/documents.js';
import { addQueryParams, ListResource } from './base.js';

export class FolderDocuments extends ListResource {
  constructor(session, folderId) {
    super();
    this.session = session;
    this.folderId = folderId;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return `/folders/${this.folderId}/documents`;
  }
  _objType() {
    return UserDocument;
  }
}
