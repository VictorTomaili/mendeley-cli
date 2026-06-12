/**
 * Convert a Mendeley `bib`-view document to a BibTeX entry.
 */

const TYPE_MAP = {
  journal: 'article',
  book: 'book',
  book_section: 'incollection',
  conference_proceedings: 'inproceedings',
  working_paper: 'misc',
  report: 'techreport',
  encyclopedia_article: 'inreference',
  generic: 'misc',
};

export function toBibtex(doc) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  const type = TYPE_MAP[json.type] || 'misc';
  const fields = {
    title: json.title,
    author: (json.authors || []).map((a) => `${a.first_name} ${a.last_name}`).join(' and '),
    year: json.year,
    source: json.source,
    publisher: json.publisher,
    volume: json.volume,
    issue: json.issue,
    pages: json.pages,
    doi: json.identifiers && json.identifiers.doi,
    isbn: json.identifiers && json.identifiers.isbn,
    issn: json.identifiers && json.identifiers.issn,
    arxiv: json.identifiers && json.identifiers.arxiv,
    pmid: json.identifiers && json.identifiers.pmid,
    keywords: Array.isArray(json.keywords) ? json.keywords.join(', ') : json.keywords,
    abstract: json.abstract,
  };
  const citeKey = buildCiteKey(json);
  const lines = [`@${type}{${citeKey},`];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue;
    lines.push(`  ${k} = {${escape(v)}},`);
  }
  lines.push('}');
  return lines.join('\n');
}

function buildCiteKey(doc) {
  const author =
    (doc.authors && doc.authors[0] && doc.authors[0].last_name) || 'anon';
  const year = doc.year || 'nd';
  const title = (doc.title || 'untitled').split(/\s+/)[0].toLowerCase();
  return `${author.replace(/\W+/g, '')}_${year}_${title}`.replace(/[^A-Za-z0-9_]/g, '');
}

function escape(v) {
  return String(v).replace(/[{}]/g, '');
}
