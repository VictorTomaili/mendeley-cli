/**
 * Top-level resource for profiles.
 */

import { Profile } from '../models/profiles.js';
import { GetByIdResource } from './base.js';

export class Profiles extends GetByIdResource {
  constructor(session) {
    super();
    this.session = session;
  }
  get _session() {
    return this.session;
  }
  get _url() {
    return '/profiles';
  }
  _objType() {
    return Profile;
  }

  get me() {
    return this.get('me');
  }
}
