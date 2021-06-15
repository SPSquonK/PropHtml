'use strict';

const { Command } = require('commander');
const fs = require('fs');
const FR = require('./src/file_reader');

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// dstProp tool

function dstProp(propJsonPath, wndManagerPath) {
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
// Command Line Interface

if (require.main === module) {
    const program = new Command()
        .enablePositionalOptions();

    program.command('dstProp')
        .description('Build the dstProp.json file')
        .option('-s, --source <path/to/WndManager.cpp>', 'The path to WndManager.cpp')
        .option('-o, --output <path/to/dstProp.json>', 'The path to the produced file', null)
        .action(options => dstProp(options.output, options.source));

    program.parse(process.argv);
}
