const fs = require('fs');
const iconvlite = require('iconv-lite');

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
                const item = new ItemProp(line, this);
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
     * @param {ItemPropTxt} itemPropTxt The ItemPropTxt instance that generated
     * this ItemProp instance
     */
    constructor(line, itemPropTxt) {
        this.line = line;

    }

    toPropItemString() {
        return this.line;
    }
}


class ItemPropFactory {
    constructor(context, indexes) {
        this.context = context;
        this.indexes = indexes;
    }

    /**
     * 
     * @param {string[]} itemAsArray 
     */
    makeItemProp(itemAsArray) {
        return {
            id: itemAsArray[this.indexes.ID],
            name: this.convertText(itemAsArray[this.indexes.TID], 'itemNames'),
            ik1: itemAsArray[this.indexes.IK1],
            ik2: itemAsArray[this.indexes.IK2],
            ik3: itemAsArray[this.indexes.IK3],
            job: this.toJobName(itemAsArray[this.indexes.JOB]),
            level: this.convertLevel(itemAsArray[this.indexes.LEVEL]),
            icon: _removeQuotes(itemAsArray[this.indexes.ICON]),
            bonus: this.parseDst(itemAsArray, this.indexes.parseBonuses)
        };
    }

    convertText(str, dictKey) {
        const val = this.context[dictKey][str];
        return val !== undefined ? val : str;
    }

    toJobName(jobID) {
        if (jobID === "=") return "";
        if (!jobID.startsWith("JOB_")) return jobID;
        return jobID.substr(4)
            .replace("_", "-")
            .split("-")
            .map(str => str.length === 0 ? "" : str[0] + str.substr(1).toLowerCase())
            .join("-");
    }

    convertLevel(str) {
        if (str == "=") return 0;
        return parseInt(str);
    }

    parseDst(itemAsArray, parseBonusFunction) {
        return parseBonusFunction(itemAsArray);
    }
}

function maker(context, indexes) {
    const factory = new ItemPropFactory(context, indexes);
    return context.items.map(item => factory.makeItemProp(item));
}

/** To be able to better see the fields repartition */
maker.updateNotes = function(items, predicate) {
    const item = items.find(predicate);

    if (item === undefined) {
        throw Error("itemProp::updateNotes(): No suitable item found");
    }
    
    fs.writeFileSync("notes.txt",
        Object.entries(item).map(([index, value]) => `${index}: ${value}`).join("\n")
    );
}

module.exports = maker;


module.exports.ItemPropTxt = ItemPropTxt;
