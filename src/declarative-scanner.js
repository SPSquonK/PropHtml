
/* A declarative/functionnal API for Scanner processing */

/**
 * @typedef { import("./file-reader").Scanner } Scanner
 */

/**
 * Builds a function that reads the next token
 * @returns {function(Scanner): string}
 */
function identity() {
    return scanner => scanner.nextString();
}

/**
 * Builds a function that reads the next `quantity` elements from the Scanner
 * and return them
 * @param {number} quantity Number of elements to consume
 * @returns {function(Scanner): string[]}
 */
function pack(quantity) {
    return scanner => {
        const elements = [];
        for (let i = 0; i != quantity; ++i) {
            const e = scanner.nextString();

            if (e === null) {
                throw Error("pack(" + quantity + ") encountered an EOF");
            }

            elements.push(e);
        }
        return elements;
    };
}

/**
 * Builds a function that reads a list of elements in the `Scanner`.
 * @template T Type of the elements returned by the unary function
 * @param {string?} beginSymbol The symbol to detect for the beginning of the
 * list
 * @param {function(Scanner): T} unaryFunction A function to produce each
 * element of the list
 * @param {string?} endSymbol The symbol that marks the end of the list. If set
 * to `null` or `undefined`, the whole the scanner will be consumed.
 * @returns {function(Scanner): T[]}
 */
function list(beginSymbol, unaryFunction, endSymbol) {
    if (endSymbol === undefined) endSymbol = null;

    if (unaryFunction === undefined && endSymbol === undefined) {
        // list(unaryFunction) <=> list(undefined, unaryFunction, undefined)
        beginSymbol = undefined;
        unaryFunction = beginSymbol;
    }

    return scanner => {
        if (beginSymbol !== null && beginSymbol !== undefined) {
            let s = scanner.nextString();
            if (s !== beginSymbol) {
                throw Error(
                    "list expected a begin of list <" +
                    beginSymbol + "> but found <" + s + ">"
                );
            }
        }

        const elements = [];

        while (true) {
            const peek = scanner.peek();
            if (peek === endSymbol) {
                if (endSymbol !== null) scanner.nextString();
                break;
            } else if (peek === null) {
                throw Error("Unexpected end of file in list");
            }

            elements.push(unaryFunction(scanner));
        }

        return elements;
    };
}


/**
 * Reads the next token and look in the `possibleValues` what is the next
 * function to use
 * @param {*} possibleValues A dictionary with the first token to read and then
 * the handler for the following tokens
 * @return {function(Scanner: any)}
 */
function either(possibleValues) {
    return scanner => {
        const type = scanner.nextString();

        if (possibleValues[type] == undefined) {
            throw Error('either: Unknown type ' + type);
        }

        return [type, possibleValues[type](scanner)];
    };
}

/**
 * Syntactic sugar for `list(beginSymbol, either(fields), endSymbol)`
 * @param {*} beginSymbol 
 * @param {*} fields 
 * @param {*} endSymbol 
 * @returns 
 */
function listEither(beginSymbol, fields, endSymbol) {
    return list(beginSymbol, either(fields), endSymbol)
}

/**
 * Build a function that consumes the scanner with the given functions, in order
 * and produce an array of the results
 * @param {(function(Scanner): any)[]} functions The functions to apply
 * @returns {function(Scanner): any[]}
 */
function sequential(functions) {
    return scanner => functions.map(func => func(scanner));
}

module.exports = {
    listEither,
    either,
    identity,
    list,
    pack,
    sequential
};
