const assert = require("assert");
const { Scanner } = require("../src/file-reader");
const { pack, identity, list, either } = require('../src/declarative-scanner');

describe('Declarative Scanner', function () {
  describe('identity', function () {
    // Am I seriously testing the identity function?
    it('should be able to produce the identity function', function () {
      const scanner = new Scanner('gg wp it works');
      assert.strictEqual(typeof identity, "function");
      assert.strictEqual(typeof identity(), "function");
      assert.strictEqual(identity()(scanner), "gg");

      const id = identity();
      assert.strictEqual(id(scanner), "wp");
      assert.strictEqual(scanner.nextString(), "it");
      assert.strictEqual(id(scanner), "works");
    })
  });

  describe('pack', function () {
    it('should be a function that builds a function', function () {
      assert.strictEqual(typeof pack, "function");
      assert.strictEqual(typeof pack(5), "function");
      assert.strictEqual(typeof pack(777), "function");
    });

    it('should consume the next x elements', function () {
      const scanner = new Scanner("first second third fourth");

      assert.deepStrictEqual(pack(1)(scanner), [ "first" ]);
      assert.strictEqual(scanner.nextString(), "second");
      assert.deepStrictEqual(pack(2)(scanner), [ "third", "fourth" ]);
    });

    it('should be a reusable component', function () {
      const scanner = new Scanner("1 2 3 4 5 6 7 8");

      const pack2 = pack(2);
      const pack4 = pack(4);

      assert.deepStrictEqual(pack2(scanner), [ "1", "2" ]);
      assert.deepStrictEqual(pack4(scanner), [ "3", "4", "5", "6" ]);
      assert.deepStrictEqual(pack2(scanner), [ "7", "8" ]);
    });

    it('should throw if not enough elements can be read', function () {
      const scanner = new Scanner("1 2 3 not enough");
      assert.deepStrictEqual(pack(3)(scanner), [ "1" , "2", "3" ]);
      assert.throws(() => pack(3)(scanner));
    });
  });

  describe('list', function () {
    it('should be a function that builds a function', function () {
      assert.strictEqual(typeof list, "function");
      assert.strictEqual(typeof list(null, identity(), null), "function");
      assert.strictEqual(typeof list('{', pack(2), '}'), "function");
    });

    it('should produce a list of tokens when used with identity', function () {
      assert.deepStrictEqual(
        list(null, identity(), null)(new Scanner("1 2 3 soleil")),
        ["1", "2", "3", "soleil"]
      );

      const scanner = new Scanner("{ A1 A2 A3 } ok { B1 B2 }");
      const l = list("{", identity(), "}");

      assert.deepStrictEqual(l(scanner), ["A1", "A2", "A3"]);
      assert.strictEqual(identity()(scanner), "ok");
      assert.deepStrictEqual(l(scanner), ["B1", "B2"]);
    });
  })

  describe('either', function () {
    it('should be a function that builds a function', function () {
      assert.strictEqual(typeof either, "function");
      assert.strictEqual(typeof either({}), "function");
    });

    it('should properly read the next value', function () {
      const scanner = new Scanner("CAT maou DOG white Snowy CAT felix");

      const e = either({
        'DOG': pack(2),
        'CAT': identity()
      });

      assert.deepStrictEqual(e(scanner), ['CAT', 'maou']);
      assert.deepStrictEqual(e(scanner), ['DOG', ['white', 'Snowy']]);
      assert.deepStrictEqual(e(scanner), ['CAT', 'felix']);
    });
  });

});

