const fs = require('fs');
var iconvlite = require('iconv-lite');

function r(s) {
    let ss = s.replace('\x00', '').replace('\r', '').replace('\t', ' ');

    if (s != ss) return r(ss);
    return s.trim();
}

function _readFile(path) {
    return iconvlite.decode( fs.readFileSync(path), "cp1252")
        .split(/\r?\n/)
        .map(x => r(x))
        .filter(x => x !== "" && !x.startsWith("//"));
}

function readStrings(path) {
    return _readFile(path)
        .reduce(
            (acc, line) => {
                let realLine = line.trim();
                let spaceIndex = realLine.indexOf(" ");
                if (spaceIndex == -1) spaceIndex = realLine.indexOf("\t");
                if (spaceIndex == -1) spaceIndex = realLine.indexOf("	");

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
    const SpaceState = 0;
    const WordState = 1;
    const QuoteState = 2;

    let result = [];

    let begin = 0;
    let cursor = 0;
    let currentState = SpaceState;
    let numberOfQuotes = 0;
    let ascend = true;

    for (;cursor <= str.length; ++cursor) {
        const currentChar = cursor == str.length ? '\0' : str[cursor];
        const isWhitespace = currentChar == '\0' || currentChar == '\t' || currentChar == ' ' || currentChar == ' ';

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

function readItems(path) {
    let items = _readFile(path).map(tokenize);

    let sizes = {};
    items.map(i => i.length).forEach(i => sizes[i] = sizes[i] == undefined ? 1 : sizes[i] + 1);

    if (Object.keys(sizes).length !== 1) {
        console.error(sizes);

        items.filter(i => i.length == 12).forEach(i => console.log(i));

        throw Error('Bad parsing of itemProp.txt');
    }

    return items;
}

function readDSTMapping(path) {
    const DST_STRING = "static DST_STRING g_DstString[] =";
    const DST_RATE = "static int nDstRate[] = {";

    let where = "Nowhere";

    let g_DstString = [];
    let nDstRate = [];

    for (const line_ of _readFile(path)) {
        let line = line_.trim();

        let comment = line.indexOf("//");
        if (comment !== -1) line = line.substr(0, comment).trim();

        if (line == "") continue;
        if (line.startsWith("#")) continue;

        if (where == "Nowhere") {
            if (line == DST_STRING) {
                where = "String";
            } else if (line == DST_RATE) {
                where = "Rate";
            }
        } else if (where == "String") {
            if (line == "};") {
                where = "Nowhere";
            } else if (line == "{") {
                // noop
            } else {
                line.split(",")
                    .map(s => s.trim())
                    .filter(x => x != '')
                    .forEach(x => g_DstString.push(x));
            }
        } else if (where == "Rate") {
            if (line == "};") {
                where = "Nowhere";
            } else {
                line.split(",")
                    .map(s => s.trim())
                    .filter(x => x != '' && x != '0')
                    .forEach(x => nDstRate.push(x));
            }
        }
    }

    return {
        dstStrings: (() => {
            let xs = {};
            for (let i = 0 ; i < g_DstString.length - 1 ; i += 2) {
                if (g_DstString[i] === '0' || g_DstString[i + 1] === '0') {
                    continue;
                }

                xs[g_DstString[i]] = g_DstString[i + 1];
            }
            return xs;
        })(),
        dstRates: new Set(nDstRate)
    };
}

function textClient(inc, txttxt) {
    const mapping = readStrings(txttxt);

    const scanner = new Scanner(_readFile(inc).join('\n'));

    let result = {};

    while (true) {
        const tid = scanner.getString();

        if (tid === null) break;

        const color        = scanner.getString();
        const openBracket  = scanner.getString();
        const ids          = scanner.getString();
        const closeBracket = scanner.getString();


        if (openBracket !== '{' || closeBracket !== '}'
            || ids === null || !ids.startsWith("IDS_")) {
            
            throw Error("Unexpected format near "
            + `${tid} ${color} ${openBracket} ${ids} ${closeBracket}`);
        }

        const v = mapping[ids];
        result[tid] = v !== undefined ? v : ids;
    }
    
    return result;
}


class Scanner {
    static readFile(path) {
        return new Scanner(readFile(path).join("\n"));
    }

    constructor(content) {
        this.tokens = content.split("\n")
            .map(x => {
                const comment = "//";
                const commentIndex = x.indexOf(comment);
                if (commentIndex == -1) return x;
                return x.substr(0, commentIndex);
            })
            .filter(x => x != '')
            .flatMap(tokenize);

        // Remove weird character
        if (this.tokens[0] == "ÿþ") {
            this.tokens.splice(0, 1);
        }

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

    all_tokens() {
        return this.tokens;
    }

    getString() {
        if (this.i == this.tokens.length) {
            return null;
        }

        const token = this.tokens[this.i];
        ++this.i;
        return token;
    }


}

module.exports = {
    readFile: _readFile,
    tokenize: tokenize,
    readStrings,
    readItems,
    readDSTMapping,
    textClient
}
