/**
 * Response objects returned by the Mendeley API.
 *
 * The Mendeley API returns plain JSON.  This module provides small wrapper
 * classes that present the JSON in a friendlier, object-oriented shape and
 * that know how to lazily follow references to other resources.
 */

/**
 * Base class for model classes that are returned as JSON from the API.
 *
 * Subclasses should override {@link ResponseObject.fields} with the list of
 * field names that should be returned directly from the JSON (strings,
 * numbers, booleans).  More complex fields will generally have a getter that
 * reads the raw value from the JSON and parses it.
 *
 * Field access is provided by defining getters on the instance, so JSON
 * properties listed in `fields()` are accessible directly on the instance:
 *
 *     const doc = new UserDocument(session, json);
 *     doc.title          // => JSON 'title' field
 *     doc.identifiers    // => JSON 'identifiers' field
 *     doc.toJSON()       // => plain-object view
 *
 * @param {object} json raw JSON returned from the API.
 */
export class ResponseObject {
  constructor(json) {
    if (json === undefined || json === null) {
      throw new TypeError('ResponseObject requires a JSON body');
    }
    this.json = json;
    installFieldAccessors(this, this.constructor.fields());
  }

  /**
   * Convert to a plain-object serialisation, including all declared fields.
   */
  toJSON() {
    const out = {};
    for (const name of this._fieldNames()) {
      if (this.json[name] !== undefined) {
        out[name] = this.json[name];
      }
    }
    return out;
  }

  /** Convert to a human-readable multi-line string. */
  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  _fieldNames() {
    return this.constructor.fields();
  }

  /**
   * @returns {string[]} the list of field names exposed by this model.
   */
  static fields() {
    return [];
  }
}

/**
 * Model class that also keeps a reference to the authenticated session.
 * Useful when related objects need to be retrieved on demand.
 */
export class SessionResponseObject extends ResponseObject {
  constructor(session, json) {
    super(json);
    this.session = session;
  }
}

/**
 * Model that is instantiated only with an ID; other fields are loaded
 * lazily on demand.  Useful when a JSON response contains the ID of a
 * related object - clients that only need the ID don't have to make the
 * extra API call.
 *
 * Lazy objects are awaitable: `await doc` resolves to the underlying
 * `ResponseObject`.  Use `await doc.toJSON()` for a plain-object view.
 *
 *     const profilePromise = annotation.profile;
 *     const profile = await profilePromise;
 *     console.log(profile.first_name);
 *
 * @param {import('./session.js').MendeleySession} session
 * @param {string} id
 * @param {Function} objType model class to wrap
 * @param {Function} loader no-arg function that returns the full object
 */
export class LazyResponseObject {
  constructor(session, id, objType, loader) {
    this.session = session;
    this.id = id;
    this._objType = objType;
    this._loader = loader;
    this._value = null;
  }

  /** Asynchronously load the underlying object (cached). */
  async _load() {
    if (this._value === null) {
      this._value = await this._loader();
    }
    return this._value;
  }

  /** Make LazyResponseObject awaitable. */
  then(resolve, reject) {
    return this._load().then(resolve, reject);
  }

  /** Make LazyResponseObject thenable for `Promise.resolve` style usage. */
  catch(reject) {
    return this._load().catch(reject);
  }

  /** Make LazyResponseObject finally-able. */
  finally(cb) {
    return this._load().finally(cb);
  }

  /**
   * Returns a plain-object view of the loaded data, or `null` if the
   * underlying object has not been loaded yet.
   */
  async toJSON() {
    const obj = await this._load();
    return obj.toJSON();
  }

  toString() {
    if (this._value) {
      return this._value.toString();
    }
    return JSON.stringify({ id: this.id, lazy: true });
  }
}

/**
 * Install getters on the instance for every name in `fields`, so that
 * `instance.name` reads `instance.json[name]`.  This is the simplest way to
 * mirror the Python `__getattr__` behaviour without resorting to a Proxy
 * (which doesn't survive subclass constructor returns).
 */
function installFieldAccessors(instance, fields) {
  for (const name of fields) {
    if (name in instance) continue; // don't override real methods
    Object.defineProperty(instance, name, {
      enumerable: true,
      configurable: true,
      get() {
        return this.json[name];
      },
    });
  }
}
