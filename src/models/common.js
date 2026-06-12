/**
 * Common value-object types used by the various Mendeley resources.
 *
 * These map to the small JSON sub-objects the API embeds in larger
 * payloads - disciplines, photos, locations, education, employment,
 * people, positions, bounding boxes and colours.
 */

import { ResponseObject } from '../response.js';

/** The discipline of a {@link Profile}. */
export class Discipline extends ResponseObject {
  static fields() {
    return ['name', 'subdisciplines'];
  }
}

/** A photo associated with a {@link Profile} or {@link Group}. */
export class Photo extends ResponseObject {
  static fields() {
    return ['original', 'standard', 'square'];
  }
}

/** A geographic location, associated with a {@link Profile}. */
export class Location extends ResponseObject {
  static fields() {
    return ['latitude', 'longitude', 'name'];
  }
}

/** Education details, associated with a {@link Profile}. */
export class Education extends ResponseObject {
  static fields() {
    return ['institution', 'degree', 'website'];
  }

  get start_date() {
    return toArrow(this.json.start_date);
  }
  get end_date() {
    return toArrow(this.json.end_date);
  }
}

/** Employment details, associated with a {@link Profile}. */
export class Employment extends ResponseObject {
  static fields() {
    return ['institution', 'position', 'website', 'classes'];
  }

  get start_date() {
    return toArrow(this.json.start_date);
  }
  get end_date() {
    return toArrow(this.json.end_date);
  }
}

/** A person (author/editor) attached to a document. */
export class Person extends ResponseObject {
  static fields() {
    return ['first_name', 'last_name'];
  }

  static create(firstName, lastName) {
    return new Person({ first_name: firstName, last_name: lastName });
  }
}

/** A position (x, y) on a page. */
export class Position extends ResponseObject {
  static fields() {
    return ['x', 'y'];
  }

  static create(x, y) {
    return new Position({ x, y });
  }
}

/** A bounding box on a page, used by highlights and sticky notes. */
export class BoundingBox extends ResponseObject {
  static fields() {
    return ['page'];
  }

  get top_left() {
    const tl = this.json.top_left;
    return tl ? Position.create(tl.x, tl.y) : null;
  }
  get bottom_right() {
    const br = this.json.bottom_right;
    return br ? Position.create(br.x, br.y) : null;
  }

  static create(topLeft, bottomRight, page) {
    return new BoundingBox({
      top_left: { x: topLeft.x, y: topLeft.y },
      bottom_right: { x: bottomRight.x, y: bottomRight.y },
      page,
    });
  }
}

/** A colour, used by highlight annotations. */
export class Color extends ResponseObject {
  static fields() {
    return ['r', 'g', 'b'];
  }

  static create(red, green, blue) {
    return new Color({ r: red, g: green, b: blue });
  }
}

/**
 * Lightweight date helper.  We don't want to pull in a heavy date
 * library, so just wrap `Date` and provide a `format` method.
 */
class Arrow {
  constructor(date) {
    this.date = date;
  }
  format(fmt) {
    const pad = (n) => String(n).padStart(2, '0');
    return fmt
      .replace('YYYY', this.date.getUTCFullYear())
      .replace('MM', pad(this.date.getUTCMonth() + 1))
      .replace('DD', pad(this.date.getUTCDate()))
      .replace('HH', pad(this.date.getUTCHours()))
      .replace('mm', pad(this.date.getUTCMinutes()))
      .replace('ss', pad(this.date.getUTCSeconds()));
  }
  toISOString() {
    return this.date.toISOString();
  }
}

function toArrow(value) {
  if (!value) return null;
  return new Arrow(new Date(value));
}

export { Arrow, toArrow };
