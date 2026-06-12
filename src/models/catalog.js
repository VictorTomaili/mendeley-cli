/**
 * Catalog documents and their views.
 *
 * Catalog documents are the read-only, public metadata records.  Each
 * catalog document can be requested in one of several "views" that
 * add extra fields.
 */

import { BaseDocument, BaseBibView, BaseClientView } from './base_documents.js';
import { SessionResponseObject } from '../response.js';

const CatalogBibViewStatic = { fields: () => BaseBibView.fields() };
const CatalogClientViewStatic = { fields: () => BaseClientView.fields() };
const CatalogStatsViewStatic = {
  fields: () => [
    'reader_count',
    'reader_count_by_academic_status',
    'reader_count_by_subdiscipline',
    'reader_count_by_country',
  ],
};

/** Base class for catalog documents. */
export class CatalogDocument extends BaseDocument {
  static contentType = 'application/vnd.mendeley-document.1+json';

  get files() {
    return this.session.catalogFiles(this.id);
  }

  static fields() {
    return [...super.fields(), 'link'];
  }
}

export class CatalogBibView extends SessionResponseObject {}
CatalogBibView.fields = CatalogBibViewStatic.fields;

export class CatalogClientView extends SessionResponseObject {}
CatalogClientView.fields = CatalogClientViewStatic.fields;

export class CatalogStatsView extends SessionResponseObject {}
CatalogStatsView.fields = CatalogStatsViewStatic.fields;

/**
 * Subclasses for each view, all extending CatalogDocument so they
 * inherit the `contentType` static used as the `Accept` header.
 */
export class CatalogBibDocument extends CatalogDocument {
  static contentType = CatalogDocument.contentType;
  static fields() {
    return [...new Set([...CatalogDocument.fields(), ...CatalogBibViewStatic.fields()])];
  }
}

export class CatalogClientDocument extends CatalogDocument {
  static contentType = CatalogDocument.contentType;
  static fields() {
    return [...new Set([...CatalogDocument.fields(), ...CatalogClientViewStatic.fields()])];
  }
}

export class CatalogStatsDocument extends CatalogDocument {
  static contentType = CatalogDocument.contentType;
  static fields() {
    return [...new Set([...CatalogDocument.fields(), ...CatalogStatsViewStatic.fields()])];
  }
}

export class CatalogAllDocument extends CatalogDocument {
  static contentType = CatalogDocument.contentType;
  static fields() {
    return [
      ...new Set([
        ...CatalogDocument.fields(),
        ...CatalogBibViewStatic.fields(),
        ...CatalogClientViewStatic.fields(),
        ...CatalogStatsViewStatic.fields(),
      ]),
    ];
  }
}

/**
 * Result of a `/metadata` lookup.  The actual document is loaded lazily
 * when needed.
 *
 * This class intentionally does NOT extend `LazyResponseObject` (and
 * therefore is not thenable) because callers usually want to inspect
 * `score` and `catalog_id` before deciding to load the full document.
 */
export class LookupResponse {
  constructor(session, json, view, objType) {
    this.session = session;
    this.id = json.catalog_id;
    this.score = json.score;
    this.view = view;
    this._objType = objType;
  }
  async _load() {
    return this.session.catalog.get(this.id, { view: this.view });
  }
  toJSON() {
    return { catalog_id: this.id, score: this.score, view: this.view };
  }
}
