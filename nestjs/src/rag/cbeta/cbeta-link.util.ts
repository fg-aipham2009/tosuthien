/**
 * Build CBETA Online reader URL from work_code + cbeta_ref_start.
 * Template env CBETA_ONLINE_URL_TEMPLATE may use {linehead}, {workCode}, {ref}.
 */

const DEFAULT_TEMPLATE =
  'https://cbetaonline.dila.edu.tw/zh/{linehead}';

/** e.g. work X72n1435 + ref 0348a22 → X72n1435_p0348a22 */
export function buildCbetaLinehead(
  workCode: string,
  cbetaRefStart: string | null | undefined,
): string | null {
  const work = (workCode || '').trim();
  if (!work) return null;
  const ref = (cbetaRefStart || '').trim().replace(/^p/i, '');
  if (!ref) return work;
  return `${work}_p${ref}`;
}

export function buildCbetaOnlineUrl(
  workCode: string,
  cbetaRefStart: string | null | undefined,
  template?: string | null,
): string | null {
  const linehead = buildCbetaLinehead(workCode, cbetaRefStart);
  if (!linehead) return null;
  const tpl = (template || '').trim() || DEFAULT_TEMPLATE;
  const ref = (cbetaRefStart || '').trim().replace(/^p/i, '');
  return tpl
    .replaceAll('{linehead}', linehead)
    .replaceAll('{workCode}', workCode.trim())
    .replaceAll('{ref}', ref);
}
