const conf = require('dotenv').config()
const express = require('express');
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const port = 3000;

const FR = require('./src/file_reader');
const itemPropFactory = require('./src/itemProp');

function loadResources() {
    function p(file) {
        return path.join(conf.parsed.flyff, file);
    }
    
    const content = {};
    
    content.itemNames = FR.readStrings(p("propItem.txt.txt"))
    content.items = FR.readItems(p("propItem.txt"));
    content.dstMapping = FR.readDSTMapping(path.join(conf.parsed.flyff_src, "_Interface", "WndManager.cpp"));
    
    content.textClient = FR.textClient(
        path.join(conf.parsed.flyff, "textClient.inc"),
        path.join(conf.parsed.flyff, "textClient.txt.txt")
    );

    return content;
}

const resources = loadResources();

const KnownIndexes = {
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

const items = itemPropFactory(resources, KnownIndexes);

function extractWeapons(ik3) {
    return {
        weaponname: ik3,
        weapons: items.filter(item => item.ik3 === ik3),
        bonusToString: function([dst, value]) {
            let result;

            const ids = resources.dstMapping.dstStrings[dst];
            if (ids === undefined) {
                result = dst;
            } else {
                result = resources.textClient[ids];
                if (result === undefined) {
                    result = ids;
                }
            }

            result += " ";
            if (value >= 0) result += "+";
            if (dst == "DST_ATTACKSPEED") {
                result += (value / 20);
            } else {
                result += value;
            }

            if (resources.dstMapping.dstRates.has(dst)) {
                result += "%";
            }

            return result;
        }
    };
}


/* ==== WEB SERVER ==== */

const app = express();

app.listen(port, () => console.log(`Server started on http://localhost:${port}/`));

app.use('/', express.static('static'));

app.get('/', (_, res) => {
    const weapon = pug.compileFile('pug/weapon.pug');

    let content = "";
    content += weapon(extractWeapons("IK3_SWD"));

    const mainPage = pug.compileFile('pug/index.pug');
    const trueContent = mainPage({ content: content });
    return res.send(trueContent);
});
