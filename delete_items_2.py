import re
import items_manager


item_manager = items_manager.get_item_manager()
item_list = items_manager.get_item_list()


# Read items to delete
items_to_remove = []


with open(items_manager.THIS_DIR + "items_to_remove.txt") as f:
    for line in f.readlines():
        line = line.strip()
        if line is None or len(line) == 0:
            continue
        
        m = re.findall(items_manager.ITEM_REGEX, line)
        
        if len(m) != 0:
            items_to_remove.append(m)


delete_items = []
rewritten_bonus = {}
        
for item_to_remove in items_to_remove:
    delete_items.append(item_to_remove[0])
    
    if len(item_to_remove) == 2:
        bonus = []
        
        bonus.extend(item_list[item_to_remove[1]]['Bonus'])
        bonus.extend(item_list[item_to_remove[0]]['Bonus'])
        rewritten_bonus[item_to_remove[1]] = bonus


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

f = open(items_manager.modifiedPropItem(), "w+", encoding="ansi")
f.write("\n".join(new_propItemContent))
f.close()

# TODO : deleted item with replacement have to also be rewritten in propItemEtc