/**
 * Lightweight CBETA genre / attribution labels from title + collection.
 * Heuristic only — not a substitute for catalog metadata.
 */

export type CbetaGenreLabel =
  | '經'
  | '律'
  | '論'
  | '疏'
  | '鈔'
  | '註'
  | '語錄'
  | '燈錄'
  | '傳記'
  | '史料'
  | '其他';

export function inferCbetaGenre(input: {
  titleZh?: string | null;
  collection?: string | null;
  workCode?: string | null;
}): CbetaGenreLabel {
  const title = (input.titleZh || '').normalize('NFC');
  // Commentary / lecture markers first —「心經疏」「法華經演義」≠ primary 經 body.
  if (/疏/.test(title)) return '疏';
  if (/鈔|抄/.test(title)) return '鈔';
  if (/註|注/.test(title)) return '註';
  if (/講錄|演義|經義|淺釋|句解|略解|通義|還源|幽贊|纂述|講義|講記/.test(title)) {
    return '疏';
  }
  if (/贊$|述$|解$/.test(title) && /經/.test(title)) return '疏';
  if (/律|毘尼|戒本/.test(title)) return '律';
  if (/論/.test(title)) return '論';
  if (/語錄|廣錄|會要|壇經/.test(title)) return '語錄';
  if (/傳燈|五燈|燈錄|指月|禪燈/.test(title)) return '燈錄';
  if (/高僧傳|比丘尼傳|僧傳|本傳|行狀|塔銘/.test(title)) return '傳記';
  if (/史|通紀|統紀|編年/.test(title)) return '史料';
  if (
    /阿含|般若|華嚴|法華|涅槃|金光明|楞嚴|圓覺|維摩|金剛|心經|無量壽|觀無量壽/.test(
      title,
    ) && /經/.test(title)
  ) {
    return '經';
  }
  // Prefer titles that are the scripture body (often end with 經).
  if (/經$/.test(title)) return '經';
  if (/經/.test(title) && !/記|錄|講|演|義|贊|述|解/.test(title)) return '經';
  const col = (input.collection || '').toUpperCase();
  if (col === 'T' && /n0?1\d{2,3}|n0?2\d{2}/i.test(input.workCode || '')) {
    // weak: many T works are sutras — leave 其他 unless title matched
  }
  return '其他';
}

export function genreAttributionBrief(genre: CbetaGenreLabel): string {
  switch (genre) {
    case '經':
      return 'Genre=經 (sutra). Attribute carefully; do not invent Buddha speech beyond the quote.';
    case '論':
      return 'Genre=論 (treatise). Attribute to the treatise author, not as direct Buddha speech.';
    case '疏':
    case '鈔':
    case '註':
      return `Genre=${genre} (commentary). Attribute the commentator; never present as sutra body.`;
    case '語錄':
      return 'Genre=語錄 (recorded sayings). Attribute the master/recorder, not as sutra.';
    case '燈錄':
      return 'Genre=燈錄 (transmission chronicle). Historical/lineage record — not sutra doctrine.';
    case '傳記':
    case '史料':
      return `Genre=${genre}. Historical/biographical source — not canonical doctrine by default.`;
    case '律':
      return 'Genre=律 (Vinaya). Disciplinary text — attribute accordingly.';
    default:
      return 'Genre=其他. State work title; do not upgrade to 經 without evidence.';
  }
}
