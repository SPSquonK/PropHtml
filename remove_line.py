import items_manager

'''
def make_existing_id():
    item_list = items_manager.get_item_list()

    return [item_id for item_id in item_list]


print(make_existing_id())

'''

def make_removed_id():
    removed_ids = []
    with open("list.txt") as f:
        for line in f.readlines():
            removed_ids.append(line.strip())
    return removed_ids

removed_ids = make_removed_id()

def keep_line(line):
    for removed_id in removed_ids:
        if line.find(removed_id) != -1:
            return False

    return True


def clean_file(file_name, encoding):
    content = []
    with open(file_name, encoding=encoding) as f:
        for line in f.readlines():
            orig_line = line
            line = line.replace(str(chr(10)), "").replace("\r", "").strip()

            if keep_line(line):
                content.append(orig_line)
            else:
                print(line)

    if True:
        f = open(file_name, "w+", encoding=encoding)
        f.write("".join(content))
        f.close()

clean_file("..\\FlyFF-VS17\\Resource\\itemTrans.txt", "iso-8859-1")
clean_file("..\\FlyFF-VS17\\Resource\\propDropEvent.inc", "cp949")
clean_file("..\\FlyFF-VS17\\Resource\\propMoverDrop.inc", "cp949")
