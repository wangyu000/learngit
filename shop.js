/**
 *将浮点数num精确到最大maxFix位，若小数位本就不大于maxFix，则不变
 * @param num
 * @param maxFix
 * @returns {*}
 */
function fixNumWithMax(num,maxFix){
    var temp = String(num);
    if(temp.indexOf(".")>=0){
        var point = temp.split(".")[1];
        if(point.length>maxFix){
            num = num.toFixed(maxFix);
        }
    }
    return num;
}

