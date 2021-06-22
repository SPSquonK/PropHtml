const assert = require("assert");

//const { sequential, list, identity } = require("../src/Scanner");

const { identity, pack, sequential } = require('../src/Scanner');



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
      assert.throws(() => id.fix("a b", "c"));
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

  describe('Sequential', function () {
    it('should be a noop with only one identity', function () {
      const seq1 = sequential(identity());
      assert.deepStrictEqual(seq1.parse('  toto  '), ['toto']);

      const seq2 = sequential([identity()]);
      assert.deepStrictEqual(seq2.parse('  "titi 22"    '), ['"titi 22"']);
    });

    it('should be a noop with pack', function () {
      const seq2 = sequential(pack(2));
      assert.deepStrictEqual(seq2.parse('  abc def ')[0], ['abc', 'def']);

      const seq5 = sequential([pack(5)]);
      assert.deepStrictEqual(
        seq5.parse(' p1   p2 "p3" p4 \tp5')[0],
        ['p1', 'p2', '"p3"', 'p4', 'p5']
      );
    });

    it('should let the user use several instructions', function () {
      // TODO: is this kind of composition a desirable feature?
      const seq = sequential(pack(2), [identity(), pack(3)], identity());
      assert.deepStrictEqual(
        seq.parse(
          "\t\tPACK1_1 PACK1_2 IDENTITY1 PACK3_1\nPACK3_2 PACK3_3 IDENTITY2"
        ),
        [
          [ 'PACK1_1', 'PACK1_2' ],
          'IDENTITY1',
          [ 'PACK3_1', 'PACK3_2', 'PACK3_3' ],
          'IDENTITY2'
        ]
      );
    });

    it('should detect invalid number of elements', function () {
      const seq = sequential(pack(3), identity());
      assert.throws(() => seq.parse('   ok  ok  boom '));
      assert.throws(() => seq.parse('   ok  ok  ok   ok boom '));
    });

    it('should be able to fix valid combinaison', function () {
      const seq3 = sequential(identity(), identity(), identity());

      assert.strictEqual(
        seq3.fix("   aaa\n\nbbb\tccc ", ["ccc", "BBB", "aaa"]),
        "   ccc\n\nBBB\taaa "
      );
    });
    
    it('should be unable to fix unfixable things', function () {
      const seq = sequential(identity(), identity());

      // Bad string
      assert.throws(() => seq.fix("toto", ["a", "b"]));
      assert.throws(() => seq.fix(" toto tutu tata", ["a", "b"]));

      // Bad fix
      assert.throws(() => seq.fix("a b", "X"));
      assert.throws(() => seq.fix("a b", ["X"]));
      assert.throws(() => seq.fix("a b", [["X", "Y"]]));
      assert.throws(() => seq.fix("a b", ["X", ["Y", "Z"]]));
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
