const fs = require('fs');
const iconvlite = require('iconv-lite');
const FR = require('./file_reader');

/**
 * 
 * @param {string} path The path read from the resource file
 */
 function _removeQuotes(path) {
    while (path.length > 0 && path[0] == '"' && path[path.length - 1] == '"') {
        path = path.substr(1, path.length - 2);
    }

    return path;
}

/**
 * Check if the given string contains one of the symbol
 * @param {string} str The string to verify
 * @param {string[]} symbols The list of symbols
 * @returns {boolean} True if the line contains one of the symbols
 */
function stringContainsOneOf(str, symbols) {
    return symbols.find(symbol => str.indexOf(symbol) !== -1) !== undefined;
}

/** Positions of the fields in a clean v15 propItem.txt */
const v15fields = {
    'ID': 1,
    'TID': 2,
    'IK1': 5,
    'IK2': 6,
    'IK3': 7,
    'JOB': 8,
    'HANDS': 16,
    'RANK': 91,
    'LEVEL': 116,
    'ICON': 120,
    'DESCRIPTION': 123,
    parseBonuses: item => {
        const pairs = [ [53, 56], [54, 57], [55, 58] ];

        return pairs.map(
            ([dst, value]) => {
                if (item[dst] === "=" || item[value] === "=") {
                    return undefined;
                }

                return [item[dst], parseInt(item[value])];
            });
    }
};

class ItemPropTxt {
    static loadFile(path, context) {
        const lines = iconvlite.decode(fs.readFileSync(path), 'cp1252')
            .split(/\r?\n/);
        
        return new ItemPropTxt(lines, context);
    }

    constructor(lines, context) {
        this.lines = [];
        this.items = [];

        let isInComment = false;
        for (const line of lines) {
            const testLine = line.trim();
            if (testLine.startsWith("//")) {
                this.lines.push(line);
            } else if (testLine.startsWith("/*")) {
                if (line.endsWith("*/") || line.indexOf("*/") === -1) {
                    this.lines.push(line);
                    isInComment = true;
                } else {
                    throw Error("Supported propItem.txt should not start with a /* and have a */ in the middle of it");
                }
            } else if (testLine === "*/") {
                this.lines.push(line);
                isInComment = false;
            } else if (stringContainsOneOf(line, ["//", "/*", "*/"])) {
                throw Error("propItem.txt should not contain any line that have a comment and doesn't lead with it");
            } else if (isInComment) {
                this.lines.push(line);
            } else if (testLine === '') {
                this.lines.push(line);
            } else {
                let item;
                if (context === undefined) {
                    item = new ItemProp(line, v15fields);
                } else {
                    // TODO: pass whole context or modify itemNames to do more fun things
                    item = new ItemPropInContext(line, v15fields, context.itemNames);
                }

                this.lines.push(item);
                this.items.push(item);
            }
        }

        this.context = context;
    }

    toPropItemTxtString() {
        return this.lines.map(line => {
            if (typeof(line) == 'string') {
                return line;
            } else {
                return line.toPropItemString();
            }
        }).join("\r\n");
    }

    /**
     * Write the content of this instance to the given propItem.txt path
     * @param {string} path Path to the file to write
     */
    saveFile(path) {
        const buffer = iconvlite.encode(this.toPropItemTxtString(), "cp1252");
        fs.writeFileSync(path, buffer);
    }

    *[Symbol.iterator]() {
        for (const item of this.items) {
            yield item;
        }
    }
}

class ItemProp {
    /**
     * 
     * @param {string} line The line from the propItem.txt file
     * @param {*} fields Position of the fields
     */
    constructor(line, fields) {
        this.content = FR.tokenize(line);
        this.fields = fields;

        if (this.content.length !== fields.DESCRIPTION + 1) {
            throw Error(
                "Item doesn't have " + (fields.DESCRIPTION + 1)
                + " tokens but " + this.content.length
            );
        }
    }

    toPropItemString() {
        return this.content.join("\t");
    }

    get id()    { return this.content[this.fields.ID]; }
    get tid()   { return this.content[this.fields.TID]; }
    get ik1()   { return this.content[this.fields.IK1]; }
    get ik2()   { return this.content[this.fields.IK2]; }
    get ik3()   { return this.content[this.fields.IK3]; }
    get job()   { return this.content[this.fields.JOB]; }
    get icon()  { return _removeQuotes(this.content[this.fields.ICON]); }
    get bonus() { return this.fields.parseBonuses(this.content); }

    get level() {
        const rawLevel = this.content[this.fields.LEVEL];
        if (rawLevel === "=") return 0;
        return parseInt(rawLevel);
    }

    /** To be able to better see the fields repartition */
    saveInNotes(path) {
        fs.writeFileSync(path,
            Object.entries(this.content).map(([index, value]) => `${index}: ${value}`).join("\n")
        );
    }
}

class ItemPropInContext extends ItemProp {
    constructor(line, fields, tidsToText) {
        super(line, fields);
        this.tidsToText = tidsToText;
    }

    mapText(text) {
        if (this.tidsToText[text] === undefined) return text;
        return this.tidsToText[text];
    }

    get name() { return this.mapText(this.tid); }

    get jobName() {
        if (this.job === "=") return "";
        if (!this.job.startsWith("JOB_")) return this.job;
        return this.job.substr(4)
            .replace("_", "-")
            .split("-")
            .map(str => str.length === 0 ? "" : str[0] + str.substr(1).toLowerCase())
            .join("-");
    }

    /**
     * Build a version of this instance that is sendable to the client
     */
    toClient() {
        return {
            icon   : this.icon,
            id     : this.id,
            name   : this.name,
            jobName: this.jobName,
            level  : this.level,
            bonus  : this.bonus
        };
    }
}

module.exports = ItemPropTxt;
