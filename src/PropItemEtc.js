const FR = require('./file-reader');
const fs = require('fs');

const { listEither, dict, sequential, identity, list, pack } = require('./declarative-scanner');

const PropItemEtcStructure = listEither(null, {
    "Piercing": sequential([ identity(), list('{', pack(2), '}') ]),
    "SetItem": sequential([
        identity(),
        identity(),
        dict('{', {
            "Elem" : list('{', pack(2), '}'),
            "Avail": list('{', sequential([pack(2), identity()]), '}')
        }, '}')
    ]),
    "RandomOptItem": sequential([
        identity(), identity(), identity(), identity(),
        list('{', pack(2), '}')
    ])}, null);


class SetItem {
    static availToDict(avail) {
        // Build a nbParts -> bonuses mapping
        let nbToBonuses = {};
        for (const [nbParts, d] of Object.entries(avail)) {
            for (const [dst, valueStr] of Object.entries(d)) {
                if (nbToBonuses[nbParts] === undefined) {
                    nbToBonuses[nbParts] = [];
                }
    
                nbToBonuses[nbParts].push([dst, parseInt(valueStr)]);
            }
        }

        // Reorder keys
        let result = {};
        for (const nbPart of Object.keys(nbToBonuses)) {
            result[nbPart] = nbToBonuses[nbPart];
        }
        return result;
    }

    constructor(id, propItemEtcContent, ent) {
        this.id = id;
        this.content = propItemEtcContent;
        this.ent = ent;
    }

    toClient(propItemTxtStrings, items) {
        let me = this.content;
        while (me.sameAs !== undefined) {
            me = this.ent[me.sameAs];
        }
        let r = {
            id: this.id,
            tid: propItemTxtStrings[this.content.name],
            items: this.content.items.map(i => items.getItem(i)?.toClient() || i),
            bonus: SetItem.availToDict(me.bonus)
        };
        return r;
    }
}

function readSetItems(path) {
    const content = fs.readFileSync(path, 'utf-8');
    const jsonContent = JSON.parse(content);
    let i = 0;
    let r = Object.entries(jsonContent['Sets'])
        .filter(entry => entry[1].items !== undefined)
        .map(entry => new SetItem(++i, entry[1], jsonContent['Sets']));
    return r;
}

module.exports = {
    readSetItems
};

/*


*/