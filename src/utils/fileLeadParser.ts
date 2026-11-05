// Universal File Parser for Prospectfy CRM
// Extracts phones, names, companies, websites, and links from SVG, HTML, PDF, CSV, TXT, JSON, XML, VCF

export interface ExtractedLead {
  phone: string;
  name: string;
  company: string;
  link?: string;
  notes?: string;
  sourceFile: string;
}

export interface ParseResult {
  fileName: string;
  fileSize: number;
  totalFound: number;
  leads: ExtractedLead[];
  extractedLinks: string[];
}

// Regex to capture Brazilian and international telephone numbers
// Matches: +55 (74) 98812-6578, 74 98812-6578, 74988126578, wa.me/557488126578, tel:+557488126578
const PHONE_REGEX = /(?:(?:wa\.me\/|tel:|\+?55\s?)(?:\(?0?([1-9]{2})\)?\s?)?(?:9\s?[6-9]\d{3}[-\s]?\d{4}|\d{4}[-\s]?\d{4})|(?:\(?0?([1-9]{2})\)?\s?)(?:9\s?[6-9]\d{3}[-\s]?\d{4}|\d{4}[-\s]?\d{4}))/gi;

// Secondary broader phone regex for general text
const BROAD_PHONE_REGEX = /(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?[\s.-]?)?(?:9\s?[6-9]\d{3}[\s.-]?\d{4}|\d{4}[\s.-]?\d{4})/g;

// URL Regex
const URL_REGEX = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+/gi;

/**
 * Normalizes phone number into E.164 Brazilian standard (e.g. 5574988126578).
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

/**
 * Parses raw text content and extracts all contacts, names, companies, and links.
 */
export function parseRawText(content: string, fileName: string): ParseResult {
  const leadsMap = new Map<string, ExtractedLead>();
  const extractedLinksSet = new Set<string>();

  // 1. Extract Links
  const links = content.match(URL_REGEX) || [];
  links.forEach(l => {
    if (!l.includes('w3.org') && !l.includes('schema.org') && !l.includes('localhost')) {
      extractedLinksSet.add(l);
    }
  });

  // 2. Look for wa.me or tel: links specifically
  const waLinks = content.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|\btel:)(\+?\d+)/gi) || [];
  for (const wa of waLinks) {
    const rawNumber = wa.replace(/wa\.me\/|api\.whatsapp\.com\/send\?phone=|\btel:/gi, '').replace(/\D/g, '');
    const clean = normalizePhone(rawNumber);
    if (clean.length >= 10 && clean.length <= 13) {
      leadsMap.set(clean, {
        phone: clean,
        name: `Lead WhatsApp`,
        company: 'Empresa Captada',
        link: wa.startsWith('http') ? wa : `https://${wa}`,
        notes: `Importado de link do arquivo ${fileName}`,
        sourceFile: fileName,
      });
    }
  }

  // 3. Line by Line analysis for structured files (CSV, TXT, HTML blocks)
  const lines = content.split(/[\r\n]+/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Search phones in line
    const foundPhones = line.match(BROAD_PHONE_REGEX);
    if (foundPhones) {
      for (const rawP of foundPhones) {
        const clean = normalizePhone(rawP);
        // Valid Brazilian phone lengths with 55 DDD: 12 or 13 digits
        if (clean.length >= 10 && clean.length <= 13) {
          
          // Determine name and company from the line
          let remainingLine = line
            .replace(rawP, '')
            .replace(/[,;|\t\-–—]/g, ' ')
            .replace(/<[^>]+>/g, ' ') // Strip HTML tags
            .replace(/\s+/g, ' ')
            .trim();

          // Extract potential website from line
          const lineLink = remainingLine.match(URL_REGEX)?.[0];
          if (lineLink) {
            remainingLine = remainingLine.replace(lineLink, '').trim();
          }

          let candidateName = '';
          let candidateCompany = '';

          // Check if formatted like "Nome - Empresa" or CSV fields
          const parts = remainingLine.split(/\s{2,}|\s-\s|\s\|\s/).map(p => p.trim()).filter(Boolean);
          if (parts.length >= 2) {
            candidateName = parts[0];
            candidateCompany = parts[1];
          } else if (parts.length === 1 && parts[0].length >= 2) {
            // If words look like a person name
            candidateName = parts[0];
            candidateCompany = 'Empresa do Contato';
          } else {
            // Check previous or next line for potential header/name
            const prevLine = lines[i - 1]?.trim().replace(/<[^>]+>/g, '').trim();
            if (prevLine && prevLine.length < 50 && !prevLine.match(BROAD_PHONE_REGEX)) {
              candidateName = prevLine;
            } else {
              candidateName = `Lead ${clean.slice(-4)}`;
            }
            candidateCompany = 'Empresa';
          }

          // Clean names from HTML entities or code symbols
          candidateName = candidateName
            .replace(/&(amp|quot|lt|gt);/g, '')
            .replace(/[<>{}[\]]/g, '')
            .slice(0, 50)
            .trim() || `Contato ${clean.slice(-4)}`;

          candidateCompany = candidateCompany
            .replace(/&(amp|quot|lt|gt);/g, '')
            .replace(/[<>{}[\]]/g, '')
            .slice(0, 50)
            .trim() || 'Empresa';

          if (!leadsMap.has(clean)) {
            leadsMap.set(clean, {
              phone: clean,
              name: candidateName,
              company: candidateCompany,
              link: lineLink || Array.from(extractedLinksSet)[0],
              notes: `Importado de ${fileName}`,
              sourceFile: fileName,
            });
          }
        }
      }
    }
  }

  // 4. HTML / SVG specific tag parsing (if file contains markup)
  if (content.includes('<') && content.includes('>')) {
    // Regex for text inside tags: <text>...</text>, <td>...</td>, <li>...</li>, <span>...</span>
    const tagMatches = content.match(/<(?:text|tspan|td|th|li|span|p|a|h[1-6])[^>]*>([\s\S]*?)<\/(?:text|tspan|td|th|li|span|p|a|h[1-6])>/gi) || [];
    
    for (const tag of tagMatches) {
      const textOnly = tag.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const phones = textOnly.match(BROAD_PHONE_REGEX);
      if (phones) {
        for (const p of phones) {
          const clean = normalizePhone(p);
          if (clean.length >= 10 && clean.length <= 13 && !leadsMap.has(clean)) {
            const rawName = textOnly.replace(p, '').replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();
            leadsMap.set(clean, {
              phone: clean,
              name: rawName ? rawName.slice(0, 40).trim() : `Contato ${clean.slice(-4)}`,
              company: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
              sourceFile: fileName,
              notes: `Extraído de tag gráfica/SVG/HTML`,
            });
          }
        }
      }
    }
  }

  const leads = Array.from(leadsMap.values());

  return {
    fileName,
    fileSize: content.length,
    totalFound: leads.length,
    leads,
    extractedLinks: Array.from(extractedLinksSet).slice(0, 20),
  };
}

/**
 * Reads any File object from browser input (PDF, HTML, SVG, TXT, CSV, etc.) and extracts leads.
 */
export async function parseFileForLeads(file: File): Promise<ParseResult> {
  const fileName = file.name;
  const fileType = file.type;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const textContent = (reader.result as string) || '';
        const result = parseRawText(textContent, fileName);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error(`Falha ao ler o arquivo ${fileName}`));
    };

    // Read as plain text (works for SVG, HTML, CSV, TXT, JSON, XML, and ASCII-embedded PDF streams)
    reader.readAsText(file, 'UTF-8');
  });
}
