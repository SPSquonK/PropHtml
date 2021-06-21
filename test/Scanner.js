const assert = require("assert");

//const { sequential, list, identity } = require("../src/Scanner");

const { identity, pack } = require('../src/Scanner');



describe("NewScanner", function () {
  // TODO: Tokenizer

  describe('AbstractScanner', function () {

  });


  describe('identity', function () {
    it('should be able to parse', function () {
      const id = identity();

      assert.strictEqual(id.parse("toto"), "toto");
      assert.strictEqual(id.parse("titi"), "titi");
      assert.strictEqual(id.parse("  spacebefore"), "spacebefore");
      assert.strictEqual(id.parse("spaceafter   "), "spaceafter");
      assert.strictEqual(id.parse("  both   "), "both");
      assert.strictEqual(id.parse('  "some text"   '), '"some text"');
      assert.strictEqual(id.parse('  """some text"""   '), '"""some text"""');

      assert.throws(() => id.parse('   '));
      assert.throws(() => id.parse('one two'));
      assert.throws(() => id.parse('"one two" three'));
    });

    it('should be able to fix', function () {
      const id = identity();

      assert.strictEqual(id.fix("toto", "toto"), "toto");
      assert.strictEqual(id.fix("  toto    ", "toto"), "  toto    ");
      assert.strictEqual(id.fix("toto", "tutu"), "tutu");
      assert.strictEqual(id.fix("  both   ", "neither"), "  neither   ");

      assert.strictEqual(id.fix("a", "b"), "b");
      assert.throws(() => id.fix("a", ["b"]));
    });
  });


  describe('pack', function () {
    it('should be able to parse', function () {
      const pack2 = pack(2);

      assert.deepStrictEqual(pack2.parse("toto titi"), ["toto", "titi"]);
      assert.deepStrictEqual(pack2.parse(" abc     def"), ["abc", "def"]);
      assert.deepStrictEqual(pack2.parse('  "a ba" bbb'), ['"a ba"', "bbb"]);

      assert.throws(() => pack2.parse('a b c'));
      assert.throws(() => pack2.parse('a'));
      assert.throws(() => pack2.parse('"a b"'));

      const pack5 = pack(5);

      assert.deepStrictEqual(pack5.parse("1 2 3 4 5"), ["1", "2", "3", "4", "5"]);

      assert.throws(() => pack5.parse("1 2"));
    });
  
    it('should be able to fix', function () {
      const pack3 = pack(3);

      assert.strictEqual(pack3.fix("a b c", ["1", "2", "3"]), "1 2 3");
      assert.strictEqual(
        pack3.fix("\taaa\taaa\t\taaa\n", ["first", "second", '"third one"']),
        '\tfirst\tsecond\t\t"third one"\n'
      );

      assert.throws(() => pack3.fix("1 2 3", "toto"));
      assert.throws(() => pack3.fix("1 2 3", [1, 2, 3]));
      assert.throws(() => pack3.fix("1 2 3", ["a", "b"]));
      assert.throws(() => pack3.fix("1 2", ["a", "b", "c"]));
    });
  });


  
//  describe("Global tests", function () {
//    it("First", function () {
//      const content = "list = { a b c } /* yes */ no";
//
//      const structure = sequential("list", "=", list("{", identity(), "}"), "no");
//
//      const parsed = structure.parse(content);
//
//      assert.deepStrictEqual(parsed[2], ["a", "b", "c"]);
//
//      parsed[2][1] = "toto";
//      parsed[3] = "yes";
//
//      const fixed = structure.fix(content, parsed);
//
//      assert.strictEqual(fixed, "list = { a toto c } /* yes */ yes");
//    });
//  });

  
});
