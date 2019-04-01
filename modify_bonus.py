import items_manager

item_manager = items_manager.get_item_manager()
item_list = items_manager.get_item_list()

modified_items = {}

with open(items_manager.THIS_DIR + "changed_bonus.txt") as f:
    for line in f.readlines():
        line = line.strip()
        if line is None or len(line) == 0:
            continue
        
        splitted = line.split(" ")
        
        id = splitted[0]
        
        new_bonus = []
        
        
        for i in range(items_manager.nb_param()):
            bonus_type = splitted[1 + i * 2]
            bonus_value = splitted[1 + i * 2 + 1]
            
            if bonus_type == "=" or bonus_value == "0":
                continue
            
            new_bonus.append((bonus_type, bonus_value))
        
        while len(new_bonus) != items_manager.nb_param():
            new_bonus.append(("=", "="))
        
        modified_items[id] = new_bonus
        


new_propItemContent = []

with open(items_manager.getPropItemPath(), encoding="ansi") as f:
    for line in f.readlines():    
        origline = line
        line = line.replace(str(chr(10)), "").replace("\r", "").strip()
        
        if line is None or line.startswith("//"):
            new_propItemContent.append(line)
            continue
        
        parameters_list = line.split("\t")
        
        if len(line) == 0:
            new_propItemContent.append("")
            continue
        
        if len(parameters_list) != item_manager['EXPECTED_LENGTH']:
            if item_manager['DEFAULT_ON_EXP_LENGTH']:
                print("propItem is not well formed at line : " + line + " " + str(len(line)))
                exit(0)
            else:
                item_manager['DEFAULT_ON_EXP_LENGTH'] = True
                item_manager['EXPECTED_LENGTH'] = len(parameters_list)
        
        if parameters_list[item_manager['ID']] not in modified_items:
            new_propItemContent.append(line)
            continue
        
        id = parameters_list[item_manager['ID']]
        rewritten_bonus = modified_items[id]
        
        for i in range(items_manager.nb_param()):
            parameters_list[i + item_manager['START_DW_PARAM']] = rewritten_bonus[i][0]
            parameters_list[i + item_manager['START_ADJ_PARAM']] = rewritten_bonus[i][1]
        
        new_propItemContent.append("\t".join(parameters_list))


f = open(items_manager.modifiedPropItem(), "w+", encoding="ansi")
f.write("\n".join(new_propItemContent))
f.close()
