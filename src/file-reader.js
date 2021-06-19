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
// TID related to DSTs parsing from WndManager.cpp

/**
 * Extract from the given `WndManager.cpp` the initializer list 
 * @param {string} path The path to WndManager.cpp
 * @returns `{ g_DstString: string[], nDstRate: string[] }` The initializer list
 * read from the code
 */
function readDstMapping_scanSourceFile(path) {
    const scanner = Scanner.readFile(path, true);

    let where = 'Nowhere';

    let g_DstString = [];
    let nDstRate = [];

    let level = 0;

    while (true) {
        const token = scanner.nextString();
        if (token === null) break;

        if (token === 'g_DstString[]' || token === '_dstStrings') {
            where = 'g_DstString[]';
        } else if (token === 'nDstRate[]' || token === '_dstRate') {
            where = 'nDstRate[]';
        } else if (token === '=') {
            // noop
        } else if (token === '{') {
            if (where === 'g_DstString[]' || where === 'nDstRate[]') {
                where = where + '-f';
                level = 1;
            } else if (where === 'g_DstString[]-f' || where === 'nDstRate[]-f') {
                ++level;
            }
        } else if (token === '}') {
            if (level > 0) {
                --level;
            }
            if (level === 0) {
                where = 'Nowhere';
            }
        } else if (token === ',') {
            // noop
        } else {
            if (where === 'g_DstString[]' || where === 'nDstRate[]') {
                where = 'Nowhere';
            } else if (where === 'g_DstString[]-f') {
                g_DstString.push(token);
            } else if (where === 'nDstRate[]-f') {
                nDstRate.push(token);
            }
        }
    }

    return { g_DstString, nDstRate };
}

/**
 * Extract from `WndManager.cpp` code the mapping DST to how to display it.
 * @param {string} path Path to WndManager.cpp
 * @returns `{ dst, warnings: string[]}` where dst is a mapping DST_ID to 
 * `{ tid: string, isRate?: boolean }`.
 */
function readDSTMapping(path) {
    const { g_DstString, nDstRate } = readDstMapping_scanSourceFile(path);

    // Build dstProp.json
    const content = { dst: {}, warnings: [] };

    for (let i = 0; i + 1 < g_DstString.length; i += 2) {
        if (g_DstString[i] === '0' || g_DstString[i + 1] === '0') {
            continue;
        }

        content.dst[g_DstString[i]] = { 'tid': g_DstString[i + 1] };
    }

    for (const dst of nDstRate.filter(x => x !== '0' && x !== 'NULL')) {
        if (content.dst[dst] === undefined) {
            content.dst[dst] = {};
            content.warnings.push(
                `Warning: ${dst} is recognized as a dst rate but has no TID`
            );
        }

        content.dst[dst].isRate = true;
    }

    return content;
}


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// textClient.inc and textClient.txt.txt processing

/**
 * Builds the mapping between TIDs and actual text
 * @param {string} inc Path to textClient.inc
 * @param {string} txttxt Path to textClient.txt.txt
 * @returns A mapping TID to actual text
 */
function textClient(inc, txttxt) {
    const mapping = readStrings(txttxt);

    const scanner = Scanner.readFile(inc);

    let result = {};

    while (true) {
        const tid = scanner.nextString();

        if (tid === null) break;

        const color        = scanner.nextString();
        const openBracket  = scanner.nextString();
        const ids          = scanner.nextString();
        const closeBracket = scanner.nextString();

        if (openBracket !== '{' || closeBracket !== '}'
            || ids === null || !ids.startsWith("IDS_")) {
            throw Error(
                "Unexpected format near "
                + `tid='${tid}' color='${color}' openBracket='${openBracket}' ids='${ids}' close='${closeBracket}'`
            );
        }

        const v = mapping[ids];
        result[tid] = v !== undefined ? v : ids;
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
     * Consumes the next token. Throws if it was not the expected token
     * @param {string} expectedToken The expected token
     */
    expect(expectedToken) {
        const next = this.nextString();
        if (next !== expectedToken) {
            throw Error("expect('" + expectedToken + "') found '" + next + "'");
        }
    }

    /**
     * 
     * @param {*} handlers A dictionary of candidate handlers
     * @returns `null` if end of file has been reached, an
     * `{ error: string, type: string }` if no handler have been found, a
     * `{ type: string, data }` if a handler has been found and used.
     */
    nextStructuredData(handlers) {
        const type = this.nextString();
        if (type === null) return null;

        const handler = handlers[type];
        if (handler === undefined) {
            return { error: 'Invalid type found', type: type };
        }

        return { type, data: handler(this) };
    }

    /**
     * Return the next token that would be returned by `nextString()`, without
     * consuming it
     * @returns The next token
     */
    #peek() {
        if (this.i !== this.tokens.length) {
            return this.tokens[this.i];
        } else {
            return null;
        }
    }

    /**
     * Applies the `unaryFunction` to build new elements until `endSymbol` is
     * encountered.
     * @template T Type of elements returned by unaryFunction
     * @param {string?} endSymbol The symbol that makes the loop stops. You can
     * pass `null` to loop until the end of the file
     * @param {(Scanner) => T} unaryFunction A function that reads the next data
     * @returns {T[]} The elements produced by `unaryFunction`
     */
    consumeUntil(endSymbol, unaryFunction) {
        const elements = [];

        while (true) {
            const t = this.#peek();
            if (t === null) break;

            if (t === endSymbol) {
                this.nextString(); // Consume
                break;
            }

            elements.push(unaryFunction(this));
        }

        return elements;
    }
}

module.exports = {
    // File I/O primitives
    readFileSync, writeFileSync,
    // CScanner/CScript basic services
    readStrings, tokenize,
    // TID related to DSTs parsing from WndManager.cpp
    readDSTMapping,
    // textClient.inc and textClient.txt.txt processing
    textClient,
    // Scanner class
    Scanner
}
