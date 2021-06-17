const conf = require('dotenv').config()
const { Command } = require('commander');
const express = require('express');
const fs = require('fs');
const path = require('path');
const port = 3000;
const { PNG } = require('pngjs');
const ImageServer = require('./src/ImageServer');

const FR = require('./src/file_reader');
const PropItemTxt = require('./src/itemProp');


const program = new Command()
    .description('Can the server modify the resources')
    .option('-e, --editable', 'The server can modify the resources')
    .option('-r, --readonly', 'The server is in read-only mode');

program.parse(process.argv);

const options = program.opts();

if (options.editable && options.readonly) {
    console.error('editable and readonly are mutually exclusive');
    return;
}

const isEditMode = !options.readonly;


function inDictReduce(acc, [id, value]) {
    acc[id] = value;
    return acc;
}

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
    
    /** @type PropItemTxt */
    content.propItems = PropItemTxt.loadFile(path.join(conf.parsed.flyff, "propItem.txt"), content);

    return content;
}

const resources = loadResources();

const items = [...resources.propItems];


/* ==== WEB SERVER ==== */

const app = express();

app.use(express.json());

app.listen(port, () => console.log(`Server started on http://localhost:${port}/`));

app.use('/', express.static('static'));


// Images


/** @type ImageServer */
const imageServer = new ImageServer(path.join(conf.parsed.flyff, 'Item'));

app.get('/dds/:path', (req, res) => {
    const filename = path.normalize(req.params['path']);

    if (filename.startsWith('..') || path.isAbsolute(filename)) {
        return res.status(404).send('File not found');
    }

    const result = imageServer.getImage(filename);

    if (result.ok !== undefined) {
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': result.ok.length
        });

        return res.end(result.ok);
    } else if (result.error !== undefined) {
        return res.status(404).send(result.error);
    } else {
        return res.status(500).send('Server logic error');
    }
});

// Rest API

{
    const cache = {};

    const SENDABLE_IK3 = [ 'IK3_SWD', 'IK3_BOW' ];

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

    app.get('/rest/editable', (_, res) => {
        return res.json({ isEditable: isEditMode });
    });

    if (true || isEditMode) {
        function numberOfAwakes(items) {
            for (const item of items) {
                return item.bonus.length;
            }
            
            return undefined;
        }

        app.post('/rest/item-awakes', (req, res) => {
            // Check DST validity
            const awakeMaxNb = numberOfAwakes(items);

            let badElements = [];

            for (const [itemId, newBonuses] of Object.entries(req.body)) {
                let item = items.find(i => i.id === itemId);

                if (item === undefined) {
                    badElements.push({ 'item': itemId, 'type': 'Invalid ItemId' });
                }

                if (newBonuses.length > awakeMaxNb) {
                    badElements.push({
                        'item': itemId,
                        'type': 'Requested too much lines',
                        'requestedQuantity': newBonuses.length,
                        'maxQuantity': awakeMaxNb
                    });
                }

                for (const line of newBonuses) {
                    const addBadElement = extra => badElements.push({
                        'item': itemId, 'type': 'Bad line',
                        'line': line  , 'extra': extra
                    });

                    if (line === undefined || line === null || line.length > 2) {
                        addBadElement('Format should be [dst, value]');
                        continue;
                    }

                    const [dst, value] = line;

                    if (resources.dstMapping[dst] === undefined) {
                        addBadElement('The given DST is not valid');
                    }

                    if (isNaN(value) || parseInt(value) === 0) {
                        addBadElement('The value is not a valid quantity (should be ≠ 0)');
                    }
                }
            }

            if (badElements.length !== 0) {
                return res.json({
                    error: {
                        message: 'Invalid request - Requested bonuses are ill-formed',
                        badElements
                    }
                });
            }

            // 
            let chg = resources.propItems.applyBonusChange(req.body);

            let notProcessed = Object.entries(req.body)
                .filter(([id, _]) => chg.find(i => i.id === id) === undefined)
                .reduce(inDictReduce, {});

            if (Object.keys(notProcessed).length === 0) notProcessed = undefined;

            if (chg.length !== 0) {
                resources.propItems.persist(
                    conf.parsed.flyff,
                    conf.parsed.KEEP_ORIGINAL_PROP_ITEM,
                    conf.parsed.NEW_PROP_ITEM_PATH
                );
            }

            return res.json({
                result: 'ok',
                modified: chg.map(i => i.toClient()),
                notProcessed: notProcessed,
            });
        })
    }
}