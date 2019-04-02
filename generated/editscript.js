

let every_change = {};


let serialize = function() {
    buffer = "";
    
    for (let key in every_change) {
        let value = every_change[key];
        
        buffer = buffer + value + "\n";
    }
    
    return buffer;
}

let changed_bonus = function(weapon_name) {
    
    let weapon_code = weapon_name + " ";
    
    for (let i = 0 ; i != 6 ; i++) {
        bonus_type = "#BONUS_" + i + "_" + weapon_name;
        bonus_value = "#BONUSVAL_" + i + "_" + weapon_name;

        let content = $(bonus_type+" option:selected").val() + " " + $(bonus_value+ "").val() + " ";

        if (content == "undefined undefined ") {
            break;
        }

        weapon_code = weapon_code + content;
    }

    every_change[weapon_name] = weapon_code;
    
    $("#TEXT_AREA").text(serialize())
}
