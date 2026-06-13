/**
 * Top-level resource for accessing user library documents.
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { MendeleyException } from '../exception.js';
import { guessMime } from '../mime.js';
import {
  UserAllDocument,
  UserBibDocument,
  UserClientDocument,
  UserDocument,
  UserTagsDocument,
} from '../models/documents.js';
import { addQueryParams, ListResource } from './base.js';
import { DocumentsBase } from './base_documents.js';

export class Documents extends DocumentsBase {
  constructor(session, groupId) {
    super(session, groupId, null);
  }
  get _url() {
    return '/documents';
  }

  viewType(view) {
    return (
      {
        all: UserAllDocument,
        bib: UserBibDocument,
        client: UserClientDocument,
        tags: UserTagsDocument,
      }[view] || UserDocument
    );
  }

  async create({ title, type, ...kwargs }) {
    const body = { title, type, group_id: this.groupId, ...formatArgs(kwargs) };
    const rsp = await this.session.post('/documents', {
      data: JSON.stringify(body),
      headers: {
        accept: UserDocument.contentType,
        'content-type': UserDocument.contentType,
      },
    });
    return new UserAllDocument(this.session, await rsp.json());
  }

  async createFromFile(filePath) {
    const filename = basename(filePath);
    const data = await readFile(filePath);
    const mime = await guessMime(filename);
    const headers = {
      'content-disposition': `attachment; filename=${filename}`,
      'content-type': mime,
      accept: UserDocument.contentType,
    };
    const rsp = await this.session.post('/documents', { data, headers });
    return new UserAllDocument(this.session, await rsp.json());
  }

  search(query, kwargs = {}) {
    if (this.groupId) {
      throw new MendeleyException('Search is not available for group documents');
    }
    return new DocumentsSearch(this.session, { ...kwargs, query });
  }

  advancedSearch(kwargs = {}) {
    if (this.groupId) {
      throw new MendeleyException('Search is not available for group documents');
    }
    return new DocumentsSearch(this.session, kwargs);
  }
}

function formatArgs(kwargs) {
  const out = { ...kwargs };
  if (out.authors) out.authors = out.authors.map((a) => (a.json ? a.json : a));
  if (out.editors) out.editors = out.editors.map((a) => (a.json ? a.json : a));
  return out;
}

/**
 * Search results for `/search/documents`.  Paginates like other list
 * resources, but the URL is fixed.
 */
export class DocumentsSearch extends ListResource {
  constructor(session, params) {
    super();
    this.session = session;
    this.params = params;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return addQueryParams('/search/documents', this.params);
  }
  _objType(kwargs = {}) {
    return (
      {
        all: UserAllDocument,
        bib: UserBibDocument,
        client: UserClientDocument,
        tags: UserTagsDocument,
      }[this.params.view] || UserDocument
    );
  }
}
