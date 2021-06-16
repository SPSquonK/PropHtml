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
// Vue

let data = {
    category: "",
    items: {},
    dstList: {},
    editMode: false
};

let app = new Vue({
    el: "#app",
    data: data,
    methods: {
        buildBonus(bonuses) {
            return bonuses.filter(x => x[0] !== 'DST_NONE').map(
                x => stringify.awake(x, data.dstList)
            ).join("<br>");
        },
        hasBeenModified(item) {
            for (let i = 0 ; i != item.bonus.length ; ++i) {
                if (item.bonus[0] == 'DST_NONE') {
                    if (item.originalBonus[0] != 'DST_NONE') return true;
                } else if (item.originalBonus[0] == 'DST_NONE') {
                    return true;
                } else {
                    if (item.bonus[0] != item.originalBonus[0]) {
                        return true;
                    }
                    
                    if (item.bonus[1] != item.originalBonus[1]) {
                        return true;
                    }
                }

            }

            return false;
        },
        changedItem(item) {
            item.style = this.hasBeenModified(item) ? 'color: red' : 'color: inherit';
        },
        modifyItemList(items) {
            this.items = items;
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

            item.originalBonus = item.bonus.map(awake => {
                if (awake === null) {
                    return ['DST_NONE', ''];
                } else {
                    return [...awake];  // copy
                }
            })

            item.style = "color: inherit;";

            return item;
        }).forEach(i => z[i.id] = i);

        app.modifyItemList(z);
    });
}

