const fs = require('fs');
var iconvlite = require('iconv-lite');
const Papa = require('papaparse');

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


module.exports = {
    readStrings,
    readItems

}
