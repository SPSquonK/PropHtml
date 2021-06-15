const conf = require('dotenv').config()
const express = require('express');
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const port = 3000;
const { PNG } = require('pngjs');

const FR = require('./src/file_reader');
const PropItemTxt = require('./src/itemProp');

const sdds = require('sdds');

const isEditMode = true;

function loadResources() {
    function p(file) {
        return path.join(conf.parsed.flyff, file);
    }
    
    const content = {};
    
    content.itemNames = FR.readStrings(p("propItem.txt.txt"))

    if (conf.parsed.flyff_src) {
        const r = FR.readDSTMapping(path.join(conf.parsed.flyff_src, "_Interface", "WndManager.cpp"));

        for (const warning of r.warnings) {
            console.error("Warning: " + warning);
        }

        content.dstMapping = r.dst;
    } else if (conf.parsed.dstPropPath) {
        content.dstMapping = JSON.parse(fs.readFileSync(conf.parsed.dstPropPath, "utf8")).dst;
    } else {
        console.error("No path to source or path to dstProp");
    }
    
    
    content.textClient = FR.textClient(
        path.join(conf.parsed.flyff, "textClient.inc"),
        path.join(conf.parsed.flyff, "textClient.txt.txt")
    );

    content.propItems = PropItemTxt.loadFile(path.join(conf.parsed.flyff, "propItem.txt"), content);

    return content;
}

const resources = loadResources();

const items = [...resources.propItems];

function extractWeapons(ik3) {
    return {
        weaponname: ik3,
        weapons: items.filter(item => item.ik3 === ik3),
        bonusToString: function([dst, value]) {
            let result;

            const ids = resources.dstMapping[dst];
            if (ids === undefined) {
                result = dst;
            } else {
                result = resources.textClient[ids.tid];
                if (result === undefined) {
                    result = ids.tid;
                }
            }

            result += " ";
            if (value >= 0) result += "+";
            if (dst == "DST_ATTACKSPEED") {
                result += (value / 20);
            } else {
                result += value;
            }

            if (resources.dstMapping[dst].isRate) {
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
    const swd = extractWeapons("IK3_SWD");

    if (isEditMode) {
        swd.edit = true;
        swd.dsts = Object.entries(resources.dstMapping).map(([id, dict]) => {
            return {
                dst: id,
                name: resources.textClient[dict.tid] === undefined ? dict.tid : resources.textClient[dict.tid]
            }
        });
    }

    content += weapon(swd);

    const mainPage = pug.compileFile('pug/index.pug');
    const trueContent = mainPage({ content: content });
    return res.send(trueContent);
});


/**
 * @param {string} pngImage 
 */
function loadConvertedImage(pngImage) {
    const dds = fs.readFileSync(path.join(conf.parsed.flyff, "Item", pngImage + ".dds"));
    return sdds(dds);
}

app.get('/dds/:path', (req, res) => {
    const filename = req.params['path'];

    if (!filename.endsWith('.png') && !filename.toLowerCase().endsWith('.dds')) {
        return res.status(404).send("dds only contains png files");
    }

    const key = filename.substr(0, filename.length - '.png'.length);

    const pngImage = loadConvertedImage(key);

    if (pngImage == null) {
        return res.status(404).send('no match');
    } else {
        let buffer = PNG.sync.write(pngImage);

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': buffer.length
          });
        
        res.end(buffer);
    }
});
