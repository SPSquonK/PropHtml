# PropHtml

aka "I have no idea about how to call a group of python script that enables conversion between propItem.txt and cie files and html files"

## Goal

### main.py

This script builds html page from your propItem.txt file and some other files.

Some example :
- http://sflyff.fr/items/
- http://sflyff.fr/items/armor_list.html

It also enables to build page suitable for editing bonus. (see modify_bonus to learn about how to use the textarea section)

- http://sflyff.fr/items/item_list_IK3_ZEMBARUNA.htm


#### Usage

`python3 main.py -h`

#### Warnings

- Jinja2 is used to generate the pages : `pip install Jinja2`

- You need to convert yourself the .dss images in a .png format and put them in the generated/Item/ folder.

- It uses the propItem.txt file and some other files (including some .c file) so your Source is expected to not be too much differently organized from a regular v15 source.

- It uses the configuration file found as "config.txt" to determine the project parameters.


## The place where readme content that needs to be rewriten go

### delete_items_2.py

Reads `items_to_remove.txt`

This file format is
```
FIRST_WEAPON_ID_TO_DELETE
SECOND_WEAPON_ID_TO_DELETE
(...)
A_WEAPON_ID_TO_DELETE THE_WEAPON_THAT_WILL_RECEIVE_ITS_BONUS
```

A weapon can only receive bonus from one other weapon per pass. Order is not important. You can specify as many weapons as you like

This system should also work with other items



### modify_bonus.py

Reads changed_bonus.txt and apply its change to propItem

changed_bonus.txt is the file you should create by :
- calling `python main.py JS`
- change the bonus of the weapons to whatever you like
- copy the content of the textarea at the bottom of the page in the changed_bonus.txt file

The results is a new propItem.txt file is this directory which is the same as the source, but with the new bonus applied.

It makes easier to modify bonus without the hassle of remembering DST names and modifying weapons dissiminated in a file.

### Usage

`python main.py /path/to/resource/folder NameOfYourPropItemFile NumberOfParameters(3 by default)`

Check the first lines of the py file to modify the base values.

By using JS as the first argument of `python main.py`, it will generate html files for every 



## Licence

The whole project is distributed under the MIT Licence.

jQuery is used and included, but conveniently, jQuery 3.3.1 is also licenced under the MIT Licence : https://jquery.org/license

If you are bothered with the MIT Licence, [you can find one version under the WTFPL licence except for the jQuery part](https://github.com/SPSquonK/FlyFFPythonTransform/tree/c6767443912141a399a50d82223a9bd6bb228fe1/propItemToHtml).
