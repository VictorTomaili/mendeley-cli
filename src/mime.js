/**
 * Tiny MIME-type lookup.  Avoids the `mime-types` dependency by
 * matching a curated set of file extensions that Mendeley typically
 * encounters (PDF, Word, LaTeX, eBook formats, etc.).  Falls back to
 * `application/octet-stream`.
 */

const TABLE = {
  pdf: 'application/pdf',
  ps: 'application/postscript',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  tex: 'application/x-tex',
  latex: 'application/x-latex',
  bib: 'application/x-bibtex',
  enw: 'application/x-endnote-refer',
  ris: 'application/x-research-info-systems',
  xml: 'application/xml',
  html: 'text/html',
  htm: 'text/html',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  epub: 'application/epub+zip',
  mobi: 'application/x-mobipocket-ebook',
  azw: 'application/vnd.amazon.ebook',
  azw3: 'application/vnd.amazon.ebook',
  djvu: 'image/vnd.djvu',
  djv: 'image/vnd.djvu',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

/** Guess the MIME type for a file name or path based on its extension. */
export function guessMime(filename) {
  if (!filename) return 'application/octet-stream';
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  const ext = filename.slice(dot + 1).toLowerCase();
  return TABLE[ext] || 'application/octet-stream';
}
