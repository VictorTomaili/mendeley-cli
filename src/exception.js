/**
 * Custom error types.
 */

export class MendeleyException extends Error {
  constructor(message) {
    super(message);
    this.name = 'MendeleyException';
  }
}

export class MendeleyApiException extends MendeleyException {
  constructor(message, status, body) {
    super(message);
    this.name = 'MendeleyApiException';
    this.status = status;
    this.body = body;
  }
}

export class MendeleyAuthException extends MendeleyException {
  constructor(message) {
    super(message);
    this.name = 'MendeleyAuthException';
  }
}
