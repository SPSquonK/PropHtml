# PropHtml

aka "I have no idea about how to call a group of python script that enables conversion between propItem.txt and cie files and html files"

## Generating html page with main.py

This script builds html page from your propItem.txt file and some other files.

Some example :
- http://sflyff.fr/items/
- http://sflyff.fr/items/armor_list.html

It also enables to build page suitable for editing bonus. (see modify_bonus to learn about how to use the textarea section)

- http://sflyff.fr/items/item_list_IK3_ZEMBARUNA.htm


### Usage

Read `python3 main.py -h`


**Basic usage**

| Command | Result |
| ------- | ------ |
| `python3 main.py` | Generates a list of every weapons |
| `python3 main.py -e` | Generates a list of every weapons with some combo box to edit the bonus |
| `python3 main.py -k armors` | Generates a list of every armors and sets |
| `python3 main.py -e` | Generates a list of every weapons with some combo box to edit the bonus |


`-k armors` makes the assumption that the id follows a certain logic (II_ARM_MorF_SOMETEXT_HELMETorSUITorGAUNTLETorBOOTS_SOMETEXT), and groups items using this. This logic overrides set item so you could get some strange results if your id usage is not following this logic.

TL;DR : It works well with officiel ids, if you followed a different logic, good luck. A future edition may or may not reverse the logic (group with itemset then try to group)

The script is also designed for the fused mythical set form Legendary Emerald ~~Volcano~~ Terra Sun Zero FlyFF (eg there are only 2 mythical sets : the one for male and the one for female, which groups every same gender mythical part). If you don't have this, it will still works, but if you modify the code, it is a good idea to keep this in mind.


### Warnings

- Jinja2 is used to generate the pages : `pip install Jinja2`
- You need to convert yourself the .dss images in a .png format and put them in the generated/Item/ folder.
- It uses the propItem.txt file and some other files (including some .c file) so your Source is expected to not be too much differently organized from a regular v15 source.
- It uses the configuration file found as "config.txt" to determine the project parameters.


## Altering files

Like the main script, theses files uses the `config.txt` to know the configuration. So read this file to know which options are available (modify in place or not for exampl)e

## delete_items_2.py

This script uses the file `items_to_remove.txt`.

This file format is
```
FIRST_WEAPON_ID_TO_DELETE
SECOND_WEAPON_ID_TO_DELETE
(...)
A_WEAPON_ID_TO_DELETE THE_WEAPON_THAT_WILL_RECEIVE_ITS_BONUS
```

A weapon can only receive bonus from one other weapon per pass. Order is not important. You can specify as many weapons as you like

It also works on armors, and modify propItemEtc.inc

This system should also work with other kinds of items.



### modify_bonus.py

- Reads changed_bonus.txt and apply its change to propItem
- Usage is pretty straight forward, generates a html page with `main.py -e`, copy the textarea block at the end of the page in the `changed_bonus.txt` file and then run `python3 modify_bonus.py`
- The results is a new propItem.txt file is this directory which is the same as the source, but with the new bonus applied.
- It makes easier to modify bonus without the hassle of remembering DST names and modifying weapons dissiminated in a file.




## Licence

The whole project is distributed under the MIT Licence.

jQuery is used and included, but conveniently, jQuery 3.3.1 is also licenced under the MIT Licence : https://jquery.org/license

If you are bothered with the MIT Licence, [you can find one version under the WTFPL licence except for the jQuery part](https://github.com/SPSquonK/FlyFFPythonTransform/tree/c6767443912141a399a50d82223a9bd6bb228fe1/propItemToHtml).
