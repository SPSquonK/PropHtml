import re
import items_manager


# SPECIAL CASE :
# II_ARM_M_ELE_$05 -> will remove every II_ARM_(M|F)_(HELMET|SUIT|GAUNTLET|BOOTS)05 item
# II_ARM_M_MAG_$0101 II_ARM_M_ACR_$_SET_01 -> will replace with the corresponding acr set 01

item_manager = items_manager.get_item_manager()
item_list = items_manager.get_item_list()


# Read items to delete
items_to_remove = []


with open(items_manager.THIS_DIR + "items_to_remove.txt") as f:
    for line in f.readlines():
        line = line.strip()
        if line is None or len(line) == 0:
            continue
        
        m = re.findall("([A-Za-z0-9$_]+)", line)

        if len(m) != 0:
            dollar_pos = m[0].find("$")

            if dollar_pos != -1:
                dollars = [x.find("$") for x in m]

                sets = ["HELMET", "SUIT", "GAUNTLET", "BOOTS"]
                prefix = ["II_ARM_M_", "II_ARM_F"]

                def apply(match_content, part_name, prefix):
                    content = []

                    for i in range(len(match_content)):
                        x = match_content[i]
                        n = prefix + x[len(prefix):dollars[i]] + part_name + x[dollars[i] + 1:]
                        content.append(n)

                    print(content[0])
                    return content

                for s in sets:
                    for p in prefix:
                        items_to_remove.append(apply(m, s, p))
            else:
                items_to_remove.append(m)

delete_items = []
rewritten_bonus = {}
replacement_for_set = {}
        
for item_to_remove in items_to_remove:
    delete_items.append(item_to_remove[0])
    
    if len(item_to_remove) == 2:
        bonus = []
        
        bonus.extend(item_list[item_to_remove[1]]['Bonus'])
        bonus.extend(item_list[item_to_remove[0]]['Bonus'])
        rewritten_bonus[item_to_remove[1]] = bonus
        replacement_for_set[item_to_remove[0]] = item_to_remove[1]
    else:
        replacement_for_set[item_to_remove[0]] = None


def rewrite_function(line, parameters_list):
    if parameters_list[item_manager['ID']] in delete_items:
        return None

    if parameters_list[item_manager['ID']] not in rewritten_bonus:
        return line

    id = parameters_list[item_manager['ID']]

    for i in range(min(len(rewritten_bonus[id]), item_manager['LEN_DW_PARAM'])):
        parameters_list[i + item_manager['START_DW_PARAM']] = rewritten_bonus[id][i][0]
        parameters_list[i + item_manager['START_ADJ_PARAM']] = rewritten_bonus[id][i][1]

    return "\t".join(parameters_list)


new_propItemContent = items_manager.rewrite_prop_item(items_manager.getPropItemPath(), rewrite_function)
new_propItemContent = "\n".join(new_propItemContent)

f = open(items_manager.modifiedPropItem(), "w+", encoding="ansi")
f.write(new_propItemContent)
f.close()

# Set replacement
if len(replacement_for_set) != 0:  # Which should always be true is this is started
    def copy(line, data):
        data.append(line)

    def on_receive_item_id(line, data, _set_id, _a, item_id, part_item):
        if item_id not in replacement_for_set:
            data.append(line)
            return

        if replacement_for_set[item_id] is None:
            return

        new_line = "\t\t" + replacement_for_set[item_id] + "\t" + part_item + "\n"
        data.append(new_line)

    new_content = items_manager.read_prop_item_etc([], copy, on_receive_item_id=on_receive_item_id)

    f = open(items_manager.modifiedPropItemEtc(), "w+", encoding="utf-16-le")
    f.write("".join(new_content))
    f.close()
