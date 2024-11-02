export function extractLegalOCamlLines(input: string): string[] {
    const lines = input.split('\n');
  
    const legalLines = lines.filter(line => {
      return !/^\s*val\s+\w+\s*:/.test(line) && // Matches 'val <name> :' at the start
             !/^\s*Exception:/.test(line) &&    // Matches 'Exception: ...' at the start
             !/^\s*-\s*:\s/.test(line) &&       // Matches '- : ...' at the start
             !/^\s*Line\s+\d+,.*/.test(line) && // Matches 'Line <number>, ...' for error locations
             !/^\s*Error:/.test(line);          // Matches 'Error: ...' at the start
    });
  
    return legalLines;
}

export function extractRunnableCode(code: string): string {
    const legalLines = extractLegalOCamlLines(code);
    return legalLines.join("\n");
}