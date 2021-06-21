const { readFileSync } = require('./file-reader');

class Tokenizer {
    /**
     * 
     * @param {string} content 
     */
    constructor(content) {
        this.content = content;
        this.cursor = 0;
    }


    nextToken() {
        if (this.cursor === this.content.length) {
            return null;
        }

        const begin = this.cursor;

        const firstCharacter = this.content[begin];

        if (this.isWhitespace(firstCharacter)) {
            let current = begin + 1;

            while (current < this.content.length
                && this.isWhitespace(this.content[current])) {
                ++current;
            }

            this.cursor = current;
            return {
                type: 'whitespace',
                str: this.content.substr(begin, current - begin)
            };
        } else {
            let inQuote = firstCharacter === '"';
            let current = begin + 1;

            const isOk = char => inQuote || !this.isWhitespace(char);

            while (current < this.content.length
                && isOk(this.content[current])) {

                if (this.content[current] === '"') {
                    inQuote = !inQuote;
                }

                ++current;
            }

            this.cursor = current;

            return {
                type: 'string',
                str: this.content.substr(begin, current - begin)
            }
        }
    }


    isWhitespace(character) {
        return character == ' ' || character == '\t'
            || character == '\r' || character == '\n';
    }
}



class IScanner {


    parse(content) {
        const tokenizer = new Tokenizer(content);

        let result = this.process(tokenizer);

        while (true) {
            let n = tokenizer.nextToken();
            if (n === null) break;
            if (n.type !== 'whitespace') {
                this.raiseError('Not everything was consumed');
            }
        }

        return result;
    }

    fix(original, replacements) {
        return "0";
    }

    raiseError(message) {
        throw new Error(message);
    }
}


class Identity extends IScanner {

    process(tokenizer) {
        while (true) {
            let token = tokenizer.nextToken();
            if (token === null) {
                this.raiseError("No token found but expectedOne");
            }

            if (token.type !== 'whitespace') {
                return token.str;
            }
        }
    }

}






module.exports = {
    identity: () => new Identity()

}

