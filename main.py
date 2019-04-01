#!/usr/bin/env python
import re
from collections import OrderedDict 
from jinja2 import Environment, FileSystemLoader
import argparse
from typing import Dict
# Custom import
import items_manager

# ======================================================================================================================
# ======================================================================================================================


def find_job_tuple(job_identifier, job_table):
    for job_class in range(len(job_table)):
        job_class_list = job_table[job_class]

        if job_identifier in job_class_list:
            return job_class, job_class_list.index(job_identifier)

    return -1, -1


class ProcessedItem:
    def __init__(self, item, job_list, bonus_for_form, build_form=True):
        self.icon = item['image_path']
        self.identifier = item['ID']
        self.name = item['WEAPON_NAME']
        self.item_kind = item['IK3']
        self.hands = item['DOUBLE_HANDED']

        # Level
        self.original_level = int(item['OldLevel'])
        self.real_level = item['Level']

        if item['JOB'] in job_list:
            self.display_level = str(item['Level']) + job_list[item['JOB']]['ExtraSymbol']
        else:
            self.display_level = str(item['Level'])

        # Bonus
        self.bonus_serialization = '<br>'.join(item['Bonus_Serialization'])

        bonus_js = []
        bonus_js.extend(item['Bonus'])
        while len(bonus_js) != items_manager.nb_param():
            bonus_js.append(("=", 0))
        self.raw_bonus = bonus_js

        if build_form:
            self.bonus_form = ProcessedFormBonus(self.identifier, self.raw_bonus).template(bonus_for_form)

        # Job
        self.job_name = job_list[item['JOB']]['Name'] if item['JOB'] in job_list else item['JOB']
        self.job_tuple_id = find_job_tuple(item['JOB'], items_manager.JOBS_VALUE)

    def get_weapon_key(self):
        return self.hands, self.job_tuple_id, self.original_level, self.name

    def is_an_item_kind_3(self, item_kind_3):
        if isinstance(item_kind_3, str):
            return self.item_kind == item_kind_3
        else:
            return self.item_kind in item_kind_3


class ProcessedFormBonus:
    html_template = None

    def __init__(self, identifier, bonus):
        self.identifier = identifier
        self.bonus = bonus

    @staticmethod
    def load_template(j2_env):
        ProcessedFormBonus.html_template = j2_env.get_template('template_form_bonus.htm')

    def template(self, bonus_kinds):
        if ProcessedFormBonus.html_template is None:
            raise Exception('No html template loaded')
        return ProcessedFormBonus.html_template.render(identifier=self.identifier, bonus=self.bonus, types=bonus_kinds)


# ======================================================================================================================
# ======================================================================================================================


# Gives the list of IK3 to retrieve according to the given kind
def get_categorization_from_kind(kind):
    if kind == 'weapons':
        return ['IK3_SWD', 'IK3_AXE', 'IK3_CHEERSTICK', 'IK3_KNUCKLEHAMMER', 'IK3_WAND', 'IK3_STAFF', 'IK3_YOYO',
                'IK3_BOW', 'IK3_CROSSBOW', 'IK3_SHIELD', 'IK3_MAGICBARUNA', 'IK3_ZEMBARUNA']
    elif kind == 'armors':
        return [['IK3_HELMET', 'IK3_SUIT', 'IK3_GAUNTLET', 'IK3_BOOTS']]
    else:
        raise Exception('Unexpected kind ' + kind)


def make_list_from_categorization(categorization):
    flat = []

    for a in categorization:
        if isinstance(a, str):
            flat.append(a)
        else:
            for b in a:
                flat.append(b)

    return flat


def filter_item_with_ik3(item_list, flatten_item_kinds_3):
    new_item_list = OrderedDict()

    for item in item_list:
        if item_list[item]['IK3'] in flatten_item_kinds_3:
            new_item_list[item] = item_list[item]

    return new_item_list


# Replace IDS name with real name
def replace_txt(item_list, identifier, text):
    for weapon_id in item_list:
        if item_list[weapon_id]['TXT_NAME'] == identifier:
            item_list[weapon_id]['WEAPON_NAME'] = text


def read_bonus_types():
    tooltips = OrderedDict()
    tooltips_rate = {}

    # Read WndManager to read existing bonus
    mode = 0  # 0 = search for an array, 1 = tooltip, 2 = rate
    with open(items_manager.path() + "..\\Source\\_Interface\\WndManager.cpp", encoding="cp949") as f:
        for line in f.readlines():
            line = line.strip().replace(u"\ufeff", "")
            if mode == 0:
                if line.startswith("static DST_STRING g_DstString[] ="):
                    mode = 1
                elif line.startswith("static constexpr int nDstRate[] = {"):
                    mode = 2
            else:
                if line == "};":
                    mode = 0
                else:
                    if mode == 1:  # Read dst types
                        m = re.findall("(DST_[A-Z_]*)\\s*,\\s*([A-Z_]*)", line)

                        if m is not None and len(m) != 0:
                            tooltips[m[0][0]] = m[0][1]

                    else:  # Read rates kind
                        m = re.findall("(DST_[A-Z_]*)", line)
                        if m is not None and len(m) != 0:
                            tooltips_rate[m[0]] = True

    # Search corresponding IDS with define
    mode = 0
    with open(items_manager.path() + "textClient.inc", encoding="utf-16-le") as f:
        for line in f.readlines():
            if mode == 0:
                space_pos = line.find("0x")
                tooltip = line[:space_pos].strip()

                for t in tooltips:
                    if tooltips[t] == tooltip:
                        tooltip_id = t
                        mode = 1
                        break

            elif mode == 1:
                mode = 2
            else:
                tooltips[tooltip_id] = line.strip()
                mode = 0

    # Convert IDS to text
    def replace_tooltip(identifier, text):
        for tooltip_name in tooltips:
            if tooltips[tooltip_name] == identifier:
                tooltips[tooltip_name] = text

    items_manager.read_text_file(items_manager.path() + "textClient.txt.txt", replace_tooltip)

    return tooltips, tooltips_rate


def get_bonus_serialization(bonus_kind, bonus_value, bonus_types, bonus_types_rate):
    if bonus_kind in bonus_types:
        bonus_type_serialized = bonus_types[bonus_kind]
    else:
        bonus_type_serialized = bonus_kind
        bonus_types[bonus_kind] = bonus_kind

    percent_mark = "%" if bonus_kind in bonus_types_rate else ""

    return bonus_type_serialized + " + " + str(bonus_value) + percent_mark


def serialize_bonus_types(item_list, bonus_types, bonus_types_rate):
    def set_bonus_name(weapon):
        weapon['Bonus_Serialization'] = []

        for bonus_type, bonus_value in weapon['Bonus']:
            serial = get_bonus_serialization(bonus_type, bonus_value, bonus_types, bonus_types_rate)
            weapon['Bonus_Serialization'].append(serial)

    for item_id in item_list:
        set_bonus_name(item_list[item_id])


def read_jobs():
    # Read jobs names
    job_names = {}

    def define_job_names(identifier, value):
        # Removes extra chracters before IDS
        if not identifier.startswith("IDS"):
            identifier = identifier[identifier.find("IDS"):]

        job_names[identifier] = value

    items_manager.read_text_file(items_manager.path() + "etc.txt.txt", define_job_names, "utf-16-le")

    # Build jobs properties
    jtype_with_symbols = {'JTYPE_MASTER': "-M", 'JTYPE_HERO': "-H"}

    jobs = {}

    with open(items_manager.path() + "etc.inc", encoding="utf-16-le") as f:
        for line in f.readlines():
            line = line.strip()
            m = re.findall("(JOB_[A-Z_]*)\\s*(IDS_ETC_[A-Z_0-9]*)\\s*[A-Z_0-9]*\\s*(JTYPE_[A-Z]*)", line)

            if m is None or len(m) == 0:
                continue

            m = m[0]

            jobs[m[0]] = {
                'Name': job_names[m[1]],
                'ExtraSymbol': '' if m[2] not in jtype_with_symbols else jtype_with_symbols[m[2]]
            }

    return jobs


# Builds image_path field in every item
def compute_icons(item_list):
    for item_id in item_list:
        weapon = item_list[item_id]

        if weapon['ICON_IMAGE'] is None:
            weapon['image_path'] = ""
            return

        img = "Item\\" + weapon['ICON_IMAGE'][:-3] + "png"
        weapon['image_path'] = img


def serialize_items(item_list, job_list, bonus_types, do_edit):
    serialized_class = {}

    if do_edit is None:
        do_edit = False

    for item_id in item_list:
        serialized_class[item_id] = ProcessedItem(item_list[item_id], job_list, bonus_types, do_edit)

    return serialized_class


def filter_level(item_list, min_level, max_level):
    # Build function
    def filter_function_min(item):
        return item['Level'] >= min_level

    def filter_function_max(item):
        return item['Level'] <= max_level

    def filter_function_both(item):
        return min_level <= item['Level'] <= max_level

    # Determine function
    if min_level is not None:
        if max_level is not None:
            filter_function = filter_function_both
        else:
            filter_function = filter_function_min
    else:
        if max_level is not None:
            filter_function = filter_function_max
        else:
            return item_list

    new_item_list = OrderedDict()
    for item_id in item_list:
        if filter_function(item_list[item_id]):
            new_item_list[item_id] = item_list[item_id]
    return new_item_list


def filter_jobs(item_list, jobs):
    if jobs is None:
        return item_list

    filtered = OrderedDict()

    for item_identifier in item_list:
        item = item_list[item_identifier]

        if item['JOB'] in jobs:
            filtered[item_identifier] = item

    return filtered


# ======================================================================================================================
# ======================================================================================================================
# -- HTML PAGE TEMPLATING  -- HTML PAGE TEMPLATING  -- HTML PAGE TEMPLATING  -- HTML PAGE TEMPLATING


def write_page(j2_env, html_content, page_name='item_list.htm'):
    content = j2_env.get_template('general_template.htm').render(html_content=html_content)
    f = open(items_manager.THIS_DIR + page_name, "w+")
    f.write(content)
    f.close()


def fill_template(j2_env, template, classification):
    ik3 = classification['Name']
    weapons = classification['Items']

    title = ik3 + " " + str(len(weapons)) + " items"

    return j2_env.get_template(template).render(weaponname=title, weapons=weapons)


def generate_html(j2_env, template_page, classified_serialization):
    html_code = []
    for i in range(len(classified_serialization)):
        html_code.append(fill_template(j2_env, template_page, classified_serialization[i]))
    write_page(j2_env, "\r\n".join(html_code))


def generate_html_edit(j2_env, template_page, classified_serialization):
    for i in range(len(classified_serialization)):
        classification = classified_serialization[i]
        html_content = fill_template(j2_env, template_page, classification)
        write_page(j2_env, html_content, "item_list_" + classification['Name'] + ".htm")


# ======================================================================================================================
# ======================================================================================================================
# -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS  -- WEAPONS


def classify(serialization: Dict[str, ProcessedItem], item_kinds_3):
    def make_name(ik3):
        if isinstance(ik3, str):
            return ik3
        else:
            return "-".join(ik3)

    classifications = []

    for i in range(len(item_kinds_3)):
        ik3_group = item_kinds_3[i]
        classification = {'Name': make_name(ik3_group), 'Items': []}

        for item_id in serialization:
            item = serialization[item_id]

            if item.is_an_item_kind_3(ik3_group):
                classification['Items'].append(item)

        classification['Items'] = sorted(classification['Items'], key=lambda weapon: weapon.get_weapon_key())
        classifications.append(classification)

    return classifications


def make_bonus_list(bonus_types, bonus_types_rate):
    bonus_types_js = [{'DST': '=', 'Name': ''}]
    for bonus_type in bonus_types:
        percent = " (%)" if bonus_type in bonus_types_rate else ""
        bonus_types_js.append({'DST': bonus_type, 'Name': bonus_types[bonus_type] + percent})
    return bonus_types_js


def finish_processing_weapon(j2_env, serialization, item_kinds_3, args_result):
    classified_serialization = classify(serialization, item_kinds_3)

    # Page Generation
    generate_html(j2_env, 'template.htm', classified_serialization)

    if args_result.edit:
        generate_html_edit(j2_env, 'template_js.htm', classified_serialization)


# ======================================================================================================================
# ======================================================================================================================
# -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS -- ARMORS


def group_armor_by_sex(serialization):
    def modify_id(original_id, letter):
        return original_id[0:position_char_to_replace] + letter + original_id[position_char_to_replace + 1:]

    constants = {'VALID_CHARACTER': "[0-9_A-Za-z]"}
    constants['REGEX_M'] = "II_ARM_M_" + constants['VALID_CHARACTER'] + "*"
    constants['REGEX_F'] = "II_ARM_F_" + constants['VALID_CHARACTER'] + "*"
    constants['REGEX_MEnd'] = "II_ARM_LC_" + constants['VALID_CHARACTER'] + "*" + "_M"
    constants['REGEX_FEnd'] = "II_ARM_LC_" + constants['VALID_CHARACTER'] + "*" + "_F"
    position_char_to_replace = 7

    grouped = {}
    used_items = set()

    for item_id in serialization:
        if item_id in used_items:
            continue

        if re.match(constants['REGEX_M'], item_id):
            corresponding_id = modify_id(item_id, 'F')
            is_male = True
        elif re.match(constants['REGEX_F'], item_id):
            corresponding_id = modify_id(item_id, 'M')
            is_male = False
        elif re.match(constants['REGEX_MEnd'], item_id):
            corresponding_id = item_id[:-1] + 'F'
            is_male = True
        elif re.match(constants['REGEX_FEnd'], item_id):
            corresponding_id = item_id[:-1] + 'M'
            is_male = False
        else:
            continue

        if corresponding_id in serialization:
            used_items.add(item_id)
            used_items.add(corresponding_id)

            if is_male:
                grouped[item_id] = (serialization[item_id], serialization[corresponding_id])
            else:
                grouped[corresponding_id] = (serialization[corresponding_id], serialization[item_id])

    for item_id in serialization:
        if item_id not in used_items:
            print(str(item_id) + " is excluded")

    return grouped


def group_armor_by_category(serialization):
    constants = {'VALID_CHARACTER': "[0-9_A-Za-z]"}
    # We don't group id that doesn't follow the REGEX_M scheme
    constants['REGEX_M'] = "II_ARM_M_" + constants['VALID_CHARACTER'] + "*"

    constants['START_REGEX'] = "II_ARM_M(_" + constants['VALID_CHARACTER'] + "*_?)?"
    constants['END_REGEX'] = "(_?" + constants['VALID_CHARACTER'] + "*)?"

    def match_with(item_id):
        possible_match = ['HELMET', 'SUIT', 'GAUNTLET', 'BOOTS']
        for part in possible_match:
            r = re.match(constants['START_REGEX'] + part + constants['END_REGEX'], item_id)
            if r is not None:
                return r.group(1), r.group(2), part

        return None

    grouped = {}
    solo = []

    for male_item_id in serialization:
        match_result = match_with(male_item_id)

        if match_result is None:
            solo.append(serialization[male_item_id])
        else:
            set_id = (match_result[0], match_result[1])
            if set_id not in grouped:
                grouped[set_id] = {}

            grouped[set_id][match_result[2]] = serialization[male_item_id]

    return grouped, solo


def read_raw_data_set():
    # It's basically a bad automata but I'm too lazy to find one or properly develop one
    # states = ['SetItem', '/*', 'SetItem{', 'ElemOrAvail', 'Elem{', 'InElem', 'Avail{', 'InAvail']
    d = {}
    state = 'SetItem'

    auto_next_state = {
        'SetItem{': 'ElemOrAvail',
        'Elem{': 'InElem',
        'Avail{': 'InAvail',
    }

    current_ids = ''

    with open(items_manager.path() + "propItemEtc.inc", encoding="utf-16-le") as f:
        for line in f.readlines():
            if state == 'SetItem':
                if line.startswith('/*'):
                    state = '/*'
                else:
                    m = re.findall("\\s*SetItem\\s*([0-9]*)\\s*([A-Z0-9_a-z]*)(\\s*.*)?", line)
                    if m is not None and len(m) > 0:
                        current_ids = m[0][1]
                        d[current_ids] = {'parts': [], 'bonus': [], 'set_id': int(m[0][0])}
                        state = 'SetItem{'
            elif state == '/*':
                if line.find('*/') != -1:
                    state = 'SetItem'
            elif state == 'ElemOrAvail':
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
                    state = 'ElemOrAvail'
                else:
                    r = '[A-Za-z_0-9]+'
                    m = re.findall(r, line)

                    if m is not None and len(m) > 0:
                        d[current_ids]['parts'].append(m[0])
            elif state == 'InAvail':
                if line.find('}') != -1:
                    state = 'ElemOrAvail'
                else:
                    regex = '([A-Za-z_0-9]*)\\s*([0-9]*)\\s*([0-9])'
                    result = re.findall(regex, line)

                    if result is not None and len(result) > 0:
                        d[current_ids]['bonus'].append((int(result[0][2]), result[0][0], result[0][1]))
            else:
                state = auto_next_state[state]

    return d


def write_set_name(raw_data):
    def replacement(identifier, value):
        if identifier in raw_data:
            raw_data[identifier]['Name'] = value

    items_manager.read_text_file(items_manager.path() + 'propItemEtc.txt.txt', replacement)


def serialize_bonus(raw_data, bonus_types, bonus_types_rate):
    for armor_set_ids in raw_data:
        armor_set = raw_data[armor_set_ids]
        armor_set['Bonus_Serialization'] = {2: [], 3: [], 4: []}
        for bonus_group in armor_set['bonus']:
            if bonus_group[0] in (2, 3, 4):
                serial = get_bonus_serialization(bonus_group[1], bonus_group[2], bonus_types, bonus_types_rate)
                armor_set['Bonus_Serialization'][bonus_group[0]].append(serial)


def read_existing_sets(bonus_types, bonus_types_rate):
    raw_data = read_raw_data_set()
    write_set_name(raw_data)
    serialize_bonus(raw_data, bonus_types, bonus_types_rate)

    return raw_data


def find_corresponding_set(components, existing_sets):
    for set_ids in existing_sets:
        existing_set = existing_sets[set_ids]
        if set(components).issubset(set(existing_set['parts'])):
            return set_ids

    return None


def match_group_and_sets(solo, grouped_items_by_category, existing_sets):
    matching = {}

    # Solo Items
    for i in range(len(solo)):
        matching['SoloItem' + str(i)] = {
            'Name': "",
            'Bonus': [],
            'Bonus_Serialized': [],
            'Groups': [{'UniqueImte': solo[i]}],
            'SetId': None
        }

    # Groups
    def flatten_item(item_arrangement):
        item_list_male = []
        item_list_female = []

        for key in item_arrangement:
            item_list_male.append(item_arrangement[key][0].identifier)
            item_list_female.append(item_arrangement[key][1].identifier)

        return item_list_male, item_list_female

    i = 0
    for group_key in grouped_items_by_category:
        components_m, components_f = flatten_item(grouped_items_by_category[group_key])

        corresponding_set_id = find_corresponding_set(components_m, existing_sets)

        if corresponding_set_id is None:
            matching['GroupItem' + str(i)] = {
                'Name': "",
                'Bonus': [],
                'Bonus_Serialized': [],
                'Groups': [grouped_items_by_category[group_key]],
                'SetId': None
            }
            i = i + 1
        else:
            if corresponding_set_id not in matching:
                existing_set = existing_sets[corresponding_set_id]
                matching[corresponding_set_id] = {
                    'Name': existing_set['Name'],
                    'Bonus': existing_set['bonus'],
                    'Bonus_Serialized': existing_set['Bonus_Serialization'],
                    'Groups': [],
                    'SetId': (existing_set['set_id'],
                              existing_sets[find_corresponding_set(components_f, existing_sets)]['set_id'])
                }

            matching[corresponding_set_id]['Groups'].append(grouped_items_by_category[group_key])

    return matching


def group_comparator(g):
    return g['level'], g['job'], g['name']


def extract_one_item(set_groups):
    first_group = set_groups['Groups'][0]

    for item_group in first_group.values():
        return item_group[0]
    return None


def normalize_subgroups(group):
    def order_parts(part):
        order_map = {
            'HELMET': 0,
            'SUIT': 1,
            'GAUNTLET': 2,
            'BOOTS': 3
        }
        return order_map[part] if part in order_map else 4

    subgroups = []
    for subgroup in group['Groups']:
        l = []

        for part_name in sorted(subgroup, key=order_parts):
            part_item = subgroup[part_name]
            l.append({
                'male_icon': part_item[0].icon,
                'female_icon': part_item[1].icon,
                'male_name': part_item[0].name,
                'female_name': part_item[1].name,
                'male_identifier': part_item[0].identifier,
                'female_identifier': part_item[1].identifier,
                'bonus': part_item[0].bonus_serialization,
                'raw_bonus': part_item[0].raw_bonus
            })

        subgroups.append(l)

    return subgroups


def normalize_armors(j2_env, set_groups, build_bonus_form):
    global_d = []

    for group_id in set_groups:
        group = set_groups[group_id]
        one_item: ProcessedItem = extract_one_item(group)  # TODO : mythical set
        global_d.append({
            'name': group['Name'],
            'level': one_item.original_level,
            'job': one_item.job_name if len(group['Groups']) == 1 else '*',
            'raw_bonus': (group['SetId'], group['Bonus']),
            'bonus': group['Bonus_Serialized'],
            'subgroups': normalize_subgroups(group)
        })

    # Rewrite bonus for editing
    if build_bonus_form is not None:
        def convert_to_bonus(bonus_list, nb_part):
            identifier = "SET_" + str(bonus_list[0][0]) + "_" + str(bonus_list[0][1]) + "_" + str(nb_part)

            bonus = []
            for triple in bonus_list[1]:
                nb_part_triple, dst_triple, dst_value = triple
                if nb_part_triple == nb_part:
                    bonus.append((dst_triple, dst_value))

            while len(bonus) != items_manager.nb_param():
                bonus.append(('=', 0))

            return ProcessedFormBonus(identifier, bonus)

        for group in global_d:
            # Build form for parts
            for subgroups in group['subgroups']:
                for part in subgroups:
                    raw_bonus = part['raw_bonus'][0:2]
                    unified_identifier = part['male_identifier'] + "__" + part['female_identifier']
                    form_bonus = ProcessedFormBonus(unified_identifier, raw_bonus)
                    part['bonus'] = form_bonus.template(build_bonus_form)

            # Build form for set bonus
            if group['raw_bonus'][0] is None:
                group['bonus'] = ''
            else:
                group['bonus'] = {
                    2: [convert_to_bonus(group['raw_bonus'], 2).template(build_bonus_form)],
                    3: [convert_to_bonus(group['raw_bonus'], 3).template(build_bonus_form)],
                    4: [convert_to_bonus(group['raw_bonus'], 4).template(build_bonus_form)]
                }


    # Template bonus
    for group in global_d:
        if group['bonus'] != '':
            group['bonus'] = j2_env.get_template('template_armors_setbonus.htm').render(bonus=group['bonus'])

    return sorted(global_d, key=group_comparator)


def finish_processing_armors(j2_env, serialization, args_result, bonus_types, bonus_types_rate):
    # Existing sets
    existing_sets = read_existing_sets(bonus_types, bonus_types_rate)

    # Reading items
    grouped_items_by_sex = group_armor_by_sex(serialization)
    grouped_items_by_category, solo = group_armor_by_category(grouped_items_by_sex)

    # Matching groups with sets
    set_groups = match_group_and_sets(solo, grouped_items_by_category, existing_sets)

    build_bonus_form = None
    if args_result.edit:
        build_bonus_form = make_bonus_list(bonus_types, bonus_types_rate)

    normalized_armors = normalize_armors(j2_env, set_groups, build_bonus_form)

    print(args_result.edit)

    code = j2_env.get_template('template_armors.htm').render(groups=normalized_armors, bonus_types=bonus_types,
                                                             edit_mode=args_result.edit)
    f = open(items_manager.THIS_DIR + "armor_list.html", "w+")
    f.write(code)
    f.close()


# ======================================================================================================================
# ======================================================================================================================
# -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN  -- MAIN


def make_arg_parser():
    arg_parser = argparse.ArgumentParser(description="Creates a html page with every weapons or armors in the game")

    arg_parser.add_argument('-e', '--edit', action='store_true',
                            help='Generates several html page with edit options that generates '
                            'the content of a file that the modify_bonus.py script can use to alter the source files.')
    arg_parser.add_argument('-k', '--kind', choices=['weapons', 'armors'], default='weapons',
                            help='Defines the kind of items that will be displayed')
    arg_parser.add_argument('-min', '--min_level', type=int, help='Minimal level of displayed items')
    arg_parser.add_argument('-max', '--max_level', type=int, help='Maximal level of displayed items')
    arg_parser.add_argument('-j', '--job', action="append", help='Filter displayed items with given jobs. '
                                                                 'Several jobs can be specified by using several times '
                                                                 'this option.')

    return arg_parser


def main():
    arg_parser = make_arg_parser()
    args_result = arg_parser.parse_args()

    # Read propItem
    item_list = filter_level(items_manager.get_item_list(), args_result.min_level, args_result.max_level)
    item_list = filter_jobs(item_list, args_result.job)

    # Read categories
    item_kinds_3 = get_categorization_from_kind(args_result.kind)
    flatten_item_kinds_3 = make_list_from_categorization(item_kinds_3)

    # Filter items
    item_list = filter_item_with_ik3(item_list, flatten_item_kinds_3)

    # Replace item names
    items_manager.read_text_file(items_manager.path() + "propItem.txt.txt",
                                 lambda identifier, txt: replace_txt(item_list, identifier, txt))

    # Serialize bonus types
    bonus_types, bonus_types_rate = read_bonus_types()
    serialize_bonus_types(item_list, bonus_types, bonus_types_rate)

    # Icons
    compute_icons(item_list)

    # Legendary Emerald Volcano Terra Sun Zero Project
    if items_manager.adjustForLEVTSZF():
        items_manager.adjust_for_levtszf(item_list)

    # Categorization
    job_list = read_jobs()

    bonus_types_js = make_bonus_list(bonus_types, bonus_types_rate)
    j2_env = Environment(loader=FileSystemLoader(items_manager.THIS_DIR), trim_blocks=True)
    ProcessedFormBonus.load_template(j2_env)

    serialization_class = serialize_items(item_list, job_list, bonus_types_js, args_result.edit)

    if args_result.kind == 'weapons':
        finish_processing_weapon(j2_env, serialization_class, item_kinds_3, args_result)
    elif args_result.kind == 'armors':
        finish_processing_armors(j2_env, serialization_class, args_result, bonus_types, bonus_types_rate)


if __name__ == '__main__':
    main()
