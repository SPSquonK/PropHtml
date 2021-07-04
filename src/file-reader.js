const fs = require('fs');
const iconvlite = require('iconv-lite');


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// File I/O primitives

/**
 * Returns the encoding used in the buffer
 * @param {Buffer} buffer The buffer that contains the text to decode
 * @returns {string} Either 'utf-16be' or 'cp1252'
 */
function _getEncoding(buffer) {
    if (buffer.length >= 2 && buffer[0] == 0xFF && buffer[1] == 0xFE) {
        return 'utf-16le';
    } else {
        return 'cp1252';
    }
}

/**
 * Reads the content of the file. Tries to guess the encoding between UTF-16 BE
 * with BOM and Windows-1252
 * @param {string} path Path to the file to read
 * @param {boolean} withEncoding If true, instead of a string, a dictionary is
 * returned with the content of the file and its encoding
 * @returns {string | { content: string, encoding:string }} The content of the
 * file.
 */
function readFileSync(path, withEncoding = false) {   
    const buffer = fs.readFileSync(path);
    const encoding = _getEncoding(buffer);
    const result = iconvlite.decode(buffer, encoding);
    if (withEncoding) {
        return { content: result, encoding: encoding };
    } else {
        return result;
    }
}

/**
 * Rewrites the content of the file. If not provided, tries to guess the
 * encoding to use by first reading the file, deciding between UTF-16 BE with
 * BOM and Windows-1252.
 * @param {string} path Path to the file to rewrite
 * @param {string} content The content to write
 * @param {string?} encoding Encoding to use
 */
function writeFileSync(path, content, encoding) {
    if (!fs.existsSync(path)) {
        throw Error(
            "FR.WriteFileSync can only write on existing files "
            + " for encoding reasons"
        );
    }

    encoding = encoding || _getEncoding(fs.readFileSync(path));
    const buffer = iconvlite.encode(content, encoding);
    fs.writeFileSync(path, buffer);
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// CScanner/CScript basic services

/**
 * Reads the given .txt.txt file to build a TID -> strings mapping
 * @param {string} path Path to the file that contains the string
 * @returns The mapping TID -> strings
 */
function readStrings(path) {
    return readFileSync(path)
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
        }, {}
    );
}

/**
 * Transform a string to an array of tokens
 * @param {string} str The line to parse
 */
function tokenize(str) {
    /* Enum state */
    const SpaceState = 0;
    const WordState = 1;
    const QuoteState = 2;
    // Symbols that are tokens
    const loneSymbols = [ '{', '}', '=', ';', ',', '(', ')' ];

    let result = [];

    let begin = 0; 
    let currentState = SpaceState;
    let numberOfQuotes = 0;
    let ascend = true;    

    for (let cursor = 0; cursor <= str.length; ++cursor) {
        const currentChar = cursor == str.length ? '\0' : str[cursor];
        const isWhitespace = currentChar == '\0' || currentChar == '\t' || currentChar == ' ' || currentChar == ' ' || currentChar == '\r';

        if (currentState == SpaceState) {
            if (!isWhitespace) {
                begin = cursor;
                if (currentChar == '\"') {
                    currentState = QuoteState;
                    numberOfQuotes = 1;
                    ascend = true;
                } else {
                    currentState = WordState;                    
                }
            }
        } else if (currentState == WordState) {
            if (isWhitespace) {
                result.push(str.substr(begin, cursor - begin));
                currentState = SpaceState;
            } else if (loneSymbols.indexOf(currentChar) !== -1) {
                result.push(str.substr(begin, cursor - begin));
                begin = cursor;
            } else if (begin == cursor - 1
                && loneSymbols.indexOf(str[begin]) !== -1) {
                result.push(str.substr(begin, cursor - begin));
                begin = cursor;
            }
        } else if (currentState == QuoteState) {
            if (currentChar == '\"') {
                if (ascend) {
                    ++numberOfQuotes;
                } else {
                    --numberOfQuotes;
                }
            } else if (isWhitespace) {
                if (ascend) {
                    if (numberOfQuotes % 2 == 0) {
                        currentState = SpaceState;
                        result.push(str.substr(begin, cursor - begin));
                    } else {
                        ascend = false;
                    }
                } else {
                    if (numberOfQuotes == 0) {
                        currentState = SpaceState;
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
class Scanner {
    /**
     * Build a new `Scanner` for the file on the given path
     * @param {string} path The path to scan
     * @param {boolean?} removeMacroLines If set to true, macro lines will be
     * removed
     * @returns A new `Scanner` on the given file
     */
    static readFile(path, removeMacroLines = false) {
        return new Scanner(readFileSync(path), removeMacroLines);
    }

    /**
     * Builds a scanner for a string
     * @param {string} content The text to scan
     * @param {boolean?} removeMacroLines If set to true, macro lines will be
     * removed
     */
    constructor(content, removeMacroLines = false) {
        this.tokens = content.replace('\r', '\n').split("\n")
            .map(x => {
                const comment = "//";
                const commentIndex = x.indexOf(comment);
                if (commentIndex == -1) return x;
                return x.substr(0, commentIndex);
            })
            .filter(x => x != '' && x != '\r' &&
                !(removeMacroLines && x.trim().startsWith("#"))
            )
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
     * @returns {string?} The next token, or `null` if the end of the content
     * has been reached
     */
    nextString() {
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

module.exports = {
    // File I/O primitives
    readFileSync, writeFileSync,
    // CScanner/CScript basic services
    readStrings, tokenize,
    // Scanner class
    Scanner
}
