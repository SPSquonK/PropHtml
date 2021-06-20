const FR = require('./file-reader');

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
        for (const [[dst, valueStr], nbParts] of avail) {
            if (nbToBonuses[nbParts] === undefined) {
                nbToBonuses[nbParts] = [];
            }

            nbToBonuses[nbParts].push([dst, parseInt(valueStr)]);
        }

        // Reorder keys
        let result = {};
        for (const nbPart of Object.keys(nbToBonuses)) {
            result[nbPart] = nbToBonuses[nbPart];
        }
        return result;
    }

    constructor(propItemEtcContent) {
        this.content = propItemEtcContent;
    }

    toClient(propItemTxtStrings, items) {
        return {
            id: this.content[0],
            tid: propItemTxtStrings[this.content[1]],
            items: this.content[2].Elem.map(i => items.getItem(i[0])?.toClient() || i[0]),
            bonus: SetItem.availToDict(this.content[2].Avail)
        };
    }
}

function _readPropItemEtc(path) {
    return PropItemEtcStructure(FR.Scanner.readFile(path));
}

function readSetItems(path) {
    return _readPropItemEtc(path)
        .filter(element => element[0] === 'SetItem')
        .map(element => new SetItem(element[1]));
}

function persistSetItemsModifications(path, modifications) {
    // TODO
}



module.exports = {
    readSetItems,
    persistSetItemsModifications
};

/*


*/