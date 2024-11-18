export function extractLegalOCamlLines(input: string): string[] {
    const lines = input.split('\n');
  
    // Now that we defer prism.js, we can directly filter out terminal outputs
    // by checking if the line starts with ">"
    const legalLines = lines.filter(line => {
        return line.trim().length > 0 && !line.trim().startsWith(">");
    });
  
    return legalLines;
}

export function extractRunnableCode(code: string): string {
    const legalLines = extractLegalOCamlLines(code);
    return legalLines.join("\n");
}