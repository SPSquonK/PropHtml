const conf = require('dotenv').config()
const express = require('express');
const path = require('path');
const pug = require('pug');
const port = 3000;

const FR = require('./src/file_reader');

function loadResources() {
    function p(file) {
        return path.join(conf.parsed.flyff, file);
    }
    
    const content = {};
    
    content.itemNames = FR.readStrings(p("propItem.txt.txt"))
    content.items = FR.readItems(p("propItem.txt"));

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
    'ICON': 121,
    'DESCRIPTION': 123
};

function extractWeapons(ik3) {
    const result = {
        weaponname: ik3,
        weapons: []
    };

    //// To be able to better see the fields repartition
    //for (const item of resources.items) {
    //    if (item.indexOf(ik3) !== -1) {
    //
    //        for (const [index, value] of Object.entries(item)) {
    //            console.log(`${index}: ${value}`);
    //        }
    //
    //        break;
    //    }
    //}

    resources.items.forEach(item => {
        if (item[KnownIndexes.IK3] != ik3) return;

        result.weapons.push({
            icon: "???",
            identifier: item[KnownIndexes.ID],
            name: item[KnownIndexes.TID],
            job_name: item[KnownIndexes.JOB],
            level: "???",
            bonus_serialization: "???"
        });
    });

    return result;
}

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
