/**
 * Top-level resource for accessing catalog documents.
 */

import { MendeleyException } from '../exception.js';
import {
  CatalogAllDocument,
  CatalogBibDocument,
  CatalogClientDocument,
  CatalogDocument,
  CatalogStatsDocument,
  LookupResponse,
} from '../models/catalog.js';
import { addQueryParams, GetByIdResource, ListResource } from './base.js';

export class Catalog extends GetByIdResource {
  constructor(session) {
    super();
    this.session = session;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/catalog';
  }
  _objType(kwargs = {}) {
    return viewType(kwargs.view);
  }

  async byIdentifier({ arxiv, doi, isbn, issn, pmid, scopus, filehash, view } = {}) {
    const url = addQueryParams('/catalog', {
      arxiv,
      doi,
      isbn,
      issn,
      pmid,
      scopus,
      filehash,
      view,
    });
    const objType = viewType(view);
    const rsp = await this.session.get(url, { headers: { accept: objType.contentType } });
    const body = await rsp.json();
    if (body.length === 0) {
      throw new MendeleyException('Catalog document not found');
    }
    return new objType(this.session, body[0]);
  }

  async lookup({ arxiv, doi, pmid, filehash, title, authors, year, source, view } = {}) {
    const url = addQueryParams('/metadata', {
      arxiv,
      doi,
      pmid,
      filehash,
      title,
      authors,
      year,
      source,
    });
    const objType = viewType(view);
    const rsp = await this.session.get(url, {
      headers: { accept: 'application/vnd.mendeley-document-lookup.1+json' },
    });
    return new LookupResponse(this.session, await rsp.json(), view, objType);
  }

  search(query, kwargs = {}) {
    return new CatalogSearch(this.session, { ...kwargs, query });
  }
  advancedSearch(kwargs = {}) {
    return new CatalogSearch(this.session, kwargs);
  }
}

export class CatalogSearch extends ListResource {
  constructor(session, params) {
    super();
    this.session = session;
    this.params = params;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return addQueryParams('/search/catalog', this.params);
  }
  _objType() {
    return viewType(this.params.view);
  }
}

export function viewType(view) {
  return (
    {
      bib: CatalogBibDocument,
      client: CatalogClientDocument,
      stats: CatalogStatsDocument,
      all: CatalogAllDocument,
    }[view] || CatalogDocument
  );
}
