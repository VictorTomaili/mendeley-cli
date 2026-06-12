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
  async list(kwargs = {}) {
    return super.list(kwargs);
  }
  async *iter(kwargs = {}) {
    yield* super.iter(kwargs);
  }
}
