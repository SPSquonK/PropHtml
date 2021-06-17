# Express Prop Items

Express Prop Items is a project that aims to expose the prop item files from
FlyFf in a webpage to make easier seeing and editing the items.

The project is based on [PropHtml](https://github.com/SPSquonK/PropHtml/tree/ca8792923f5a7bbe243a010ef0829095dcc5c4ae),
a project that did the same, but in Python. As I think that the programming
of PropHtml was hell and it was not maintained, I prefer to remake this project
in JavaScript.

The current goal is to support the same features as PropHtml.

## Getting started

### Configuration

Node.js and npm are required. If you haven't succumbed to the powers of the
light side, https://nodejs.org/en/ might help you.

- `npm install`
- Modify the .env to point to your resources.

Currently, only a clean V15 source is supported. SFlyFF and V21 sources
will be supported later.

### Usage

- `node index.js` will start the server.
- Go on `http://localhost:3000`

## Tools

### dstProp

If you want to use propHtml to expose to your users the list of items (even
thought it is not recommanded considering the current state of propHtml), you
do not want to depend on the source folder.

PropHtml is able to extract the TID bound to the dst and produce a json file
from it. You can then deploy propHtml with the generated json file and the other
resources it needs.

- Output the `dstProp.json` file in the console
`node tools.js dstProp --source "c:\path\to\_Interface\WndManager.cpp"`
- You can output it into a file by using either:
    - the `--output path/to/dstProp.json` option
    - or writing in a file the output of stdin with `> path/to/dstProp.json`
- Fix the .env file by
    - Commenting the `flyff_src` line
    - Uncommenting the propJsonPath line
    - Fixing the path

You can also write manually the `dstProp.json` file. Here is an example where
`DST_STR` will use the text bound to `TID_TOOLTIP_STR` as a flat value
(`STR +5` for example) and `DST_SPEED` will use the text bound to
`TID_TOOLTIP_SPEED` as a percentage (`Speed +7%` for example).

```json
{
  "dst": {
    "DST_STR":   { "tid": "TID_TOOLTIP_STR" },
    "DST_SPEED": { "tid": "TID_TOOLTIP_SPEED", "isRate": true }
  }
}
```

## Test

You can run the few existing unit tests by using mocha

- `npx mocha`

## License

Licensied under the MIT License by SquonK.
