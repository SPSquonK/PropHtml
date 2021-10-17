"use strict";

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Display logic

const stringify = {
    awake: function([dst, value], dstProp) {
        if (dst === 'DST_NONE') return "";

        const dstName = dstProp[dst]?.tid || dst;

        let valueStr = "";
        if (value >= 0) valueStr += "+";
        if (dst == "DST_ATTACKSPEED") {
            valueStr += (value / 20);
        } else {
            valueStr += value;
        }

        if (dstProp[dst] !== undefined && dstProp[dst].isRate) {
            valueStr += "%";
        }

        return `${dstName} ${valueStr}`;
    }
};

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Item modification

/**
 * Do a copy of arrayOfArrays with a depth of 2
 * @param {any[][]} arrayOfArrays 
 * @returns The copy of the array
 */
function copyArray2LevelsDeep(arrayOfArrays) {
    return arrayOfArrays.map(array => [...array]);
}

function transformNetworkedItem(item) {
    item.bonus = item.bonus.map(awake => awake == null ? ['DST_NONE', ""] : awake )
    item.originalBonus = copyArray2LevelsDeep(item.bonus);
    item.style = "color: inherit;";
    item.isModified = false;
    return item;
}

const ItemModification = {
    hasBeenModified: function(item) {
        for (let i = 0 ; i != item.bonus.length ; ++i) {
            if (item.bonus[i][0] == 'DST_NONE') {
                if (item.originalBonus[i][0] != 'DST_NONE') return true;
            } else if (item.originalBonus[i][0] == 'DST_NONE') {
                return true;
            } else {
                if (item.bonus[i][0] != item.originalBonus[i][0]) {
                    return true;
                }
                
                if (item.bonus[i][1] != item.originalBonus[i][1]) {
                    return true;
                }
            }
        }

        return false;
    }

};

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Item Set modification

function transformNetworkedItemset(itemset) {
    const data = {};
    data.id = itemset.id;

    data.sets = [{
        name: itemset.tid,
        items: itemset.items.map(item => {
            return { name: item.name, iconpath: 'dds/' + item.icon };
        })
    }];

    data.jobs = itemset.items.map(item => {
        return { job: item.jobName, level: item.level }
    }).reduce(
        (acc, value) => {
            acc.jobs.add(value.job);
            acc.level = Math.max(acc.level, value.level)
            return acc;
        }, { jobs: new Set(), level: 0 }
    );

    data.jobs.jobs = [...data.jobs.jobs];

    data.displayBonus = [];
    const maxParts = data.sets[0].items.length;
    let stackedBonuses = {};
    for (let i = 0; i <= maxParts; ++i) {
        const bonuses = itemset.bonus[i];

        if (bonuses === undefined) {
            if (data.displayBonus.length !== 0) {
                data.displayBonus[data.displayBonus.length - 1].max = i;
            }
            continue;
        }

        let myBonuses = Object.assign({}, stackedBonuses);
        for (const [k, v] of bonuses) {
            myBonuses[k] = (myBonuses[k] || 0) + v;
        }

        stackedBonuses = {};
        
        for (const [k, v] of Object.entries(myBonuses)) {
            if (v !== 0) {
                stackedBonuses[k] = myBonuses[k];
            }
        }
        
        data.displayBonus.push({
            min: i,
            max: i,
            bonus: Object.assign({}, stackedBonuses)
        });
    }

    for (const db of data.displayBonus) {
        if (db.min === db.max) db.range = db.min.toString();
        else db.range = db.min + " -> " + db.max;
    }

    return data;
}


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Vue

let data = {
    editable: false,
    category: "",
    items: {},
    dstList: {},
    editMode: false,
    pending: [],
    errorMessage: false,
    commitMessage: false,
    categories: [],
    categoryType: null,
    itemsets: {}
};

Vue.component(
    'item-row', {
    props: [ 'item', 'dstlist', 'editmode' ],
    template: `
    <tr v-bind:style="item.style">
        <td><img v-bind:src="'dds/' + item.icon" /></td>
        <td>{{ item.name }}</td>
        <td>{{ item.jobName }}</td>
        <td><span v-if="item.level != 0">{{ item.level }}</span></td>
        <td class="has-text-left" v-html="buildBonus(item.bonus)" v-if="editmode !== true"></td>
        <td class="has-text-left" v-if="editmode">
        <template v-for="(awake, iAwake) in item.bonus">
            <br v-if="iAwake > 0" />
            <div class="select is-small">
            <select v-model="awake[0]" v-on:change="changedItem(item)">
                <option
                    v-for="(value, key) in dstlist"
                    v-bind:value="key"
                >
                    {{ value.tid }}
                </option>
            </select>
            </div>
            <input type="number" v-model="awake[1]" v-on:change="changedItem(item)" class="is-small" style="width: 8em;" />
        </template>
        </td>
    </tr>
    `,
    methods: {
        buildBonus(bonuses) {
            return bonuses.filter(x => x[0] !== 'DST_NONE').map(
                x => stringify.awake(x, data.dstList)
            ).join("<br>");
        },
        changedItem(item) {
            const old = item.isModified;
            item.isModified = ItemModification.hasBeenModified(item);
            item.style = item.isModified ? 'color: red' : 'color: inherit';

            if (old !== item.isModified) {
                this.$emit("modifieditem", item);
            }
        }
    }
})

Vue.component(
    'item-set-row', {
    props: [ 'itemset', 'dstlist' ],
    template: `
    <tr v-bind:style="itemset.style">
        <td>
            <div class="columns">
                <div class="column" v-for="iset in itemset.sets">
                <strong>{{ iset.name }}</strong>
                    <span v-for="item in iset.items">
                        <br />
                        <img v-bind:src="item.iconpath" style="width: 16px; height: 16px" />
                        {{ item.name }}
                    </span>
                </div>
            </div>
        </td>
        <td>
            <span v-for="(job, index) in itemset.jobs.jobs">
                <span v-if="index > 0"> / </span>
                {{ job }}
            </span>
            <br v-if="itemset.jobs.jobs.length !== 0" />
            <em>Niveau {{ itemset.jobs.level }}</em>
        </td>
        <td>
            <div class="columns">
                <div
                    class="column"
                    v-for="displaybonus in itemset.displayBonus"
                >
                    <strong>{{ displaybonus.range }} parties</strong>
                    <span v-html="buildBonus(displaybonus.bonus)">
                    </span>
                </div>
            </div>

        </td>
    </tr>
    
    
    
    `,
    methods: {
        buildBonus(bonuses) {
            return Object.entries(bonuses)
                .map(x => stringify.awake(x, data.dstList))
                .map(x => "<br />" + x)
                .join("");
        }


    }


});

let app = new Vue({
    el: "#app",
    data: data,
    methods: {
        modifyItemList(items) {
            let z = {};
        
            Object.values(items)
                .map(item => transformNetworkedItem(item))
                .forEach(i => z[i.id] = i);

            this.items = z;

            for (let i = 0; i != this.pending.length; ++i) {
                const pendingItem = this.pending[i];
                const realItem = this.items[pendingItem.id];

                if (realItem !== undefined) {
                    realItem.bonus = pendingItem.bonus;
                    this.pending[i] = realItem;
                    
                    realItem.isModified = ItemModification.hasBeenModified(realItem);
                    realItem.style = realItem.isModified ? 'color: red' : 'color: inherit';
                }
            }
        },
        modifyItemSetList(itemSets) {
            this.itemsets = {};

            let existings = {};

            for (const itemset of itemSets.map(is => transformNetworkedItemset(is))) {
                const key = JSON.stringify(itemset.jobs) + JSON.stringify(itemset.displayBonus)
                if (existings[key] !== undefined) {
                    this.itemsets[existings[key]].sets.push(itemset.sets[0]);
                } else {
                    existings[key] = itemset.id;
                    this.itemsets[itemset.id] = itemset;
                }
            }
        },
        reset() {
            Object.values(this.items)
                .forEach(item => {
                    item.bonus = copyArray2LevelsDeep(item.originalBonus);
                    item.style = "color: inherit;"
                    item.isModified = false;
                });
            
            this.pending.length = 0;
            this.errorMessage = false;
            this.commitMessage = false;
        },
        modifyPending(item) {
            if (this.pending.indexOf(item) !== -1) {
                if (!item.isModified) {
                    this.pending.splice(this.pending.indexOf(item), 1);
                }
            } else {
                this.pending.push(item);
            }
        },
        strInLine(bonus) {
            let str = bonus.filter(b => b[0] !== 'DST_NONE')
            .map(b => stringify.awake(b, data.dstList))
            .join(", ");

            if (str === '') return "(No bonus)";
            return str;
        },
        submit() {
            const isAValidAwake = function(awake) {
                return awake[0] !== 'DST_NONE' && awake[1] !== '' && !isNaN(awake[1]);
            };

            const toPush = this.pending
                .map(item => [item.id, item.bonus])
                .reduce((acc, v) => {
                    acc[v[0]] = v[1].filter(a => isAValidAwake(a))
                        .map(([d, v]) => [d, parseInt(v)]);
                    return acc; 
                }, {});

            const self = this;
            $.ajax({
                url: 'rest/individual-items/awakes',
                method: 'POST',
                data: JSON.stringify(toPush),
                dataType: "json",
                contentType: "application/json; charset=utf-8",
            }).done(function(c) {
                if (c.error) {
                    self.errorMessage = 'Bad request:\n'
                        + JSON.stringify(c.error, null, 2);
                    self.commitMessage = false;
                } else {
                    self.errorMessage = false;

                    let commitMessage = `Successfully changed ${c.modified.length}`;
                    if (c.notProcessed !== undefined) {
                        commitMessage += " / " + (Object.keys(c.notProcessed).length);
                    }
                    commitMessage += " items";

                    self.commitMessage = commitMessage;

                    for (const changedItem of c.modified) {
                        if (self.items[changedItem.id] !== undefined) {
                            self.items[changedItem.id] = transformNetworkedItem(changedItem);
                        }

                        self.pending.splice(self.pending.findIndex(i => i.id === changedItem.id), 1);
                    }
                }
            });
        }
    }
});

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Communication with the server

(() => {
    $.ajax({
        url: 'rest/dst-names'
    }).done(function(c) {
        if (c.result) {
            data.dstList = {
                'DST_NONE': { tid: "" }
            };

            for (const [key, value] of Object.entries(c.result)) {
                data.dstList[key] = value;
            }

            requestServices();
        } else {
            console.error("Error on loading dst_names");
        }
    });

})();

function requestServices() {
    $.ajax({
        url: 'rest/services'
    }).done(c => {
        data.editable = c.isEditable;
        data.categories.push(...c.categories);

        if (data.categories.length > 0) {
            requestIk3(0);
        }
    });
}

function requestIk3(requestedCategory) {
    $.ajax({
        url: 'rest/category/' + requestedCategory
    }).done(function (c) {
        if (c.error) {
            console.error(c.error);
            return;
        }

        document.getElementById("loading").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        data.category = data.categories[requestedCategory];

        if (c.type === 'Single Item') {
            app.modifyItemList(c.items);
            data.categoryType = 'Single Item';
        } else if (c.type === 'Item Set') {
            app.modifyItemSetList(c.itemSets);
            data.categoryType = 'Item Set';
        } else {
            data.categoryType = 'Unsupported type: ' + c.type;
        }
    });
}

