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
    categories: []
};

Vue.component(
    'item-row', {
    props: [ 'item', 'dstlist', 'editmode' ],
    template: `
    <tr v-bind:style="item.style">
        <td><img v-bind:src="'dds/' + item.icon" /></td>
        <td><span style="font-family: monospace;">{{ item.id }}</span><br />{{ item.name }}</td>
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

let app = new Vue({
    el: "#app",
    data: data,
    methods: {
        modifyItemList(items) {
            this.items = items;

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
        url: 'rest/individual-items/category/' + requestedCategory
    }).done(function (c) {
        if (c.error) {
            console.error(c.error);
            return;
        }

        document.getElementById("loading").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        data.category = data.categories[requestedCategory];

        let z = {};
        
        Object.values(c.items).map(item => transformNetworkedItem(item)).forEach(i => z[i.id] = i);

        app.modifyItemList(z);
    });
}

