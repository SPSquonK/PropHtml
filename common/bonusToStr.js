
class BonusToStr {
    static bonusToString([dst, value], dstProp, tidToText) {
        let result;

        const ids = dstProp[dst];
        if (ids === undefined) {
            result = dst;
        } else {
            result = tidToText[ids.tid];
            if (result === undefined) {
                result = ids.tid;
            }
        }

        result += " ";
        if (value >= 0) result += "+";
        if (dst == "DST_ATTACKSPEED") {
            result += (value / 20);
        } else {
            result += value;
        }

        if (dstProp[dst].isRate) {
            result += "%";
        }

        return result;
    }
}

module.exports = BonusToStr;
