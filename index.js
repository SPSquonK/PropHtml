const { Command } = require('commander');
const express = require('express');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const FR = require('./src/file-reader');
const MiscResources = require('./src/misc-resources');
const PropItemTxt = require('./src/itemProp');
const ImageServer = require('./src/ImageServer');
const PropItemEtc = require('./src/PropItemEtc');

const configurationReader = require('./src/configuration');

function inDictReduce(acc, [id, value]) {
    acc[id] = value;
    return acc;
}

function loadResources(configuration) {
    const content = {};
    content.itemNames = FR.readStrings(path.join(configuration['resource-folder'], "propItem.txt.txt"));

    if (configuration['source-folder']) {
        const r = MiscResources.readDSTMapping(path.join(configuration['source-folder'], "_Interface", "WndManager.cpp"));

        for (const warning of r.warnings) {
            console.error("Warning: " + warning);
        }

        content.dstMapping = r.dst;
    } else if (configuration['dst-prop-json']) {
        content.dstMapping = JSON.parse(fs.readFileSync(configuration['dst-prop-json'], "utf8")).dst;
    } else {
        console.error("No path to source or path to dstProp");
    }
    
    content.textClient = MiscResources.textClient(
        path.join(configuration['resource-folder'], "textClient.inc"),
        path.join(configuration['resource-folder'], "textClient.txt.txt")
    );

    content.setItems = PropItemEtc.readSetItems(
        path.join(configuration['resource-folder'], "propItemEtc.inc")
    );
    content['propItemEtc.txt.txt'] = FR.readStrings(
        path.join(configuration['resource-folder'], "propItemEtc.txt.txt")
    );
    
    /** @type PropItemTxt */
    content.propItems = PropItemTxt.loadFile(
        path.join(configuration['resource-folder'], configuration.propItemDotTxt),
        content
    );

    return content;
}

function buildCategories(yamlCategories) {
    const result = [];

    for (const [name, filters] of Object.entries(yamlCategories)) {
        let annotationItemSet = filters.indexOf('@ItemSet');

        if (annotationItemSet !== -1) {
            result.push({ type: 'Item Set', name });
        } else {
            const filter = item => filters.indexOf(item.ik3) !== -1;
            result.push({ type: 'Single Item', name, filter });
        }
    }

    return result;
}

/* ==== WEB SERVER ==== */

/**
 * Starts the ExpressPropHtml web server
 * @param {number | string} port The port used by the server
 * @param {*} thing Things
 * @param {boolean} silent If true, the server will not display in console the
 * "Server has been started at ..." message
 * @returns The express instance of the server
 */
function startWebServer(port, { configuration, resources, isEditMode, items, categories }, silent = false) {
    // Build the express instance
    const app = express();
    app.use(express.json());

    // Static resources
    app.use('/', express.static('static'));

    // Image folder
    const imageServer = new ImageServer(path.join(configuration['resource-folder'], 'Item'));

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
    
    // REST API
    const cache = {};

    app.get('/rest/services', (_, res) => {
        return res.json({
            isEditable: isEditMode,
            categories: categories.map(dict => dict.name)
        });
    });

    app.get('/rest/dst-names', (_, res) => {
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

    app.get('/rest/category/:id', (req, res) => {
        const category = parseInt(req.params['id']);
        if (isNaN(category) || category >= categories.length) {
            return res.status(404).json({ error: 'Bad request' });
        }

        const categoryDict = categories[category];

        if (categoryDict.type === 'Single Item') {
            const yourItems = items.filter(i => categoryDict.filter(i))
                .map(item => item.toClient());

            return res.json({ type: 'Single Item', items: yourItems });
        } else if (categoryDict.type === 'Item Set') {
            const itemSets = resources.setItems.map(setItem => 
                setItem.toClient(
                    resources['propItemEtc.txt.txt'],
                    resources.propItems
                )
            );

            return res.json({ type: 'Item Set', itemSets })
        } else {
            return res.status(500).json({ error: 'Malformed category' })
        }
    });

    if (isEditMode) {
        function numberOfAwakes(items) {
            for (const item of items) {
                return item.bonus.length;
            }
            
            return undefined;
        }

        app.post('/rest/individual-items/awakes', (req, res) => {
            // Note: we don't check if the modified items are actually
            // displayable because edit mode should be run only if the
            // administrator trusts the user (most likely themself)

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
                    configuration['resource-folder'],
                    configuration['keep-original-prop-item'] || undefined,
                    configuration['new-prop-item-path'] || undefined,
                    configuration['propItemDotTxt']
                );
            }

            return res.json({
                result: 'ok',
                modified: chg.map(i => i.toClient()),
                notProcessed: notProcessed,
            });
        });
    }

    // Start the server
    app.listen(port, () => {
        if (!silent) console.log(`Server started on http://localhost:${port}/`)
    });

    return app;
}


/* ==== ==== */

function main() {
    const configuration = configurationReader();

    const port = 3000;
    
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
    
    const yamlConf = YAML.parse(fs.readFileSync(path.join('configuration', 'item-categories.yaml'), 'utf8'));

    const resources = loadResources(configuration);
    const items = [...resources.propItems];
    const categories = buildCategories(yamlConf['requestable-ik3']);

    startWebServer(port, { configuration, resources, isEditMode, items, categories });
}

main();
