const assert = require('assert');
const { extractLegalOCamlLines } = require('../src/ts/extract-ocaml');

describe('extractLegalOCamlLines', () => {
  it('should filter out lines starting with val declarations', () => {
    const input = `val x : int -> int
    let y = 5`;
    const result = extractLegalOCamlLines(input);
    assert.deepStrictEqual(result, ['    let y = 5']);
  });

  it('should filter out lines with "Exception: ..." at the start', () => {
    const input = `Exception: Invalid_argument.
    let validLine = 3`;
    const result = extractLegalOCamlLines(input);
    assert.deepStrictEqual(result, ['    let validLine = 3']);
  });

  it('should filter out lines matching "- : ... at the start"', () => {
    const input = `- : int = 42
    let anotherValidLine = "Hello"`;
    const result = extractLegalOCamlLines(input);
    assert.deepStrictEqual(result, ['    let anotherValidLine = "Hello"']);
  });

  it('should filter out error location lines', () => {
    const input = `Line 12, characters 4-20:
    let validCode = true`;
    const result = extractLegalOCamlLines(input);
    assert.deepStrictEqual(result, ['    let validCode = true']);
  });

  it('should filter out variables with primes', () => {
    const input = `let x' = x + 1;;
val x' : int = 8`;
    const result = extractLegalOCamlLines(input);
    assert.deepStrictEqual(result, ['    let anotherLine = 1 + 2']);
  });

  it('Various exceptions that should all be filtered out', () => {
    const badLines = [
      `Warning 11 [redundant-case]: this match case is unused.`
    ];
    const input = badLines.join('\n');
    const result = extractLegalOCamlLines(input);
    assert.deepStrictEqual(result, []);
  });
});
