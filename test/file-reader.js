const assert = require("assert");
const { Scanner } = require("../src/file-reader");

describe("Scanner", function () {
  describe("nextString", function () {
    it("should be a function", function () {
      const scanner = new Scanner("");
      assert.strictEqual(typeof scanner.nextString, "function");
    });

    it("should properly parse simple strings", function () {
      const scanner = new Scanner("squonk built express prop html");
      assert.strictEqual(scanner.nextString(), "squonk");
      assert.strictEqual(scanner.nextString(), "built");
      assert.strictEqual(scanner.nextString(), "express");
      assert.strictEqual(scanner.nextString(), "prop");
      assert.strictEqual(scanner.nextString(), "html");
      assert.strictEqual(scanner.nextString(), null);
    });

    it("should ignore C-style comments", function () {
      const scanner = new Scanner("squonk /* wrote this test */ ok");
      assert.strictEqual(scanner.nextString(), "squonk");
      assert.strictEqual(scanner.nextString(), "ok");
      assert.strictEqual(scanner.nextString(), null);
    });

    it("should ignore C++-style comments", function () {
      const scanner = new Scanner('77 + 8\n// = 85\nend');
      assert.strictEqual(scanner.nextString(), "77");
      assert.strictEqual(scanner.nextString(), "+");
      assert.strictEqual(scanner.nextString(), "8");
      assert.strictEqual(scanner.nextString(), "end");
      assert.strictEqual(scanner.nextString(), null);
    });
  
//    // TODO: pass this test
//    it("should ignore harder comments", function () {
//      const scanner = new Scanner("squonk/* wrote this test */\nhey//!\nok");
//      assert.strictEqual(scanner.nextString(), "squonk");
//      assert.strictEqual(scanner.nextString(), "hey");
//      assert.strictEqual(scanner.nextString(), "ok");
//      assert.strictEqual(scanner.nextString(), null);
//    })

    it("should be able to parse variables affectations", function () {
      const scanner1 = new Scanner("const x=7;");
      assert.strictEqual(scanner1.nextString(), "const");
      assert.strictEqual(scanner1.nextString(), "x");
      assert.strictEqual(scanner1.nextString(), "=");
      assert.strictEqual(scanner1.nextString(), "7");
      assert.strictEqual(scanner1.nextString(), ";");
      assert.strictEqual(scanner1.nextString(), null);

      const scanner2 = new Scanner("const y={1,2,3,{4,5},10};");
      assert.strictEqual(scanner2.nextString(), "const");
      assert.strictEqual(scanner2.nextString(), "y");
      assert.strictEqual(scanner2.nextString(), "=");
      assert.strictEqual(scanner2.nextString(), "{");
      assert.strictEqual(scanner2.nextString(), "1");
      assert.strictEqual(scanner2.nextString(), ",");
      assert.strictEqual(scanner2.nextString(), "2");
      assert.strictEqual(scanner2.nextString(), ",");
      assert.strictEqual(scanner2.nextString(), "3");
      assert.strictEqual(scanner2.nextString(), ",");
      assert.strictEqual(scanner2.nextString(), "{");
      assert.strictEqual(scanner2.nextString(), "4");
      assert.strictEqual(scanner2.nextString(), ",");
      assert.strictEqual(scanner2.nextString(), "5");
      assert.strictEqual(scanner2.nextString(), "}");
      assert.strictEqual(scanner2.nextString(), ",");
      assert.strictEqual(scanner2.nextString(), "10");
      assert.strictEqual(scanner2.nextString(), "}");
      assert.strictEqual(scanner2.nextString(), ";");
      assert.strictEqual(scanner2.nextString(), null);
    });
  });
});

