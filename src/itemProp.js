
/**
 * 
 * @param {string} path The path read from the resource file
 */
 function _removeQuotes(path) {
    while (path.length > 0 && path[0] == '"' && path[path.length - 1] == '"') {
        path = path.substr(1, path.length - 2);
    }

    return path;
}

class ItemPropFactory {
    constructor(context, indexes) {
        this.context = context;
        this.indexes = indexes;
    }

    /**
     * 
     * @param {string[]} itemAsArray 
     */
    makeItemProp(itemAsArray) {
        return {
            id: itemAsArray[this.indexes.ID],
            name: this.convertText(itemAsArray[this.indexes.TID], 'itemNames'),
            ik1: itemAsArray[this.indexes.IK1],
            ik2: itemAsArray[this.indexes.IK2],
            ik3: itemAsArray[this.indexes.IK3],
            job: this.toJobName(itemAsArray[this.indexes.JOB]),
            level: this.convertLevel(itemAsArray[this.indexes.LEVEL]),
            icon: _removeQuotes(itemAsArray[this.indexes.ICON]),
            bonus: this.parseDst(itemAsArray, this.indexes.parseBonuses)
        };
    }

    convertText(str, dictKey) {
        const val = this.context[dictKey][str];
        return val !== undefined ? val : str;
    }

    toJobName(jobID) {
        if (jobID === "=") return "";
        if (!jobID.startsWith("JOB_")) return jobID;
        return jobID.substr(4)
            .replace("_", "-")
            .split("-")
            .map(str => str.length === 0 ? "" : str[0] + str.substr(1).toLowerCase())
            .join("-");
    }

    convertLevel(str) {
        if (str == "=") return 0;
        return parseInt(str);
    }

    parseDst(itemAsArray, parseBonusFunction) {
        return parseBonusFunction(itemAsArray);
    }
}

function maker(context, indexes) {
    const factory = new ItemPropFactory(context, indexes);
    return context.items.map(item => factory.makeItemProp(item));
}

/** To be able to better see the fields repartition */
maker.updateNotes = function(items, predicate) {
    const item = items.find(predicate);

    if (item === undefined) {
        throw Error("itemProp::updateNotes(): No suitable item found");
    }
    
    fs.writeFileSync("notes.txt",
        Object.entries(item).map(([index, value]) => `${index}: ${value}`).join("\n")
    );
}

module.exports = maker;
