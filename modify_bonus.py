import items_manager

item_manager = items_manager.get_item_manager()
item_list = items_manager.get_item_list()

modified_items = {}
modified_sets = {}

with open(items_manager.THIS_DIR + "changed_bonus.txt") as f:
    for line in f.readlines():
        line = line.strip()
        if line is None or len(line) == 0:
            continue
        
        splitted = line.split(" ")
        
        id = splitted[0]
        
        new_bonus = []

        for i in range(items_manager.nb_param()):
            if 1 + i * 2 >= len(splitted):
                break

            bonus_type = splitted[1 + i * 2]
            bonus_value = splitted[1 + i * 2 + 1]
            
            if bonus_type == "=" or bonus_value == "0":
                continue
            
            new_bonus.append((bonus_type, bonus_value))
        
        while len(new_bonus) != items_manager.nb_param():
            new_bonus.append(("=", "="))

        if id.startswith("SET_"):
            split = id.split("_")
            assert(len(split) == 4)
            male_id = split[1]
            female_id = split[2]
            parts_nb = split[3]
            modified_sets[(int(male_id), int(parts_nb))] = new_bonus
            modified_sets[(int(female_id), int(parts_nb))] = new_bonus

            print("Set detected : " + str(split))
        else:
            composed_item = id.find("__II_ARM")
            if composed_item == -1:
                modified_items[id] = new_bonus
            else:
                male_id = id[0:composed_item]
                female_id = id[composed_item + 2:]

                modified_items[male_id] = new_bonus
                modified_items[female_id] = new_bonus


if len(modified_items) != 0:
    def rewrite_function(line, parameters_list):
        if parameters_list[item_manager['ID']] not in modified_items:
            return line

        id = parameters_list[item_manager['ID']]
        rewritten_bonus = modified_items[id]

        for i in range(items_manager.nb_param()):
            parameters_list[i + item_manager['START_DW_PARAM']] = rewritten_bonus[i][0]
            parameters_list[i + item_manager['START_ADJ_PARAM']] = rewritten_bonus[i][1]

        return "\t".join(parameters_list)


    new_propItemContent = items_manager.rewrite_prop_item(items_manager.getPropItemPath(), rewrite_function)

    f = open(items_manager.modifiedPropItem(), "w+", encoding="ansi")
    f.write("\n".join(new_propItemContent))
    f.close()


if len(modified_sets) != 0:
    def copy(line, data):
        data.append(line)

    def copy_4arg(line, data, _a, _b):
        copy(line, data)

    def copy_6arg(line, data, _a, _b, _c, _d):
        copy(line, data)

    def on_start_bonus(data, last_seen_id, _last_seen_etc):
        for nb_part in [2, 3, 4]:
            if (int(last_seen_id), nb_part) in modified_sets:
                for bonus in modified_sets[int(last_seen_id), nb_part]:
                    if bonus[0] == "=":
                        continue

                    line = "\t\t" + str(bonus[0]) + "\t" + str(bonus[1]) + "\t" + str(nb_part) + "\n"
                    data.append(line)

    def on_receive_bonus(line, data, last_seen_id, _a, _dst, _value, required_parts):
        if (int(last_seen_id), required_parts) in modified_sets:
            pass
        else:
            data.append(line)

    rewritten_file = items_manager.read_prop_item_etc([], copy, copy_4arg, copy_6arg, on_receive_bonus, on_start_bonus)

    f = open(items_manager.modifiedPropItemEtc(), "w+", encoding="utf-16-le")
    f.write("".join(rewritten_file))
    f.close()
