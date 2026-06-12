/**
 * Annotations model.
 */

import { BoundingBox, Color, toArrow } from './common.js';
import { SessionResponseObject } from '../response.js';

export class Annotation extends SessionResponseObject {
  static contentType = 'application/vnd.mendeley-annotation.1+json';
  get contentType() {
    return this.constructor.contentType;
  }

  static fields() {
    return ['id', 'text', 'privacy_level', 'type'];
  }

  get created() {
    return toArrow(this.json.created);
  }
  get last_modified() {
    return toArrow(this.json.last_modified);
  }
  get profile() {
    return this.json.profile_id ? this.session.profiles.getLazy(this.json.profile_id) : null;
  }
  get positions() {
    if (!this.json.positions) return null;
    return this.json.positions.map((p) => new BoundingBox(p));
  }
  get color() {
    return this.json.color ? new Color(this.json.color) : null;
  }

  document(view) {
    if (this.json.document_id) {
      return this.session.documents.getLazy(this.json.document_id, { view });
    }
    return null;
  }

  async update(kwargs = {}) {
    const rsp = await this.session.patch(`/annotations/${this.id}`, {
      data: JSON.stringify(formatAnnotationArgs(kwargs)),
      headers: {
        accept: this.contentType,
        'content-type': this.contentType,
      },
    });
    return new Annotation(this.session, await rsp.json());
  }

  async delete() {
    await this.session.delete(`/annotations/${this.id}`);
  }
}

function formatAnnotationArgs(kwargs) {
  const out = { ...kwargs };
  if (out.positions) out.positions = out.positions.map((b) => (b.json ? b.json : b));
  if (out.color) out.color = out.color.json ? out.color.json : out.color;
  return out;
}
