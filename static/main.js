"use strict";

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Display logic

const stringify = {
    awake: function([dst, value], dstProp) {
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
    items: [],
    dstList: {},
    editMode: false
};

let app = new Vue({
    el: "#app",
    data: data,
    methods: {
        buildBonus(bonuses) {
            return bonuses.filter(x => x != null).map(
                x => stringify.awake(x, data.dstList)
            ).join("<br>");
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
            data.dstList = c.result;
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
        data.items = c.items;
    });
}

