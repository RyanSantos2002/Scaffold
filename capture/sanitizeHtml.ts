import * as cheerio from "cheerio";

export default function sanitizeHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove tags inúteis
  $("script, link, meta, style").remove();

  // Remove atributos inline de eventos (onclick, onchange, etc)
  $("*").each((_, element) => {
    const el = $(element);
    const attrs = el.attr();

    if (!attrs) return;

    for (const attr of Object.keys(attrs)) {
      if (attr.toLowerCase().startsWith("on")) {
        el.removeAttr(attr);
      }
    }
  });

  return $.html();
}
