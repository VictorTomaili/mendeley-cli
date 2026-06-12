/**
 * Profile model.
 */

import { Discipline, Education, Employment, Location, Photo, toArrow } from './common.js';
import { SessionResponseObject } from '../response.js';

export class Profile extends SessionResponseObject {
  static contentType = 'application/vnd.mendeley-profiles.1+json';
  get contentType() {
    return this.constructor.contentType;
  }

  static fields() {
    return [
      'id',
      'first_name',
      'last_name',
      'display_name',
      'email',
      'link',
      'research_interests',
      'academic_status',
      'verified',
      'user_type',
    ];
  }

  get created() {
    return toArrow(this.json.created);
  }
  get discipline() {
    return this.json.discipline ? new Discipline(this.json.discipline) : null;
  }
  get photo() {
    return this.json.photo ? new Photo(this.json.photo) : null;
  }
  get location() {
    return this.json.location ? new Location(this.json.location) : null;
  }
  get education() {
    return this.json.education ? this.json.education.map((e) => new Education(e)) : null;
  }
  get employment() {
    return this.json.employment ? this.json.employment.map((e) => new Employment(e)) : null;
  }
}
