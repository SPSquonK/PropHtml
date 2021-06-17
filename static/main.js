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

        if (dstProp[dst].isRate) {
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



////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Vue

let data = {
    category: "",
    items: {},
    dstList: {},
    editMode: false,
    pending: []
};

Vue.component(
    'item-row', {
    props: [ 'item', 'dstlist', 'editmode' ],
    template: `
    <tr v-bind:style="item.style">
        <td><img v-bind:src="'dds/' + item.icon" /></td>
        <td>{{ item.id }}</td>
        <td>{{ item.name }}</td>
        <td>{{ item.jobName }}</td>
        <td><span v-if="item.level != 0">{{ item.level }}</span></td>
        <td v-html="buildBonus(item.bonus)" v-if="editmode !== true"></td>
        <td v-if="editmode">
        <template v-for="(awake, iAwake) in item.bonus">
            <br v-if="iAwake > 0" />
            <select v-model="awake[0]" v-on:change="changedItem(item)">
            <option
                v-for="(value, key) in dstlist"
                v-bind:value="key"
            >
                {{ value.tid }}
            </option>
            </select>
            <input type="number" v-model="awake[1]" v-on:change="changedItem(item)">
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
        hasBeenModified(item) {
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
        },
        changedItem(item) {
            const old = item.isModified;
            item.isModified = this.hasBeenModified(item);
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
        },
        reset() {
            Object.values(this.items)
                .forEach(item => {
                    item.bonus = copyArray2LevelsDeep(item.originalBonus);
                    item.style = "color: inherit;"
                    item.isModified = false;
                });
            
            this.pending.length = 0;
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

            $.ajax({
                url: 'rest/item-awakes',
                method: 'POST',
                data: JSON.stringify(toPush),
                dataType: "json",
                contentType: "application/json; charset=utf-8",
            }).done(function(c) {
                if (c.error) {
                    console.error(c.error);
                } else {
                    console.log("Success")
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
        url: 'rest/dst_names'
    }).done(function(c) {
        if (c.result) {
            data.dstList = {
                'DST_NONE': { tid: "" }
            };

            for (const [key, value] of Object.entries(c.result)) {
                data.dstList[key] = value;
            }

            requestIk3('IK3_SWD');
        } else {
            console.error("Error on loading dst_names");
        }
    });
})();

function requestIk3(ik3) {
    $.ajax({
        url: 'rest/ik3/' + ik3
    }).done(function (c) {
        if (c.error) {
            console.error(c.error);
            return;
        }

        document.getElementById("loading").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        data.category = ik3;

        let z = {};
        
        Object.values(c.items).map(item => {
            item.bonus = item.bonus.map(awake => awake == null ? ['DST_NONE', ""] : awake )
            item.originalBonus = copyArray2LevelsDeep(item.bonus);
            item.style = "color: inherit;";
            item.isModified = false;
            return item;
        }).forEach(i => z[i.id] = i);

        app.modifyItemList(z);
    });
}

