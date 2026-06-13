/**
 * Top-level resource for accessing annotations.
 */

import { Annotation } from '../models/annotations.js';
import { GetByIdResource, ListResource } from './base.js';

export class Annotations extends GetByIdResource {
  constructor(session) {
    super();
    this.session = session;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/annotations';
  }
  _objType() {
    return Annotation;
  }

  async get(id) {
    return super.get(id);
  }
  // `GetByIdResource` does not implement list()/iter(); delegate to
  // `ListResource` via composition (mirrors DocumentsBase).
  async list(kwargs = {}) {
    return ListResource.prototype.list.call(this, kwargs);
  }
  async *iter(kwargs = {}) {
    yield* ListResource.prototype.iter.call(this, kwargs);
  }
}
