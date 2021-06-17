const assert = require('assert');
const ItemPropTxt = require('../src/itemProp');
const path = require('path');
const iconvlite = require('iconv-lite');
const fs = require('fs');

function toCP1252(text) {
    return iconvlite.encode(text, "cp1252")
}

describe("ItemPropTxt", function() {
    const pathTo2Swords = path.join(__dirname, "resource", "V15-propItemSwords.txt");

    describe("[Symbol.iterator]", function() {
        it('should be able to iterate on every swords', function() {
            const instance = ItemPropTxt.loadFile(pathTo2Swords);
            assert.strictEqual([...instance].length, 2);
        });
    });

    describe("toPropItemTxtString()", function() {
        it('should reproduce the read file', function() {
            const instance = ItemPropTxt.loadFile(pathTo2Swords);
            const file = fs.readFileSync(pathTo2Swords);
            assert.ok(file.equals(toCP1252(instance.toPropItemTxtString())));
        });
    });
});
