
const fs = require('fs');
const path = require('path');

const deasync = require('deasync');
const inquirer = require('inquirer');
const inquirerFuzzyPath = require('inquirer-fuzzy-path');
const YAML = require('yaml');
const yamlDiffPatch = require('yaml-diff-patch');

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const configurationFolder = path.join(__dirname, '..', 'configuration');

function ask() {
    let result = undefined;

    let prompt = inquirer.createPromptModule();

    prompt([{
        type: 'list',
        name: 'menu',
        message: 'What kind of configuration do you want?',
        choices: ['Fast configuration', 'Advanced configuration']
    }, {
        type: 'fuzzypath',
        name: 'flyffpath',
        message: 'Where is your FlyFF folder?',
        itemType: 'directory',
        excludeFilter: nodePath => nodePath == '.',
        when(answers) {
            return answers.menu === 'Fast configuration';
        }
    }, {
        type: 'fuzzypath',
        name: 'resource',
        message: 'Where are your resources?',
        itemType: 'directory',
        excludeFilter: nodePath => nodePath == '.',
        when(answers) {
            return answers.menu === 'Advanced configuration';
        }
    }, {
        type: 'list',
        name: 'dst-prov',
        message: 'Where do you want to get the bonus names from?',
        choices: [
            'Source files',
            'My own dstProp.json',
            //'Generate dstProp.json now from source'
        ],
        when(answers) {
            return answers.menu === 'Advanced configuration';
        }
    }, {
        type: 'fuzzypath',
        name: 'source',
        message: 'Where are your sources?',
        itemType: 'directory',
        excludeFilter: nodePath => nodePath == '.',
        when(answers) {
            return answers.menu === 'Advanced configuration'
                && answers['dst-prov'] === 'Source files';
        }
    }, {
        type: 'fuzzypath',
        name: 'dstPropPath',
        message: 'Where is your dstProp.json file?',
        itemType: 'file',
        excludeFilter: nodePath => nodePath == '.',
        when(answers) {
            return answers.menu === 'Advanced configuration'
                && answers['dst-prov'] === 'My own dstProp.json';
        }
    }]).then(answers => result = answers);

    deasync.loopWhile(x => result === undefined);

    return result;
}

function initialize(target) {
    const exist = p => {
        if (!fs.existsSync(p)) {
            throw Error(p + ' does not exist');
        }
        return p;
    }

    const p = path.join(configurationFolder, 'index.template.yaml');
    const templateFile = fs.readFileSync(p, 'utf8');

    const old = YAML.parse(templateFile);
    const newContent = YAML.parse(templateFile);
    
    let r = ask();

    if (r.menu === 'Fast configuration') {
        newContent['resource-folder'] = exist(path.join(r.flyffpath, 'Resource'));
        newContent['source-folder'] = exist(path.join(r.flyffpath, 'Source'));
        newContent['keep-original-prop-item'] = 'propItem.original.txt';
    } else if (r.menu === 'Advanced configuration') {
        newContent['resource-folder'] = exist(r.resource);
        newContent['source-folder'] = r.source ? r.source : false;
        newContent['dst-prop-json'] = r.dstPropPath ? r.dstPropPath : false;

        newContent['keep-original-prop-item'] = 'propItem.original.txt';
    } else {
        throw Error('Unknown menu');
    }

    const built = yamlDiffPatch.yamlDiffPatch(templateFile, old, newContent);
    fs.writeFileSync(target, built);
}

function getConfiguration() {
    const p = path.join(configurationFolder, 'index.yaml');

    if (!fs.existsSync(p)) {
        initialize(p);
    }

    return YAML.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = getConfiguration;
