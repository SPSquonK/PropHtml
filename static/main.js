
let data = {
    category: "",
    items: [],
    dstList: {}
};

let app = new Vue({
    el: "#app",
    data: data,
    methods: {
        buildBonus(bonuses) {
            return bonuses.filter(x => x != null).map(
                x => BonusToStr.bonusToString(x, data.dstList, {})
            ).join("<br>");
        }
    }
});

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

        data.category = ik3;
        data.items = c.items;
    });
}

