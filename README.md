# propItem to HTML

"I should probably gives this folder its own repo, and replace the dictionnary abuse with class."

## Goal

### main.py

Generate a nice html file with the list of icons, id, weapon name, required job, required level and given bonus.

It uses the propItem.txt file and some other files (including some .c file) so your Source is expected to not be too much differently organized from a regular v15 source.

An example generated file can be seen here http://sflyff.fr/items/

You need to convert yourself the .dss images in a .png format and put them in the Item folder in the same folder as the generated html file.


It uses the configuration file found as "config.txt" to determine the project parameters.

It also uses args parameters. Just type `python3 main.py -h` to get a cool arg list as I just learned about argparse.


## delete_items_2.py

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

The new propItem will be written as a file named `newPropItem.txt``


## modify_bonus.py

Reads changed_bonus.txt and apply its change to propItem

changed_bonus.txt is the file you should create by :
- calling `python main.py JS`
- change the bonus of the weapons to whatever you like
- copy the content of the textarea at the bottom of the page in the changed_bonus.txt file

The results is a new propItem.txt file is this directory which is the same as the source, but with the new bonus applied.

It makes easier to modify bonus without the hassle of remembering DST names and modifying weapons dissiminated in a file.

## Usage

`python main.py /path/to/resource/folder NameOfYourPropItemFile NumberOfParameters(3 by default)`

Check the first lines of the py file to modify the base values.

By using JS as the first argument of `python main.py`, it will generate html files for every 

## Requirements

Jinja2 is used to generate the pages : `pip install Jinja2`

## Licence

This subproject includes JQuery 3.3.1 which is distributed under the MIT Licence. You can read its licence here : https://jquery.org/license

The project itself is also distributed under the MIT Licence.