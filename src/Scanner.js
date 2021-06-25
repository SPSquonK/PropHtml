const { readFileSync, tokenize } = require('./file-reader');

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Tokenizer

/** A Tokenizer splits a string by tokens. */
class Tokenizer {
    /**
     * Builds a Tokenizer for the given string
     * @param {string} content The string to analyze
     */
    constructor(content) {
        this.content = content;
        this.cursor = 0;
    }

    /**
     * Returns the next token read by the tokenizer
     * @returns {{type: string, str: string}?} The next token, or null if end of
     * string has been reached
     */
    nextToken() {
        if (this.cursor === this.content.length) {
            return null;
        }

        const begin = this.cursor;

        const firstCharacter = this.content[begin];

        if (this.#isWhitespace(firstCharacter)) {
            return {
                type: 'whitespace',
                str: this.#consumeUntil(c => this.#isWhitespace(c))
            }
        } else {
            let inQuote = false;

            const isOk = char => {
                if (!inQuote && this.#isWhitespace(char)) {
                    return false;
                }

                if (char === '"') inQuote = !inQuote;
                return true;
            }

            return {
                type: 'string',
                str: this.#consumeUntil(isOk)
            };
        }
    }

    nextNonWhitespace() {
        while (true) {
            const token = this.nextToken();
            if (token === null) return null;
            if (token.type !== 'whitespace') return token.str;
        }
    }

    /**
     * Return the token that will be the next `nextToken` call, but
     * does not change the state of this object
     * @returns {{type: string, str: string}?} The next token, or null if end of
     * string has been reached
     */
    peek() {
        const currentCursor = this.cursor;
        const result = this.nextToken();
        this.cursor = currentCursor;
        return result;
    }


    goToNonWhitespace(tokens) {
        while (true) {
            let token = this.peek();
            if (token === null) return;
            if (token.type !== 'whitespace') return;

            tokens.push(token.str);
            this.nextToken();
        }
    }

    /**
     * Checks if the character is a whitespace symbol
     * @param {string} character The character
     * @returns {boolean} True if `character` is a whitespace symbol
     */
    #isWhitespace(character) {
        return character == ' ' || character == '\t'
            || character == '\r' || character == '\n';
    }


    /**
     * Builds a token by consuming every character that returns true for the
     * given predicate
     * @param {function(string): boolean} predicate A predicate that tells when
     * a character should not be consumed
     */
    #consumeUntil(predicate) {
        let beginning = this.cursor;
        while (this.cursor < this.content.length
            && predicate(this.content[this.cursor])) {
            ++this.cursor;
        }

        return this.content.substr(beginning, this.cursor - beginning);
    }
}


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Scanners

/**
 * An `AbstractScanner` is a class that is able to scan a string and extract
 * from it structured data, depending on the `AbstractScanner` implementation.
 * 
 * Scanners are intended to be composed to be able to easily exhibit the
 * structure of a FlyFF resource file and split the file processing from the
 * data storage / reorganization logic
 * 
 * @template {T} 
 */
class AbstractScanner {
    /**
     * Parse the given string by using the scanner. The scanner must be able
     * to parse the whole string.
     * @param {string} content The string to parse
     * @returns {T} The parsed structure, the return type depends on the
     * actual AbstractScanner implementation
     */
    parse(content) {
        const tokenizer = new Tokenizer(content);

        let result = this._process(tokenizer);

        while (true) {
            let n = tokenizer.nextToken();
            if (n === null) break;
            if (n.type !== 'whitespace') {
                this._raiseError(
                    'Not everything was consumed, currently on <' + n.str + '>'
                );
            }
        }

        return result;
    }

    /**
     * Fixes the `original` string to have the data of `replacements`.
     * @param {string} original The string that you currently have
     * @param {T} replacements The result that you want from the calls
     * of the parse function on the returned string
     * @returns {string} The string with a formatting that tries to be close to
     * `original` but with the data of `replacements`.
     */
    fix(original, replacements) {
        let rebuiltString = "";

        const tokenizer = new Tokenizer(original);

        const consumeWhitespaces = () => {
            while (true) {
                let peeked = tokenizer.peek();
                if (peeked !== null && peeked.type === 'whitespace') {
                    rebuiltString += tokenizer.nextToken().str;
                } else {
                    break;
                }
            }
        };

        // consumeWhitespaces(); 
        // -> should be managed by this scanner but I'm not sure if whitespace
        // conservation should be done by fix or _fixing

        rebuiltString += this._fixing(tokenizer, replacements);

        consumeWhitespaces();

        if (tokenizer.peek() !== null) {
            this._raiseError('Fix has not fixed the whole string ' + JSON.stringify(tokenizer.peek()));
        }

        return rebuiltString;
    }

    /**
     * Transforms the next token(s) of the tokenizer into structured data.
     * @param {Tokenizer} tokenizer The tokenizer
     * @returns {T} The structured data
     */
    /* istanbul ignore next */
    _process(tokenizer) {
        throw Error("AbstractScanner::_process is abstract");
    }

    /**
     * Produces the string 
     * 
     * `AbstractScanner` implementation dependant fix method
     * @param {Tokenizer} tokenizer The tokenizer used
     * @param {T} replacements 
     */
    /* istanbul ignore next */
    _fixing(tokenizer, replacements) {
        throw Error("AbstractScanner::_fixing is abstract");
    }

    /**
     * Throws an error with the given message.
     * 
     * In the future, the error may be enriched with some extra context.
     * @param {string} message The message
     */
    _raiseError(message) {
        // TODO: make the _raiseError function add some context
        throw new Error(message);
    }

    _raiseNotEnoughTokenError(foundQuantity, expectedQuantity) {
        throw new Error(
            'Not enough token found: expected ' + expectedQuantity
            + ' for the currents scanner but found ' + foundQuantity
        );
    }
}


/**
 * A Scanner that looks for a precise token
 * 
 * In the current version, the PreciseToken can't be explicitely instancied by
 * the user, but it will be if a string is provided in the sequenece of
 * Sequential.
 */
 class PreciseToken extends AbstractScanner {
    /**
     * Builds a Scanner that look for the expected token, and can only parse
     * this one
     * @param {string} expected The only token this Scanner accepts
     */
    constructor(expected) {
        super();
        this.expected = expected;
    }

    /**
     * Check if the next token in the tokenizer is the expected one by this
     * Scanner.
     * @param {Tokenizer} tokenizer The tokenizer
     * @returns {string} The expected token
     * @throws Will throw if the next token is not the expected one
     * @override
     */
    _process(tokenizer) {
        const token = tokenizer.nextNonWhitespace();

        if (token !== this.expected) {
            this._raiseError(
                'Expected ' + this.expected + " but found " + token
            );
        }

        return this.expected;
    }

    /**
     * Consumes the next token, which must be the expected one and return it
     * with the found leading whitespace in the tokenizer.
     * @param {Tokenizer} tokenizer The tokenizer with the source data
     * @param {string} replacements Must be the expected token
     * @returns {string} The expected string, with the leading whitespaces found
     * to reach it
     * @throws If the next concrete token is not the expected one.
     * @override
     */
    _fixing(tokenizer, replacements) {
        if (replacements !== this.expected) {
            this._raiseError(
                "PreciseToken::_fixing can't modify the content"
            )
        }

        let r = [];
        tokenizer.goToNonWhitespace(r);
        const n = tokenizer.nextToken();
        if (n === null || n.str !== this.expected) {
            this._raiseError(
                "PreciseToken::_fixing didn't found " + this.expected
            );
        }

        return r.join("") + this.expected;
    }
}


/**
 * T = string
 */
class Identity extends AbstractScanner {
    /**
     * @override
     */
    _process(tokenizer) {
        while (true) {
            let token = tokenizer.nextToken();
            if (token === null) {
                this._raiseError("No token found but expectedOne");
            }

            if (token.type !== 'whitespace') {
                return token.str;
            }
        }
    }

    /**
     * @override
     */
    _fixing(tokenizer, replacements) {
        if (typeof replacements !== 'string') {
            this._raiseError(
                '_fixing tries to make Identity produce something else ' +
                'than a string'
            );
        }

        // We don't pretend we care about what is served by the tokenizer
        let s = "";

        while (true) {
            const t = tokenizer.nextToken();
            if (t === null) {
                this._raiseError('Not enough token');
            }

            if (t.type === 'whitespace') {
                s += t.str;
            } else {
                s += replacements;
                break;
            }
        }

        return s;
    }
}

class Pack extends AbstractScanner {
    constructor(quantity) {
        super();
        this._quantity = quantity;
    }

    _process(tokenizer) {
        let result = [];

        while (result.length < this._quantity) {
            const r = tokenizer.nextToken();
            if (r === null) {
                this._raiseNotEnoughTokenError(
                    this._quantity, result.length
                );
            }
            if (r.type !== 'whitespace') {
                result.push(r.str);
            }
        }

        return result;
    }

    _fixing(tokenizer, replacements) {
        if (!Array.isArray(replacements)) {
            this._raiseError('Replacements is not an array');
        }

        if (replacements.find(x => typeof x !== 'string') !== undefined) {
            this._raiseError('Replacements is not composed of strings only');
        }

        if (replacements.length !== this._quantity) {
            this._raiseError('Replacements have an incorrect number of tokens');
        }

        const result = [];
        let numberOfNonWhiteSpace = 0;

        while (numberOfNonWhiteSpace < this._quantity) {
            const r = tokenizer.nextToken();
            if (r === null) {
                this._raiseError('Invalid origin on fixing');
            }

            if (r.type === 'whitespace') {
                result.push(r.str);
            } else {
                result.push(replacements[numberOfNonWhiteSpace]);
                ++numberOfNonWhiteSpace;
            }
        }

        return result.join("");
    }
}

class Sequential extends AbstractScanner {
    /**
     * 
     * @param {(AbstractScanner|AbstractScanner[])[]} subScanners Sub scanners
     * to use
     */
    constructor(subScanners) {
        super();

        /** @type AbstractScanner[] */
        this.subScanners = subScanners.flatMap(scanner => {
            if (Array.isArray(scanner)) {
                return scanner;
            } else {
                return [scanner];
            }
        }).map(x => {
            if (typeof(x) === 'string') {
                return new PreciseToken(x);
            } else {
                return x;
            }
        });
    }

    _process(tokenizer) {
        return this.subScanners.map(scanner => scanner._process(tokenizer));
    }

    _fixing(tokenizer, replacements) {
        if (!Array.isArray(replacements)) {
            this._raiseError('Replacements is not an array');
        }

        if (replacements.length !== this.subScanners.length) {
            this._raiseError('Replacements have an incorrect number of tokens');
        }

        let r = [];

        for (let i = 0; i != this.subScanners.length; ++i) {
            r.push(this.subScanners[i]._fixing(tokenizer, replacements[i]));
        }

        return r.join("");
    }
}


class List extends AbstractScanner {
    constructor(subScanner, beginSymbol = null, endSymbol = null, templateForFixing = null) {
        super();
        this.subScanner = subScanner;
        this.beginSymbol = beginSymbol;
        this.endSymbol = endSymbol;
        this.templateForFixing = templateForFixing;
    }

    _process(tokenizer) {
        if (this.beginSymbol !== null) {
            if (tokenizer.nextNonWhitespace() !== this.beginSymbol) {
                this._raiseError("List doesn't start with " + this.beginSymbol);
            }
        }

        const r = [];
        while (true) {
            const peek = tokenizer.peek();
            if (peek === null || peek.str === this.endSymbol) {
                break;
            }

            if (peek.type !== 'whitespace') {
                r.push(this.subScanner._process(tokenizer));
            } else {
                tokenizer.nextToken();
            }
        }

        if (this.endSymbol !== null) {
            const t = tokenizer.nextToken();
            if (t === null) {
                this._raiseError('EOF reached for a list that should end with ' + this.endSymbol);
            }
            // else : out because peek.str was === this.endSymbol
        }

        return r;
    }

    _fixing(tokenizer, replacements) {
        if (!Array.isArray(replacements)) {
            this._raiseError('Replacements of list is not an array');
        }

        let r = [];
        tokenizer.goToNonWhitespace(r);

        if (this.beginSymbol !== null) {
            const begin = tokenizer.nextToken(); // non whitespace
            if (begin === null || begin.str !== this.beginSymbol) {
                this._raiseError("List doesn't start with " + this.beginSymbol);
            }
            r.push(begin.str);
        }

        let forTheEnd = [];
        for (let i = 0; i != replacements.length; ++i) {
            let tmp = [];
            tokenizer.goToNonWhitespace(tmp);

            let innerTokenizer;

            let realPeak = tokenizer.peek();
            if (realPeak === null || realPeak.str === this.endSymbol) {
                tmp.forEach(x => forTheEnd.push(x));
                innerTokenizer = new Tokenizer(this.templateForFixing);
            } else {
                tmp.forEach(x => r.push(x));
                innerTokenizer = tokenizer;
            }

            r.push(this.subScanner._fixing(innerTokenizer, replacements[i]));
        }
        forTheEnd.forEach(x => r.push(x));

        // Go to the end of the list
        if (this.endSymbol === null) {
            // EOF
            while (tokenizer.nextToken() !== null) {
                // Waste every token
            }
        } else {
            // endSymbol terminated
            let lastwhitespace = "";
            while (true) {
                let p = tokenizer.peek();

                if (p === null) {
                    this._raiseError('Fixing badly terminated (no end symbol)');
                } else if (p.type === 'whitespace') {
                    lastwhitespace = tokenizer.nextToken().str;
                } else if (p.str === this.endSymbol) {
                    r.push(lastwhitespace);
                    r.push(tokenizer.nextToken().str);
                    break;
                } else {
                    this.subScanner._process(tokenizer);
                    lastwhitespace = "";
                }
            }
        }

        return r.join("");
    }
}


class Either extends AbstractScanner {
    constructor(possibilities, defaultTokenizers) {
        super();
        this._possibilities = possibilities;
        this._defaultTokenizers = defaultTokenizers;
    }

    _process(tokenizer) {
        const word = tokenizer.nextNonWhitespace();
        if (word === null) {
            this._raiseError("Either reached end of file");
        }

        const handler = this._possibilities[word];
        if (handler === undefined) {
            this._raiseError("Either found unknown keyword " + word);
        }

        return {
            type: word,
            data: handler._process(tokenizer)
        };
    }

    _fixing(tokenizer, replacements) {
        if (replacements.type === undefined || replacements.data === undefined) {
            this._raiseError("Replacements is not a {type, data} dict");
        }

        let r = [];
        tokenizer.goToNonWhitespace(r);

        const word = tokenizer.nextNonWhitespace();
        if (word === null) {
            this._raiseError("Either reached end of file");
        }

        r.push(replacements.type);

        const handler = this._possibilities[word];
        if (handler === undefined) {
            this._raiseError("Either found unknown keyword " + word);
        }

        let fixed;
        if (word === replacements.type) {
            fixed = handler._fixing(tokenizer, replacements.data);
        } else {
            fixed = this._possibilities[replacements.type]._fixing(
                new Tokenizer(this._defaultTokenizers[replacements.type]),
                replacements.data
            );

            handler._process(tokenizer);
        }

        r.push(fixed);

        return r.join("");
    }
}


// TODO: leftoversScanner



module.exports = {
    Tokenizer,
    /**
     * Produces a Scanner that reads one token.
     * 
     * This is usually useless (you are better of just using .trim() on your
     * string), and is only usefull when you are composing other Scanners.
     * @returns {Identity} An Identity Scanner
     */
    identity: () => new Identity(),

    pack: (qtt) => new Pack(qtt),

    sequential: (...subScanners) => new Sequential(subScanners),


    list: (subScanner, beginSymbol, endSymbol, templateForFixing) => new List(subScanner, beginSymbol, endSymbol, templateForFixing),

    either: (handlers, defaultTokenizers) => new Either(handlers, defaultTokenizers),
}

