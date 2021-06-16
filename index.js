const conf = require('dotenv').config()
const express = require('express');
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const port = 3001;
const { PNG } = require('pngjs');

const FR = require('./src/file_reader');
const PropItemTxt = require('./src/itemProp');
const BonusToStr = require('./common/bonusToStr');

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
            BonusToStr.bonusToString(
                [dst, value], resources.dstMapping, resources.textClient
            );
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

app.use('/weapon.css', express.static(__dirname, { index: 'pug/weapon.css' }));

app.use('/common/:file', (req, res) => {
    const filename = path.join("common", req.params['file']);

    if (!filename.startsWith("common\\")) {
        return res.status(404).send('???');
    } else if (!fs.existsSync(filename)) {
        return res.status(404).send('Wow. Much inexistence. Very wow');
    }

    if (filename.endsWith('.js')) {
        const jsFile = fs.readFileSync(filename, 'utf-8')
            .split(/\r?\n/)
            .filter(line => !line.startsWith("module.exports"))
            .join("\n");
        
        res.writeHead(200, {
            'Content-Type': 'application/javascript'
        });
        
        return res.end(jsFile);
    } else {
        return res.status(404).send('There are no such kind of files here');
    }
});

// Images

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
        
        return res.end(buffer);
    }
});

// Rest API

{
    const cache = {};

    const SENDABLE_IK3 = [ 'IK3_SWD' ];

    app.get('/rest/dst_names', (_, res) => {
        if (cache.dst_names !== undefined) {
            return res.json({ result: cache.dst_names });
        }

        const result = {};

        for (const [dst, dict] of Object.entries(resources.dstMapping)) {
            const realText = resources.textClient[dict.tid];

            result[dst] = {
                tid: realText ? realText : dict.tid,
                isRate: dict.isRate
            }
        }
        
        cache.dst_names = result;
        return res.json({ result });
    });

    app.get('/rest/ik3/:ik3', (req, res) => {
        const ik3 = req.params['ik3'];

        if (SENDABLE_IK3.indexOf(ik3) === -1) {
            return res.status(404).json({
                error: "This Item Kind 3 has not been found"
            });
        }

        const yourItems = items.filter(item => item.ik3 == ik3)
            .map(item => item.toClient());

        return res.json({ items: yourItems });
    });
}