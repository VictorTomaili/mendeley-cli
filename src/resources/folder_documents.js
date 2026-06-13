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

  /**
   * Add an existing document to this folder.
   *
   * @param {string} documentId
   * @returns {Promise<UserDocument>}
   */
  async add(documentId) {
    const rsp = await this.session.post(this._url, {
      data: JSON.stringify({ id: documentId }),
      headers: {
        'content-type': UserDocument.contentType,
        accept: UserDocument.contentType,
      },
    });
    return new UserDocument(this.session, await rsp.json());
  }

  /**
   * Remove a document from this folder (the document itself is not
   * deleted from the library).
   *
   * @param {string} documentId
   */
  async remove(documentId) {
    await this.session.delete(`${this._url}/${documentId}`);
  }
}
