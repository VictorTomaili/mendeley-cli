/**
 * Top-level resource for groups.
 */

import { Group, GroupMember } from '../models/groups.js';
import { encodePathSegment, GetByIdResource, ListResource } from './base.js';

export class Groups extends GetByIdResource {
  constructor(session) {
    super();
    this.session = session;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/groups';
  }
  _objType() {
    return Group;
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

export class GroupMembers extends ListResource {
  constructor(session, id) {
    super();
    this.session = session;
    this.id = id;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return `/groups/${encodePathSegment(this.id)}/members`;
  }
  _objType() {
    return GroupMember;
  }
}
