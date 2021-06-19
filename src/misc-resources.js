const { readStrings, Scanner } = require('./file-reader');
const DS = require('./declarative-scanner');


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
    const textClientProcessor = DS.list(null, DS.pack(5), null);

    let result = [];
    for (const [tid, color, ob, ids, cb] of textClientProcessor(scanner)) {
        if (ob !== '{' || cb !== '}' || !ids.startsWith("IDS_")) {
            throw Error(
                "Unexpected format near "
                + `tid='${tid}' color='${color}' openBracket='${openBracket}' `
                + `ids='${ids}' close='${closeBracket}'`
            );
        }

        const v = mapping[ids];
        result[tid] = v !== undefined ? v : ids;
    }

    return result;
}


module.exports = {
    // TID related to DSTs parsing from WndManager.cpp
    readDSTMapping,
    // textClient.inc and textClient.txt.txt processing
    textClient
};
