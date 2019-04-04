import items_manager



# 345


sets_to_build = []
mythical_items = []

mode = 0

with open("make_sets.txt", encoding="utf-8") as f:
    for line in f.readlines():
        line = line.replace(str(chr(10)), "").replace("\r", "").strip()

        if line == '-- Include to Mythical':
            mode = 1
        elif mode == 0:
            sets_to_build.append(line.split("\t"))
        elif mode == 1:
            mythical_items.append(line)


start_set_id = 345


sets_part = [
    ('HELMET', 'PARTS_CAP'),
    ('SUIT', 'PARTS_UPPER_BODY'),
    ('GAUNTLET', 'PARTS_HAND'),
    ('BOOTS', 'PARTS_FOOT')
]


def print_every_part(prefix, item_name):
    l = []
    dollar = item_name.find("$")

    for part in sets_part:
        item_id = prefix + item_name[len(prefix):dollar] + part[0] + item_name[dollar + 1:]
        l.append("\t\t" + item_id + "\t" + part[1])

    return l


def make_set_item(set_to_build, i):
    for prefix in ['II_ARM_M_', 'II_ARM_F']:
        print("SetItem\t{0}\tIDS_PROPITEMETC_INC_SET{1:03d}".format(start_set_id + i, i))
        print("{")
        print("\tElem")
        print("\t{")

        print("\n".join(print_every_part(prefix, set_to_build[0])))

        print("\t}")
        print("\tAvail")
        print("\t{")
        print("\t}")
        print("}")
        print()
        i = i + 1



i = 1
for set_to_build in sets_to_build:
    make_set_item(set_to_build, i)
    i = i + 2


print("================")


def make_set_txt(set_to_build, i):
    print("IDS_PROPITEMETC_INC_SET{0:03d}\t{1}".format(i, set_to_build[1]))
    print("IDS_PROPITEMETC_INC_SET{0:03d}\t{1}".format(i + 1, set_to_build[2]))


i = 0
for set_to_build in sets_to_build:
    make_set_txt(set_to_build, i)
    i = i + 2



print("================")


def make_mythic(item, lmale, lfemale):
    lmale.extend(print_every_part('II_ARM_M_', item))
    lfemale.extend(print_every_part('II_ARM_F_', item))


lmale = []
lfemale = []

for mythic_item in mythical_items:
    make_mythic(mythic_item, lmale, lfemale)


print("\n".join(lmale))
print("\n".join(lfemale))