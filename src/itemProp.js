const fs = require('fs');
const FR = require('./file-reader');
const path = require('path');
const YAML = require('yaml');

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

function detectFields(line) {
    const numberOfTokens = FR.tokenize(line).length;

    const p = path.join(__dirname, '..', 'configuration', 'item-layouts.yaml');
    if (!fs.existsSync(p)) {
        throw Error('configuration/item-layouts.yaml should exist');
    }

    const layouts = YAML.parse(fs.readFileSync(p, 'utf8'));

    for (const candidateName of layouts['@candidates']) {
        const candidate = layouts[candidateName];
        
        if (numberOfTokens === candidate['@ExpectedNumberOfFields']) {
            return candidate;
        }
    }

    throw Error('ItemProp field detection failed');
}

function parseBonuses(item, fields) {
    return fields.bonusLines.map(
        ([dst, value]) => {
            if (item[dst] === "=" || item[value] === "=") {
                return undefined;
            }

            return [item[dst], parseInt(item[value])];
        });
}

function modifyBonuses(item, fields, newBonuses) {
    if (newBonuses.length > fields.bonusLines.length) {
        return false;
    }

    for (let i = 0; i != fields.bonusLines.length; ++i) {
        const [addrDst, addrValue] = fields.bonusLines[i];

        if (i >= newBonuses.length) {
            item[addrDst]   = "=";
            item[addrValue] = "=";
        } else {
            item[addrDst]   = newBonuses[i][0];
            item[addrValue] = newBonuses[i][1].toString();
        }
    }

    return true;
}

// TODO : Enforce 'loaded files should not have duplicates'

class ItemPropTxt {
    static loadFile(path, context, fields) {
        const file = FR.readFileSyncWithEncoding(path, true);
        return new ItemPropTxt(
            file.content.split(/\r?\n/), file.encoding, context, fields
        );
    }

    constructor(lines, encoding, context, fields) {
        this.lines = [];
        this.items = [];
        this.encoding = encoding;

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

                if (fields === undefined) {
                    fields = detectFields(line);
                }

                if (context === undefined) {
                    item = new ItemProp(line, fields);
                } else {
                    // TODO: pass whole context or modify itemNames to do more fun things
                    item = new ItemPropInContext(line, fields, context.itemNames);
                }

                this.lines.push(item);
                this.items.push(item);
            }
        }

        this.context = context;
    }

    getItem(itemId) {
        return this.items.find(item => item.id === itemId);
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
        FR.writeFileSync(path, this.toPropItemTxtString(), this.encoding);
    }

    *[Symbol.iterator]() {
        for (const item of this.items) {
            yield item;
        }
    }

    applyBonusChange(changes) {
        let changedItems = [];

        for (const item of this.items) {
            if (changes[item.id] !== undefined) {
                let r = item.applyBonusChange(changes[item.id]);
                if (r) changedItems.push(item);
            }
        }

        return changedItems;
    }

    persist(resourcePath, keepOriginalPropItemPath, newItemPropPath, propItemDotTxt) {
        // TODO: manage absolute paths

        // Keep Original Prop Item Path
        if (keepOriginalPropItemPath !== undefined) {
            const dstPath = path.join(resourcePath, keepOriginalPropItemPath);

            if (!fs.existsSync(path)) {
                fs.copyFileSync(
                    path.join(resourcePath, propItemDotTxt),
                    dstPath
                );
            }
        }

        // 
        if (newItemPropPath === undefined) {
            newItemPropPath = propItemDotTxt;
        }

        const target = path.join(resourcePath, newItemPropPath);
        this.saveFile(target);
    }


    /**
     * 
     * @param {ItemPropTxt} originalFile 
     */
    diff(originalFile) {
        const mine = this.itemsAsDict();
        const your = originalFile.itemsAsDict();

        const result = {};

        if (mine.size !== your.size) return undefined;

        const cmpBonuses = (a, b) => {
            for (let i = 0 ; i != a.length ; ++i) {
                let ax = a[i];
                let bx = b[i];

                if (ax === undefined || bx === undefined) {
                    if (ax !== undefined || bx !== undefined) {
                        return false;
                    }
                } else if (ax[0] !== bx[0] || (
                    ax[1] !== bx[1] && !(isNaN(ax[1]) && isNaN(bx[1]))
                )) {
                    return false;
                }
            }

            return true;
        };

        for (const [id, newItem] of Object.entries(mine)) {
            const originalItem = your[id];

            if (originalItem === undefined) {
                return undefined;
            }

            if (!cmpBonuses(originalItem.bonus, newItem.bonus)) {
                result[id] = { o: originalItem.bonus, p: newItem.bonus };
            }
        }

        return result;
    }

    /** Return the items contained in this instance as a dictionnary */
    itemsAsDict() {
        return this.items.reduce(
            (acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {}
        );
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

        if (fields['@ExpectedNumberOfFields'] !== undefined
            && this.content.length !== fields['@ExpectedNumberOfFields']) {
            throw Error(
                "Item doesn't have " + fields['@ExpectedNumberOfFields']
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
    get bonus() { return parseBonuses(this.content, this.fields); }

    get level() {
        const rawLevel = this.content[this.fields.LEVEL];
        if (rawLevel === "=") return 0;
        return parseInt(rawLevel);
    }

    /** To be able to better see the fields repartition */
    saveInNotes(refItem) {
        if (refItem === null) {
            return Object.entries(this.content)
                .map(([index, value]) => `${value}`)
                .join("\n");
        } else {

        }
    }

    applyBonusChange(newBonus) {
        return modifyBonuses(this.content, this.fields, newBonus);
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
