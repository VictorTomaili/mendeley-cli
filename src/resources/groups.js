/**
 * Top-level resource for groups.
 */

import { Group, GroupMember } from '../models/groups.js';
import { GetByIdResource, ListResource } from './base.js';

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
    return `/groups/${this.id}/members`;
  }
  _objType() {
    return GroupMember;
  }
}
