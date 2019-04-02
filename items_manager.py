import re
from collections import OrderedDict 
import os

'''
    This file gives useful functions to read propItem.txt files
'''

# Constants

configuration = None

ITEM_MANAGER = None

ITEM_REGEX = "([A-Za-z0-9_]+)"
THIS_DIR = os.path.dirname(os.path.abspath(__file__)) + "\\"

JOBS_VALUE = [
    ['JOB_VAGRANT', 'JOB_MERCENARY', 'JOB_ACROBAT', 'JOB_ASSIST', 'JOB_MAGICIAN',
     'JOB_KNIGHT', 'JOB_BLADE', 'JOB_JESTER', 'JOB_RANGER',
     'JOB_RINGMASTER', 'JOB_BILLPOSTER', 'JOB_PSYCHIKEEPER', 'JOB_ELEMENTOR'],
    ['JOB_KNIGHT_MASTER', 'JOB_BLADE_MASTER', 'JOB_JESTER_MASTER', 'JOB_RANGER_MASTER',
     'JOB_RINGMASTER_MASTER', 'JOB_BILLPOSTER_MASTER', 'JOB_PSYCHIKEEPER_MASTER', 'JOB_ELEMENTOR_MASTER'],
    ['JOB_KNIGHT_HERO', 'JOB_BLADE_HERO', 'JOB_JESTER_HERO', 'JOB_RANGER_HERO',
     'JOB_RINGMASTER_HERO', 'JOB_BILLPOSTER_HERO', 'JOB_PSYCHIKEEPER_HERO', 'JOB_ELEMENTOR_HERO'],
    ['JOB_LORDTEMPLER_HERO', 'JOB_STORMBLADE_HERO', 'JOB_WINDLURKER_HERO', 'JOB_CRACKSHOOTER_HERO',
     'JOB_FLORIST_HERO', 'JOB_FORCEMASTER_HERO', 'JOB_MENTALIST_HERO', 'JOB_ELEMENTORLORD_HERO'],
    ['JOB_HERO']
]

# --


def getPropItemPath():
    global configuration
    load_configuration()
    return configuration['path'] + configuration['propItem']


def path():
    global configuration
    load_configuration()
    return configuration['path']


def nb_param():
    global configuration
    load_configuration()
    return configuration['propItemParameters']


def modifiedPropItem():
    global configuration
    load_configuration()
    
    return getPropItemPath() if configuration['modifyInPlace'] else THIS_DIR + configuration['propItem']


def adjustForLEVTSZF():
    global configuration
    load_configuration()
    return configuration['LEVTSZF']
    

def load_configuration():
    global configuration
    if configuration is not None:
        return
        
    configuration = {}

    # Read file
    with open("config.txt") as f:
        for line in f.readlines():
            if line.startswith("//"):
                continue
            
            m = re.match("([A-Za-z]*) = (.*)$", line)
            
            if m is None:
                continue
                
            field = m.group(1)
            value = m.group(2)
            
            if field == "path":
                configuration['path'] = value.strip()
            elif field == "propItem":
                configuration['propItem'] = value.strip()
            elif field == "propItemParameters":
                configuration['propItemParameters'] = int(value)
            elif field == "modifyInPlace":
                configuration['modifyInPlace'] = value == "True"
            elif field == "legendaryemeraldvolcanoterrasunzeroflyff":
                configuration['LEVTSZF'] = value == "True"
            
    # Normalize configuration
    default_values = {
        "path": "..\\FlyFF-VS17\\Resource\\",
        "propItem": "propItem.txt",
        "propItemParameters": 6,
        "modifyInPlace": True,
        "LEVTSZF": False
    }
    
    for default_value_type in default_values:
        if default_value_type not in configuration or configuration[default_value_type] == "":
            configuration[default_value_type] = default_values[default_value_type]
    
    print(configuration)
    
    if configuration['path'][-1] != "\\" and configuration['path'][-1] != "/":
        configuration['path'] = configuration['path'] + "\\"
    
    # Force reload
    global ITEM_MANAGER
    ITEM_MANAGER = None
    get_item_manager()

# Gives the right item manager to your number of parameters. You can not store it, as it will be
# reminded by other functions, but you need to call it once if your number of dw param is different than 6
def get_item_manager():
    global ITEM_MANAGER
    global configuration
    load_configuration()
    
    if ITEM_MANAGER is None:
        number_of_parameters = configuration['propItemParameters']
    
        ITEM_MANAGER = {
            'ID': 1,
            'IDS_WEAPON_NAME': 2,
            'IK3': 7,
            'JOB': 8,
            'DOUBLE_HANDED': 16,
            'START_DW_PARAM': 53,
            'START_ADJ_PARAM': 53 + number_of_parameters,
            'SZICON': 132 - (6 - number_of_parameters) * 4,
            'LEVEL': 128 - (6 - number_of_parameters) * 4,
            'LEN_DW_PARAM': number_of_parameters,
            'EXPECTED_LENGTH': 136 - (6 - number_of_parameters) * 4,
            'DEFAULT_ON_EXP_LENGTH': False
        }

    return ITEM_MANAGER


# Decrypt an item with the line in propItem. You can 
def decrypt_item(line, item_manager=ITEM_MANAGER):
    if item_manager is None:
        load_configuration()
        item_manager = ITEM_MANAGER
    
    line = line.replace(str(chr(10)), "").replace("\r", "").strip()
    
    if line is None or line.startswith("//") or line == "":
        return None
    
    parameters_list = line.split("\t")
    
    
    if len(parameters_list) == 0 or parameters_list is None:
        return None
    
    if item_manager['EXPECTED_LENGTH'] != len(parameters_list):
        if item_manager['DEFAULT_ON_EXP_LENGTH']:
            print("propItem is not well formed at line : " + line + " " + str(len(line)))
            exit(0)
        else:
            item_manager['DEFAULT_ON_EXP_LENGTH'] = True
            item_manager['EXPECTED_LENGTH'] = len(parameters_list)
    
    bonus = []
    for i in range(item_manager['LEN_DW_PARAM']):
        bonus_type = parameters_list[item_manager['START_DW_PARAM'] + i].strip()
        bonus_quantity = parameters_list[item_manager['START_ADJ_PARAM'] + i].strip()
        
        if bonus_type == "=":
            continue
        
        bonus.append((bonus_type, bonus_quantity))
    
    return {
        'ID': parameters_list[item_manager['ID']],
        'TXT_NAME': parameters_list[item_manager['IDS_WEAPON_NAME']],
        'IK3': parameters_list[item_manager['IK3']],
        'JOB': parameters_list[item_manager['JOB']],
        'DOUBLE_HANDED': parameters_list[item_manager['DOUBLE_HANDED']] == 'HD_TWO',
        'ICON_IMAGE': parameters_list[item_manager['SZICON']].replace("\"", ""),
        'Level': 0 if parameters_list[item_manager['LEVEL']] == "=" else int(parameters_list[item_manager['LEVEL']]),
        'Bonus': bonus
    }


# Gives an ordered dictionary with every items in propItem
def get_item_list(propItem_path=None, item_manager=ITEM_MANAGER):
    if item_manager is None:
        load_configuration()
        item_manager = ITEM_MANAGER
        
    if propItem_path is None:
        propItem_path = getPropItemPath()

    items = OrderedDict()

    with open(propItem_path, encoding="ansi") as f:
        for line in f.readlines():
            item = decrypt_item(line, item_manager)
            if item is not None:
                items[item['ID']] = item
            
    return items


# Function to read .txt.txt files
def read_text_file(file, replacement_function, encoding="utf-16-le"):
    with open(file, encoding=encoding) as f:
        for line in f.readlines():
            # TODO : Use a regex  ([A-Za-z0-9_]*)\\s*(.*)$
            line.replace(chr(10), " ")
            index = line.find(" ")
            indextab = line.find("\t")

            if index == -1 and indextab == -1:
                continue

            if indextab != -1:
                if index == -1:
                    index = indextab
                else:
                    index = min(index, indextab)

            identifier = line[0:index]
            text = line[index:].strip()

            if text is None:
                continue

            replacement_function(identifier, text)


def adjust_for_levtszf(item_list):
    def legendary_emerald_volcano_terra_sun_zero_flyff_adjustements(w):
        if w['JOB'].find("_MASTER") != -1 or w['JOB'].find("_HERO") != -1:
            for jobs_value in JOBS_VALUE:
                if w['JOB'] not in jobs_value:
                    continue

                index = jobs_value.index(w['JOB'])
                w['JOB'] = JOBS_VALUE[0][index + 5]
                break
        w['OldLevel'] = w['Level']

        if w['Level'] <= 15:
            w['Level'] = 1
        elif w['Level'] < 60:
            w['Level'] = int((w['Level'] - 15) / 3 + 5)
        elif w['Level'] <= 125:
            w['Level'] = w['Level'] - 40
        else:
            w['Level'] = 100

    for item_id in item_list:
        legendary_emerald_volcano_terra_sun_zero_flyff_adjustements(item_list[item_id])


def value_of_job(job_name):
    for i in range(len(JOBS_VALUE)):
        if job_name in JOBS_VALUE[i]:
            return i
    return -1


if __name__ == '__main__':
    load_configuration()
    print(get_item_list())


def read_prop_item_etc(data, on_syntax_sugar, on_receive_set_id, on_receive_item_id, on_receive_bonus):
    """
        This function uses a pseudo automata to read the propItemEtc.inc file.
        Its purpose is to bind set related lines to action.

        The args function are not required to return anything. The used data is the object passed as an argument of this
        function. It can be anything that makes sense to solve your problem.

        Returns the given data parameter

        on_syntax_sugar(line, data) :
          An action that is called on every line that doesn't action other actionner
        on_receive_set_id(line, data, set_id, set_etc) :
          An action that is called when a line like "SetItem set_id set_etc" is read
        on_receive_item_id(line, data, last_seen_id, last_seen_etc, item_id, part_name) :
          An action that is called when in a SetItem block, a line like "II_ARM_ARMOR_ID PART_UPPER" is read
        on_receive_bonus(line, data, last_seen_id, last_seen_etc, dst, value, required_parts) :
          An action that is called  when a line like "DST_STR 7 2" is seen that means
          "this set gives 7 str with 2 parts"
    """

    # It's basically a bad automata but I'm too lazy to find one or properly develop one
    # states = ['SetItem', '/*', 'SetItem{', 'ElemOrAvail', 'Elem{', 'InElem', 'Avail{', 'InAvail']
    state = 'SetItem'

    auto_next_state = {
        'SetItem{': 'ElemOrAvail',
        'Elem{': 'InElem',
        'Avail{': 'InAvail',
    }

    last_seen_id = ''
    last_seen_etc = ''

    with open(path() + "propItemEtc.inc", encoding="utf-16-le") as f:
        for line in f.readlines():
            if state == 'SetItem':
                if line.startswith('/*'):
                    on_syntax_sugar(line, data)
                    state = '/*'
                else:
                    m = re.findall("\\s*SetItem\\s*([0-9]*)\\s*([A-Z0-9_a-z]*)(\\s*.*)?", line)
                    if m is not None and len(m) > 0:
                        on_receive_set_id(line, data, m[0][0], m[0][1])
                        last_seen_id = m[0][0]
                        last_seen_etc = m[0][1]
                        state = 'SetItem{'
                    else:
                        on_syntax_sugar(line, data)
            elif state == '/*':
                on_syntax_sugar(line, data)
                if line.find('*/') != -1:
                    state = 'SetItem'
            elif state == 'ElemOrAvail':
                on_syntax_sugar(line, data)
                if line.find('Elem') != -1:
                    state = 'Elem{'
                elif line.find('Avail') != -1:
                    state = 'Avail{'
                elif line.find('}') != -1:
                    state = 'SetItem'
                else:
                    print("LINE = [" + line + "]")
                    raise Exception('Unexpected line in state ' + state)
            elif state == 'InElem':
                if line.find('}') != -1:
                    on_syntax_sugar(line, data)
                    state = 'ElemOrAvail'
                else:
                    r = '([A-Za-z_0-9]+)'
                    r = r + "\\s*" + r
                    m = re.findall(r, line)

                    if m is not None and len(m) > 0:
                        on_receive_item_id(line, data, last_seen_id, last_seen_etc, m[0][0], m[0][1])
                    else:
                        on_syntax_sugar(line, data)
            elif state == 'InAvail':
                if line.find('}') != -1:
                    state = 'ElemOrAvail'
                    on_syntax_sugar(line, data)
                else:
                    regex = '([A-Za-z_0-9]*)\\s*([0-9]*)\\s*([0-9])'
                    result = re.findall(regex, line)

                    if result is not None and len(result) > 0:
                        on_receive_bonus(line, data, last_seen_id, last_seen_etc,
                                         result[0][0], result[0][1], int(result[0][2]))
                    else:
                        on_syntax_sugar(line, data)

            else:
                on_syntax_sugar(line, data)
                state = auto_next_state[state]

    return data


def rewrite_prop_item(prop_item_file, rewrite_function):
    """
    Rewrites a prop item by providing a list with every line in the rewritten function

    :param prop_item_file: The file to read
    :param rewrite_function: A function that takes a line and a split line and return the line to write or None
    :return: A list with the new content
    """
    new_content = []

    item_manager = get_item_manager()

    with open(prop_item_file, encoding="ansi") as f:
        for line in f.readlines():
            line = line.replace(str(chr(10)), "").replace("\r", "").strip()

            if line is None or line.startswith("//"):
                new_content.append(line)
                continue

            parameters_list = line.split("\t")

            if len(line) == 0:
                new_content.append("")
                continue

            if len(parameters_list) != item_manager['EXPECTED_LENGTH']:
                if item_manager['DEFAULT_ON_EXP_LENGTH']:
                    print("propItem is not well formed at line : " + line + " " + str(len(line)))
                    exit(0)
                else:
                    item_manager['DEFAULT_ON_EXP_LENGTH'] = True
                    item_manager['EXPECTED_LENGTH'] = len(parameters_list)

            rewritten_line = rewrite_function(line, parameters_list)
            if rewrite_function is not None:
                new_content.append(rewritten_line)

    return new_content
