'use strict';

const conf = require('dotenv').config();
const path = require('path');
const { Command } = require('commander');
const fs = require('fs');
const FR = require('./src/file_reader');
const ItemPropTxt = require('./src/itemProp');
const beautify = require("json-beautify");

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// dstProp tool

function dstProp(propJsonPath, wndManagerPath) {
    if (wndManagerPath === undefined) {
        console.error('The path to WndManager must be specified');
        return;
    }

    const dstMapping = FR.readDSTMapping(wndManagerPath);

    for (const warning of dstMapping.warnings) {
        console.error(`Warning: ${warning}`);
    }

    const jsonFileContent = { "dst": dstMapping.dst };
    const toWrite = JSON.stringify(jsonFileContent, null, 2);
    
    if (propJsonPath == null) {
        console.log(toWrite);
    } else {
        fs.writeFileSync(propJsonPath, toWrite);
    }
}


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// restore tool

function restore(destination, source, diff, apply) {
    if (source === undefined || !fs.existsSync(source)) {
        console.error('source must be a valid path and must exist.');
        return;
    }

    if (!diff && !apply) {
        console.error('Either the diff or the apply option must be used');
        return;
    }

    if (diff) {
        if (!fs.existsSync(destination)) {
            console.error('To build the diff, the destination must exist');
        } else {
            const dstTxt = ItemPropTxt.loadFile(destination);
            const srcTxt = ItemPropTxt.loadFile(source);

            const builtDiff = beautify(dstTxt.diff(srcTxt), null, 2, 120);

            if (builtDiff === undefined) {
                console.log("The two files have different items");
            } else {
                console.log(builtDiff);
            }
        }
    }

    if (apply) {
        fs.copyFileSync(source, destination);
    }
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Command Line Interface

function extractFromEnv(key, file, default_) {
    if (conf.parsed[key] === undefined) return default_;
    if (file === undefined) return default_;
    return path.join(conf.parsed[key], file);
}

if (require.main === module) {
    const program = new Command()
        .enablePositionalOptions();

    program.command('dstProp')
        .description('Build the dstProp.json file')
        .option('-s, --source <path/to/WndManager.cpp>', 'The path to WndManager.cpp',
            extractFromEnv('flyff_src', path.join('_Interface', 'WndManager.cpp'))
        )
        .option('-o, --output <path/to/dstProp.json>', 'The path to the produced file', null)
        .action(options => dstProp(options.output, options.source));

    program.command('restore')
        .description('Restoration tool for propItem.txt')
        .option('-s, --source <path/to/originalPropItem>', 'The path to the original propItem', 
            extractFromEnv('flyff', conf.parsed['KEEP_ORIGINAL_PROP_ITEM'])
        )
        .option('-d, --destination <path/to/usedPropItem>', 'The path to the propItem to replace', 
            extractFromEnv('flyff', 'propItem.txt')
        )
        .option('--diff', 'Display the bonus difference between the two files')
        .option('--apply', 'Replace the destination with the source')
        .action(options => restore(
            options.destination, options.source,
            options.diff, options.apply
        ));

    program.parse(process.argv);
}
