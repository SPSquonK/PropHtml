const assert = require("assert");

const { identity, pack, sequential, list } = require('../src/Scanner');



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

    it('should parse with fixed strings', function () {
      const seq = sequential(identity(), "is", identity());

      assert.deepStrictEqual(seq.parse("toto is young"), ["toto", "is", "young"]);
      assert.throws(() => seq.parse("toto has money"));

      assert.deepStrictEqual(
        seq.fix("toto is young", ["tata", "is", "old"]),
        "tata is old"
      );

      assert.throws(
        () => seq.fix("toto is young", ["toto", "isnt", "young"])
      );
      
      assert.throws(
        () => seq.fix("toto isnt young", ["toto", "is", "young"])
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


  describe('List', function () {
    describe('parsing', function () {
      it('should be able to parse the whole string', function () {
        const simpleList = list(identity());
  
        assert.deepStrictEqual(simpleList.parse("a b c"), ["a", "b", "c"]);
        
        assert.deepStrictEqual(
          simpleList.parse("a b c d e f"),
          ["a", "b", "c", "d", "e", "f"]
        );
  
        const packedList = list(pack(2));
  
        assert.deepStrictEqual(
          packedList.parse("a b c d e f"),
          [["a", "b"], ["c", "d"], ["e", "f"]]
        );
  
        assert.throws(() => packedList.parse("a b c"));
  
        assert.deepStrictEqual(simpleList.parse(""), []);
        assert.deepStrictEqual(packedList.parse(""), []);
      });
  
      it('should be able to parse sections of a string', function () {
        const parser = sequential(
          list(pack(2), '{', '}'),
          list(identity(), '(', ')')
        );
  
        assert.deepStrictEqual(parser.parse("{ } ( )"), [[], []]);
  
        assert.deepStrictEqual(
          parser.parse("{ 1 2 3 4 } ( a b )"),
          [ [ ["1", "2"], ["3", "4"] ], [ "a", "b" ] ]
        );
      });
  
      it('should let user parse nested lists', function () {
        const parser = list(sequential(
          identity(), list(identity(), ">", "<")
        ));
  
        assert.deepStrictEqual(
          parser.parse("rabbits > cool awesome < cats > meow < squirrels > <"),
          [
            [ "rabbits"  , ["cool", "awesome"] ],
            [ "cats"     , ["meow"]],
            [ "squirrels", [] ]
          ]
        );
  
        const nesterParenthesis = list(list(identity(), "(", ")"), "(", ")");
  
        assert.deepStrictEqual(
          nesterParenthesis.parse(
            "( ( Asia Europe Africa America Oceania ) ( Blue Red Yellow ) "
            + " ( Anna Agathe Lillia Oceane Jessica ) )"
          ),
          [
            ["Asia", "Europe", "Africa", "America", "Oceania"],
            ["Blue", "Red", "Yellow"],
            ["Anna", "Agathe", "Lillia", "Oceane", "Jessica"]
          ]
        );
      });
  
      it('should let the user use weird delimiters', function () {
        assert.deepStrictEqual(
          list(identity(), "this_document_is_about").parse(
            "this_document_is_about love friendship poneys blondes"
          ),
          [ "love", "friendship", "poneys", "blondes" ]
        );
  
        assert.deepStrictEqual(
          sequential(
            list(identity(), null, "blondes"),
            list(pack(3), '"but I prefer"')
          ).parse('I know some blondes "but I prefer" white haired girls'),
          [
            ['I', 'know', 'some'],
            [ ['white', 'haired', 'girls'] ]
          ]
        );
      });
  
      it('should be unable to parse invalid lists', function () {
        assert.throws(() =>
          list(identity(), "Animals").parse("Cats Dogs Rabbits")
        );
  
        assert.throws(() =>
          list(identity(), "(", ")").parse("( I forgot something")
        );
  
        assert.throws(() =>
          list(list(identity(), "(", ")"), "(", ")")
            .parse("( me too ( but not me )")
        );

        assert.throws(() => list(identity(), "(").parse(""));
      });
    });

    describe('fixing', function () {
      it('should be able to fix the whole string', function () {
        const spaced = list(identity(), null, null, " x");

        assert.strictEqual(spaced.fix("", []), "");

        assert.strictEqual(list(identity(), null, null)
          .fix("ejobrez boezreoz bzeze", []),
          ""
        );
        
        assert.strictEqual(spaced.fix("", ["AA", "BB"]), " AA BB");
        assert.strictEqual(
          spaced.fix("\tAA\tBB CC", ["AA", "BB", "DD", "EE"]),
          "\tAA\tBB DD EE"
        );

        assert.strictEqual(
          list(pack(2), null, null, "\nX Y").fix("", [["a", "b"], ["c", "d"]]),
          "\na b\nc d"
        );

        // Whethever
        // "\tAA\t\BB\tCC"
        // should produce "\tAA\BB DD EE" or "\tAA\BB\tDD EE"
        // is currently undefined
        // ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
      });

      it('should fix when delimiters are involved', function () {
        assert.strictEqual(
          list(identity(), "(", ")", " x").fix("\n( a b c\t)", ["1", "2", "3"]),
          "\n( 1 2 3\t)"
        );

        assert.strictEqual(
          list(identity(), null, "STOP", " x").fix("x\t\tSTOP", []),
          "\t\tSTOP"
        );

        // Whetever fix("\tx\t\tSTOP", []) should produce
        // \t\t\tSTOP or \t\tSTOP is currently undefined
      });

      it('should detect bad patches', function () {
        assert.throws(
          () => list(identity(), null, null, " x").fix("a b c", "toto")
        );

        assert.throws(
          () => list(pack(2), null, null, " X Y").fix("a b", ["toto", "titi"])
        );

        assert.throws(
          () => list(pack(2), null, null, " X").fix("", [["toto", "titi"]])
        );
      });

      it('should detect unfixable lists', function () {
        const l123 = ["1", "2", "3"]

        assert.throws(
          () => list(identity(), "{", "}", " x").fix("( a b c }", l123)
        );

        assert.throws(
          () => list(identity(), "{", "}", " x").fix("{ a b c )", l123)
        );

        assert.throws(
          () => list(identity(), "{", "}", " x").fix("{ a b c", l123)
        );

        assert.throws(
          () => list(identity(), "(", ")", " x").fix("", [])
        );
      });

    });
  });


  
//  describe("Global tests", function () {
//    it("First", function () {
//      const content = "list = { a b c } /* yes */ no";
//
//      const structure = sequential("list", "=", list(identity(), "{", "}"), "no");
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
