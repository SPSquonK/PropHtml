import fs from 'fs';
import iconvlite from 'iconv-lite';

export type ReadFileSyncAnswer = string | { content: string, encoding:string };

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// File I/O primitives

/**
 * Returns the encoding used in the buffer
 * @param buffer The buffer that contains the text to decode
 * @returns Either 'utf-16be' or 'cp1252'
 */
function getEncoding(buffer: Buffer): 'utf-16le' | 'cp1252' {
  if (buffer.length >= 2 && buffer[0] == 0xFF && buffer[1] == 0xFE) {
    return 'utf-16le';
  } else {
    return 'cp1252';
  }
}

/**
 * Reads the content of the file. Tries to guess the encoding between UTF-16 BE
 * with BOM and Windows-1252
 * @param path Path to the file to read
 * @returns The content of the file.
 */
export function readFileSync(path: string): string {
  const buffer = fs.readFileSync(path);
  const encoding = getEncoding(buffer);
  return iconvlite.decode(buffer, encoding);
}

/**
 * Reads the content of the file. Tries to guess the encoding between UTF-16 BE
 * with BOM and Windows-1252
 * @param path Path to the file to read
 * @returns The content of the file and its encoding
 */
export function readFileSyncWithEncoding(path: string): ReadFileSyncAnswer {
  const buffer = fs.readFileSync(path);
  const encoding = getEncoding(buffer);
  const result = iconvlite.decode(buffer, encoding);
  return { content: result, encoding: encoding };
}

/**
 * Rewrites the content of the file. If not provided, tries to guess the
 * encoding to use by first reading the file, deciding between UTF-16 BE with
 * BOM and Windows-1252.
 * @param path Path to the file to rewrite
 * @param content The content to write
 * @param encoding Encoding to use
 */
export function writeFileSync(path: string, content: string, encoding?: string) {
  if (!fs.existsSync(path)) {
    throw Error(
      "FR.WriteFileSync can only write on existing files "
      + " for encoding reasons"
    );
  }

  encoding = encoding || getEncoding(fs.readFileSync(path));
  const buffer = iconvlite.encode(content, encoding);
  fs.writeFileSync(path, buffer);
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// CScanner/CScript basic services

/**
 * Reads the given .txt.txt file to build a TID -> strings mapping
 * @param path Path to the file that contains the string
 * @returns The mapping TID -> strings
 */
export function readStrings(path: string) {
  return (readFileSync(path) as string)
    .split(/\r?\n/)
    .filter(x => x !== "" && !x.startsWith("//"))
    .reduce((acc, line) => {
      let realLine = line.trim();

      const spaceIndex = [" ", "\t"]
        .map(character => realLine.indexOf(character))
        .reduce((acc, value) => {
          if (value === -1) return acc;
          if (acc === -1 || acc > value) return value;
          return acc;
        }, -1);

      if (spaceIndex == -1) {
        acc[realLine] = "";
      } else {
        acc[realLine.substr(0, spaceIndex)] = realLine.substr(spaceIndex + 1).trim()
      }

      return acc;
    }, {} as {[tid: string]: string}
  );
}

/**
 * Transform a string to an array of tokens
 * @param {string} str The line to parse
 */
export function tokenize(str: string) {
  /* Enum state */
  enum State { Space, Word, Quote };

  // Symbols that are tokens
  const loneSymbols = [ '{', '}', '=', ';', ',', '(', ')' ];

  let result = [];

  let begin = 0; 
  let currentState = State.Space;
  let numberOfQuotes = 0;
  let ascend = true;

  for (let cursor = 0; cursor <= str.length; ++cursor) {
    const currentChar = cursor == str.length ? "\0" : str[cursor];
    const isWhitespace =
      currentChar == "\0" ||
      currentChar == "\t" ||
      currentChar == " " ||
      currentChar == " " ||
      currentChar == "\r";

    if (currentState == State.Space) {
      if (!isWhitespace) {
        begin = cursor;
        if (currentChar == '"') {
          currentState = State.Quote;
          numberOfQuotes = 1;
          ascend = true;
        } else {
          currentState = State.Word;
        }
      }
    } else if (currentState == State.Word) {
      if (isWhitespace) {
        result.push(str.substr(begin, cursor - begin));
        currentState = State.Space;
      } else if (loneSymbols.indexOf(currentChar) !== -1) {
        result.push(str.substr(begin, cursor - begin));
        begin = cursor;
      } else if (
        begin == cursor - 1 &&
        loneSymbols.indexOf(str[begin]) !== -1
      ) {
        result.push(str.substr(begin, cursor - begin));
        begin = cursor;
      }
    } else if (currentState == State.Quote) {
      if (currentChar == '"') {
        if (ascend) {
          ++numberOfQuotes;
        } else {
          --numberOfQuotes;
        }
      } else if (isWhitespace) {
        if (ascend) {
          if (numberOfQuotes % 2 == 0) {
            currentState = State.Space;
            result.push(str.substr(begin, cursor - begin));
          } else {
            ascend = false;
          }
        } else {
          if (numberOfQuotes == 0) {
            currentState = State.Space;
            result.push(str.substr(begin, cursor - begin));
          }
        }
      } else {
        if (ascend) ascend = false;
      }
    }
  }

  return result;
}


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Scanner class

/**
 * The Scanner class mimics the behaviour of the CScanner/CScript classes
 */
export class Scanner {
  /** List of tokens analyzed by the scanner */ tokens: string[];
  /** Currently analyzed token */               i: number;
  
  /**
   * Build a new `Scanner` for the file on the given path
   * @param path The path to scan
   * @param removeMacroLines If set to true, macro lines will be removed
   * @returns A new `Scanner` on the given file
   */
  static readFile(path: string, removeMacroLines: boolean = false) {
    return new Scanner(readFileSync(path), removeMacroLines);
  }

  /**
   * Builds a scanner for a string
   * @param content The text to scan
   * @param removeMacroLines If set to true, macro lines will be removed
   */
  constructor(content: string, removeMacroLines: boolean = false) {
    this.tokens = content.replace('\r', '\n').split("\n")
      .map(x => {
          const comment = "//";
          const commentIndex = x.indexOf(comment);
          if (commentIndex == -1) return x;
          return x.substr(0, commentIndex);
      })
      .filter(x => x != '' && x != '\r' && !(removeMacroLines && x.trim().startsWith("#")))
      .flatMap(tokenize);
    
    // Remove /* */ comments
    let last = 0;
    while (true) {
      const open = this.tokens.indexOf("/*", last);
      if (open === -1) break;

      last = open;

      const close = this.tokens.indexOf("*/", last);

      if (close === -1) {
        this.tokens.splice(open, this.tokens.length - open);
      } else {
        this.tokens.splice(open, close - open + 1);
      }
    }

    this.i = 0;
  }

  /**
   * Returns the next token
   * @returns The next token, or `null` if the end of the content has been reached
   */
  nextString(): string | null {
    if (this.i == this.tokens.length) {
      return null;
    }

    const token = this.tokens[this.i];
    ++this.i;
    return token;
  }

  /**
   * Return the next token that would be returned by `nextString()`, without
   * consuming it
   * @returns The next token
   */
  peek() {
    if (this.i !== this.tokens.length) {
      return this.tokens[this.i];
    } else {
      return null;
    }
  }
}
