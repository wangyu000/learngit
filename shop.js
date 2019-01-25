var GoodsOrder = function(data){
    var self = this;
    self.goods = new Goods({});
    if(data.id)
        self.goods = data;
    self.num = ko.observable(0);
    self.gongJiTotal = ko.computed(function(){
        return fixNumWithMax(self.num()*self.goods.realGongJi(),4);
    });
    //是否有足够功绩
    self.hasEnoughGongJi = ko.computed(function(){
        if(self.goods){
            if(GoodsSourceEnum.SOURCE_JD.toString == self.goods.source()){
                //return orderViewModel.myJdGongJi() >= self.gongJiTotal();
                return orderViewModel.myGongJi() >= self.gongJiTotal();
            }else if(GoodsSourceEnum.SOURCE_HF.toString == self.goods.source()){
                //return hfOrderViewModel.myHfGongJi()+hfOrderViewModel.myJdGongJi() >= self.gongJiTotal();
                return hfOrderViewModel.myGongJi() >= self.gongJiTotal();
            }
        }
        return false
    });
    self.hasEnoughStorage = ko.computed(function(){
        return self.goods.remainingNum()>0
    });
    self.addNum = function(){
        if(self.goods.source() == GoodsSourceEnum.SOURCE_HF.toString){
            if(self.goods.hfGoodsCat() == HfGoodsCatEnum.TRAINING_COURSE.toString && self.num()==1){
                layer.msg("单次限兑换一件！");
                return;
            }
        }
        if(self.hasEnoughStorage()){
            self.num(self.num()+1);
            self.goods.remainingNum(self.goods.remainingNum()-1);
        }else{
            layer.msg("库存不足");
        }
    };
    self.minusNum = function(){
        if(self.num()>1){
            self.num(self.num()-1);
            self.goods.remainingNum(self.goods.remainingNum()+1);
        }
    };
    self.clearNum = function(){
        if(self.num()>0){
            self.goods.remainingNum(self.goods.remainingNum()+self.num());
            self.num(0);
        }
    };

    self.addNum();
};
var OrderViewModel = function(){
    var self = this;
    self.timestamp=0;
    self.visible=ko.observable(false);
    self.myGongJi=ko.observable(0);
    self.myJdGongJi=ko.observable(0);
    self.myHfGongJi=ko.observable(0);
    self.goodsOrder=ko.observable({});
    self.province=0;
    self.city=0;
    self.county=0;
    self.town=0;
    self.address=ko.observable('');
    self.zipcode=ko.observable('');
    self.consignee=ko.observable('');
    self.mobile=ko.observable('');

    self.setOrderAddr=function (addrData) {
        self.province=addrData.province?addrData.province:0;
        self.city=addrData.city?addrData.city:0;
        self.county=addrData.county?addrData.county:0;
        self.town=addrData.town?addrData.town:0;
        self.address(addrData.address());
        self.consignee(addrData.consignee());
        self.mobile(addrData.mobile());
        $("#cbProvince").val(''+orderViewModel.province);
        $("#cbProvince").trigger("change",[''+orderViewModel.city,''+orderViewModel.county,''+orderViewModel.town]);
    }

    self.loadIdx = 0;
    self.submitOrder=function(){
        if(!self.goodsOrder().hasEnoughGongJi()){
            layer.msg("您的可用功绩不够支付本订单");
            return;
        }
        var orderDto = {
            timestamp:orderViewModel.timestamp,
            consignee:orderViewModel.consignee(),
            mobile:orderViewModel.mobile(),
            province:$("#cbProvince").val()?$("#cbProvince").val():0,
            city:$("#cbCity").val()?$("#cbCity").val():0,
            county:$("#cbDistrict").val()?$("#cbDistrict").val():0,
            town:$("#cbTown").val()?$("#cbTown").val():0,
            address:orderViewModel.address(),
            zip:orderViewModel.zipcode(),
            goodsInfos:[{
                goodsId:self.goodsOrder().goods.id,
                shopNum:self.goodsOrder().num()
            }]
        };
        console.info("=========下单前地址==========");
        console.info(orderDto);
        var errList = checkAddr(orderDto);
        if(errList.length>0){
            layer.msg(errList[0]);
            return;
        }
        var orderJson = JSON.stringify(orderDto);
        self.loadIdx = layer.load();
        $.ajax({
            url:ctx+'/youxi/mall/submitOrder.action',
            data:"gameOrderDtlDtoJson="+orderJson,
            dataType:'json',
            type:'post',
            success:function(res){
                var result = JSON.parse(res);
                if (result.code == 10000) {
                    showShoppingSuccessPage({content2:result.message.trim()});
                    refreshMyGongJi();
                } else {
                    if (result.message.trim()) {
                        layer.alert(result.message.trim());
                    } else {
                        layer.alert("提交订单失败，请稍后再试");
                    }
                }
            },
            error:function(res){
                layer.alert("提交订单失败了，请稍后再试");
            },
            complete:function(res){
                layer.close(self.loadIdx);
            }
        });
    };
    self.close=function(){
        orderViewModel.visible(false);
        self.goodsOrder().clearNum();
    }
};

function refreshMyGongJi(){
    $.get((ctx +'/youxi/mall/mySomeGongJi.action'),function(res){
        console.info("==refreshMyGongJi");
        console.info(res);

        var myGongji = parseFloat(null==res.gongJi?0:res.gongJi);
        var myJdGongji = parseFloat(null==res.jdGongJi?0:res.jdGongJi);
        var myHfGongji = parseFloat(null==res.hfGongJi?0:res.hfGongJi);
        orderViewModel.myGongJi(myGongji);
        hfOrderViewModel.myGongJi(myGongji);
        orderViewModel.myJdGongJi(myJdGongji);
        orderViewModel.myHfGongJi(myHfGongji);
        hfOrderViewModel.myJdGongJi(myJdGongji);
        hfOrderViewModel.myHfGongJi(myHfGongji);
    });

}

//合富商品订单模型
var HfOrderViewModel = function(){
    var self = this;
    self.timestamp = ko.observable(0);
    self.visible=ko.observable(false);
    self.myGongJi=ko.observable(0);
    self.myJdGongJi=ko.observable(0);
    self.myHfGongJi=ko.observable(0);
    self.goodsOrder=ko.observable({});
    self.orderMoney = ko.observable(0);
    self.cashGongJi = ko.observable(0); //现金支付的部分功绩(部分商品功绩不足时可用工资抵扣不足的部分)
    self.cashMoney = ko.observable(0); //现金支付金额(部分商品功绩不足时可用工资抵扣不足的部分)

    self.userId = ko.observable(0);
    self.userName = ko.observable("");
    self.enrollNumber = ko.observable("");
    self.userNameShow = ko.observable("");

    self.cityId = ko.observable(0);
    self.cityName = ko.observable("");

    //安币相关属性
    self.netPackageList = ko.observableArray([]);
    self.selNetPackageId = ko.observable();

    self.netAccount = ko.observable("");
    self.netPwd = ko.observable("");
    self.netMobile = ko.observable("");
    self.selNetMonth = ko.observable("");

    self.hasDiscount = ko.observable(false);

    self.submitParams = ko.observable({}); //提交给后台的参数
    self.initSubmitParams = function () {
        var hfGoodsCat = theHfGoodsCat();
        var params = {
            timestamp:self.timestamp(),
            goodsInfos:[{
                goodsId:self.goodsOrder().goods.id,
                shopNum:self.goodsOrder().num()
            }],
            hfGoodsCat:hfGoodsCat,
            cashGongJi:self.cashGongJi(),
            cashMoney:self.cashMoney()
        };

        switch(hfGoodsCat){
            case  HfGoodsCatEnum.NETWORK_CONSUMPTION.toString:
                break;
            case HfGoodsCatEnum.ANJUKE_MONEY.toString:
                params.netPackageId = self.selNetPackageId()?self.selNetPackageId():0;
                params.netAccount = self.netAccount();
                params.netPwd = self.netPwd();
                params.netMobile = self.netMobile();
                params.selNetMonth = self.selNetMonth();
                break;
            default:
                break;
        };
        self.submitParams(params);
    };
    /**
     * 提交订单
     * @param hasSubmitParams boolean true表示提交参数已初始化，无需再次初始化; 不传或传false表示需要初始化提交参数
     */
    self.submitOrder = function () {
        console.info("---submitHfOrder---");
        self.initSubmitParams();
        var valiRes = validateHfOrderParams(self.submitParams());
        if(!valiRes.result){
            layer.msg(valiRes.msg);
            return;
        }
        var orderJson = JSON.stringify(self.submitParams());
        self.loadIdx = layer.load();
        $.ajax({
            url:ctx+'/youxi/mall/submitOrder.action',
            data:"gameOrderDtlDtoJson="+orderJson,
            dataType:'json',
            type:'post',
            success:function(res){
                var result = JSON.parse(res);
                if (result.code == 10000) {
                    showShoppingSuccessPage(getHfShoppingSuccessOptions(result));
                } else {
                    if (result.message.trim()) {
                        layer.alert(result.message.trim());
                    } else {
                        layer.alert("提交订单失败，请稍后再试");
                    }
                }
            },
            error:function(res){
                layer.alert("提交订单失败，请稍后再试");
            },
            complete:function(res){
                layer.close(self.loadIdx);
            }
        });
    };

    self.close=function(){
        self.visible(false); //关闭购买弹窗
        self.goodsOrder().clearNum();
        self.orderMoney(self.goodsOrder().num()*self.goodsOrder().goods.agreementPrice());
        showPageByGoods(false);
    };

    function theHfGoodsCat(){
        return self.goodsOrder()?self.goodsOrder().goods.hfGoodsCat():""
    }

    //刷新下单需要用到的相关数据
    self.refreshHfOrderInfo = function () {
        /*layer.alert("合富商品暂时不能购买");
        return;*/
        $.ajax({
            url:ctx+'/youxi/mall/getHfOrderInfoByGoodsCat.action',
            data:{hfGoodsCat:theHfGoodsCat()},
            dataType:'json',
            type:'post',
            success:function(res){
                var resJson = JSON.parse(res);
                console.info(resJson);
                if(resJson.success){
                    var infoData = resJson.data;
                    self.visible(true);
                    showPageByGoods(true);
                    self.hasDiscount(self.goodsOrder().goods.discountGongJi()>0);//是否有折扣价
                    self.orderMoney(self.goodsOrder().num()*self.goodsOrder().goods.agreementPrice());//商品金额
                    //赋值获取到的基本信息
                    self.userId(infoData.userId?infoData.userId:0);
                    self.userName(infoData.userName);
                    self.enrollNumber(infoData.enrollNumber);
                    self.userNameShow(self.userName() + "(" + self.enrollNumber() + ")");
                    self.cityId(infoData.cityId?infoData.cityId:0);
                    self.cityName(infoData.cityName);

                    var packageList = new Array();
                    if(infoData.netPackageList && infoData.netPackageList.length>0){
                        $.each(infoData.netPackageList,function (i,item) {
                            packageList.push({packageId:item.packageId,packageName:item.packageName+'('+self.cityName()/*+'-' + self.goodsOrder().goods.agreementPrice()*/ +')'})
                        })
                    }
                    self.netPackageList(packageList);
                    self.selNetMonth(infoData.selNetMonth);
                }else{
                    self.close();
                    layer.alert(resJson.msg);
                }
            },
            error:function(res){
                self.close();
                layer.alert("获取合富订单基本信息失败，请检查网络或登录状态!");
            }
        });
    };

    self.addNum = function(){
        self.goodsOrder().addNum();
        self.orderMoney(self.goodsOrder().num()*self.goodsOrder().goods.agreementPrice());
    }
    self.minusNum = function(){
        self.goodsOrder().minusNum();
        self.orderMoney(self.goodsOrder().num()*self.goodsOrder().goods.agreementPrice());
    }

    self.refreshCashMoney = function () {
        if(self.goodsOrder().hasEnoughGongJi()){
            self.cashGongJi(0);
            self.cashMoney(0);
        }else{
            self.cashGongJi(fixNumWithMax((hfOrderViewModel.myGongJi()<=0 ? self.goodsOrder().gongJiTotal() : (self.goodsOrder().gongJiTotal() - hfOrderViewModel.myGongJi())), 4));
            self.cashMoney(fixNumWithMax(self.cashGongJi()/30, 3));
        }
    }
}

/**提交合富订单前的询问
 * 询问后确认继续下单的话，回调函数规则：
 *  1、功绩充足，直接调用提交订单；
 *  2、功绩不足，若商品类别为培训课程，询问是否不足部分用工资抵扣,同意则继续提交，不同意则不再继续
 */
function confirmBeforeSubmitHfOrder(){
    //初始化订单提交参数并验证
    hfOrderViewModel.initSubmitParams();
    var valiRes = validateHfOrderParams(hfOrderViewModel.submitParams());
    if(!valiRes.result){
        layer.msg(valiRes.msg);
        return;
    }

    var goods = hfOrderViewModel.goodsOrder().goods;
    var options = {
        content:'<p>自营商品一经购买，概不予退换，<br/>您确定购买吗？</p>',
        btnList:[{
            btnClass:"icon60",
            btnClickFunc:function () {
                if(!hfOrderViewModel.goodsOrder().hasEnoughGongJi()){
                    layer.alert("您的可用功绩不足");
                    return;
                }
                hfOrderViewModel.submitOrder();
                closePopupBeforeBuy();
            }
        }]
    };
    switch (goods.hfGoodsCat()) {
        case HfGoodsCatEnum.TRAINING_COURSE.toString:
            var content = '<p>您将花费<b>'+goods.realGongJi()+'功绩</b>购买<b>'+goods.goodsName+'</b>，自营商品一经购买概不予退换，<br/>确定购买吗？</p>';
            options.content = content;
            //功绩不足
            if(!hfOrderViewModel.goodsOrder().hasEnoughGongJi()){
                hfOrderViewModel.refreshCashMoney();
                options.btnList = [{
                    btnClass:"icon60",
                    btnClickFunc:function () {
                        showPopupBeforeBuy({
                            content:'<p>您的功绩不足购买此课程，其中'+hfOrderViewModel.cashGongJi()+'功绩将在当月工资中扣除'+hfOrderViewModel.cashMoney()+'元，是否确认购买？</p>',
                            btnList:[{
                                btnClass:"icon60",
                                btnClickFunc:function () {
                                    hfOrderViewModel.submitOrder(true);
                                    closePopupBeforeBuy();
                                }
                            }]
                        })
                    }
                }]
            }
            break;
        case HfGoodsCatEnum.CASH_COUPON.toString:
            var content = '<p>您将花费<b>'+goods.realGongJi()*hfOrderViewModel.goodsOrder().num() +'功绩</b>购买'+
                hfOrderViewModel.goodsOrder().num() + '张<b>' +
                goods.agreementPrice() +'元现金券</b>，自营商品一经购买，不可退换，兑换成功即计入至当月工资账户中，随当月工资一并发放，<br/>是否确认购买？</p>';
            options.content = content;
            break;
        case HfGoodsCatEnum.COMMON_GOODS.toString:
            var content = '<p>您将花费<b>'+goods.realGongJi()*hfOrderViewModel.goodsOrder().num() +'功绩</b>购买<b>' +
                hfOrderViewModel.goodsOrder().goods.goodsName +'</b>，自营商品一经购买，不可退换，<br/>是否确认购买？</p>';
            options.content = content;
            break;
        default:
            break;
    }
    showPopupBeforeBuy(options);
}
//验证合富订单提交信息
function validateHfOrderParams(params){
    if(!validateNullVal(params.hfGoodsCat)){
        return {result:false,msg:"无商品类别"};
    }
    switch (params.hfGoodsCat){
        case "NETWORK_CONSUMPTION":
            break;
        case "ANJUKE_MONEY":
            if(!validateNullVal(params.netPackageId)){
                return {result:false,msg:"未知安币套餐"};
            }
            if(!validateNullVal(params.selNetMonth)){
                return {result:false,msg:"无效的选网月份"};
            }
            if(!validateNullVal(params.netAccount)){
                return {result:false,msg:"请填写外网账户"};
            }
            if(!validateNullVal(params.netPwd)){
                return {result:false,msg:"请填写外网密码"};
            }
            if(!validateNullVal(params.netMobile)){
                return {result:false,msg:"请填写外网手机"};
            }
            if(!validateMobile(params.netMobile)){
                return {result:false,msg:"请填写正确的手机号码"};
            }
            break;
        default:
            if(!checkHfGoodsCat(params.hfGoodsCat)){
                return {result:false,msg:"未知商品类别"+params.hfGoodsCat};
                return;
            }

            break;
    }

    return {result:true,msg:"验证通过"};
}


//购买前提醒 ，参数说明参考方法showShoppingSuccessPage，不同之处在于initOptions.btnList的默认按钮不会被覆盖
function showPopupBeforeBuy(options){
    var initOptions = {
        content:"<p>自营商品一经购买概不予退换，确定购买吗？</p>",
        btnList:[
            {
                btnClass:"icon163",
                btnClickFunc:function () {
                    closePopupBeforeBuy();
                }
            }
        ]
    };
    if(options){
        if(options.content){
            initOptions.content = options.content;
        }
        if(options.btnList){
            $.each(options.btnList, function (i, item) {
                initOptions.btnList.push(item);
            })
        }
    }
    var contentText = initOptions.content;
    $("#divPopupBeforeBuy div.successcont").html(contentText);
    $("#divPopupBeforeBuy div.callbtn").html("");
    if(initOptions.btnList.length>0){
        $.each(initOptions.btnList, function (i, item) {
            var newA = $('<a class="' + item.btnClass + '"></a>');
            newA.click(function(){item.btnClickFunc()});
            $("#divPopupBeforeBuy div.callbtn").append(newA);
        })
    }
    $("#noticeBeforeBuyPopup").show();
}
function closePopupBeforeBuy() {
    $('#noticeBeforeBuyPopup').hide();
}

/**
 * 购买成功后弹窗
 * @param options 参数集，其中的参数值会覆盖初始参数集initOptions中对应的值
 *          |-content 显示文本前半部分
 *          |-content2 显示文本后半部分
 *          |-btnList 按钮列表，会覆盖initOptions.btnList
 *              |-btnClass 对应youxi.css中的按钮样式名
 *              |-btnClickFunc 按钮对应的click事件方法
 */
function showShoppingSuccessPage(options){
    var initOptions = {
        content:"<h5>购买成功！</h5><p>物流信息前往购买记录查看</p>",
        content2:"", //拼接在content后面的内容
        btnList:[
            {
                btnClass:"icon82",
                btnClickFunc:function () {
                    showOrderList();
                    closeShoppingSuccessPage();
                }
            }
        ]
    };
    if(options){
        $.extend(initOptions,options);
    }
    var contentText = initOptions.content;
    if(initOptions.content2){
        contentText += ("<br/><p>" + initOptions.content2 + "</p>");
    }
    $("#shopSuccessDiv div.shopbuytext").html(contentText);
    $("#shopSuccessDiv div.shopbuybtn").html("");
    if(initOptions.btnList.length>0){
        $.each(initOptions.btnList, function (i, item) {
            var newA = $('<a class="' + item.btnClass + '"></a>');
            newA.click(function(){item.btnClickFunc()});
            $("#shopSuccessDiv div.shopbuybtn").append(newA);
        })
    }
    $("#shoppingSuccess").show();
}

function closeShoppingSuccessPage(){
    $('#shoppingSuccess').hide();
    hfOrderViewModel.close();
    orderViewModel.visible(false);
    hfOrderViewModel.visible(false);
}

/**
 * 根据hfOrderViewModel获取对应订单成功后的弹出参数（弹出文本与相关按钮及事件）
 * @param result 下单后，后端返回的数据JSON
 * @returns options 格式参考方法showShoppingSuccessPage
 */
function getHfShoppingSuccessOptions(result){
    var options = {
        content2:result.message ? result.message.trim() : null,
        btnList:[
            {
                btnClass:"icon82",
                btnClickFunc:function () {
                    showOrderList();
                    closeShoppingSuccessPage();
                }
            }
        ]
    };
    var goodsCat = hfOrderViewModel.goodsOrder().goods.hfGoodsCat();
    //培训课程
    if(goodsCat == HfGoodsCatEnum.TRAINING_COURSE.toString){
        options.content2 = null;
        options.btnList.splice(0,options.btnList.length);
        //我知道了按钮
        options.btnList.push(
            {
                btnClass:"icon142",
                btnClickFunc:function () {
                    closeShoppingSuccessPage();
                }
            });
        if(hfOrderViewModel.goodsOrder().goods.courseTypeTrain()== CourseTypeTrain.DOWN.toString){
            options.content = "<p>您已成功购买<b><u style='font-size: 20px;'>"+hfOrderViewModel.goodsOrder().goods.goodsName+"</u></b>（阅读期限：购买成功后<b><u style='font-size: 20px;'>"+hfOrderViewModel.goodsOrder().goods.courseValidDays()+"</u>天</b>），详细课程信息请留意内网通告~学以致用，收获丰厚~”</p>";
        }else{
            options.content = "<p>您已成功购买<b><u style='font-size: 20px;'>"+hfOrderViewModel.goodsOrder().goods.goodsName+"</u></b>（阅读期限：购买成功后<b><u style='font-size: 20px;'>"+hfOrderViewModel.goodsOrder().goods.courseValidDays()+"</u>天</b>），可前往“在线学习与考试”查看课程内容哟~学以致用，业绩长虹~</p>";
            //前往查看按钮
            var jumpUrl = getGoodsJumpUrl(HfGoodsCatEnum.TRAINING_COURSE.toString, hfOrderViewModel.goodsOrder().goods.refId());
            if(jumpUrl){
                options.btnList.push(
                    {
                        btnClass:"icon118",
                        btnClickFunc:function () {
                            window.open(jumpUrl);
                        }
                    });
            }
        }
    }else if(goodsCat == HfGoodsCatEnum.COMMON_GOODS.toString){
        options.content = "<h5>购买成功！</h5><p>兑换码将以短信方式通知您，请注意查收</p>";
        options.content2 = null;
        options.btnList.splice(0,options.btnList.length);
        //我知道了按钮
        options.btnList.push(
            {
                btnClass:"icon142",
                btnClickFunc:function () {
                    closeShoppingSuccessPage();
                }
            });
    }

    return options;
}

/**
 * 根据hfOrderViewModel的商品信息显示或关闭对应订单信息填写页面
 * @param isShow  true:显示; false:关闭
 */
function showPageByGoods(isShow){
    var inputPages = $("#divHfOrderInfoInput div.receiptinfo");
    if(!inputPages || inputPages.length==0){
        return;
    }
    console.debug(inputPages.length)
    $.each(inputPages, function (i, item) {
        var page = $(item);
        if(page.data("hfgoodscat")== hfOrderViewModel.goodsOrder().goods.hfGoodsCat()){
            isShow ? page.show() : page.hide();
        }else{
            page.hide();
        }
    });
    isShow ? $("#divHfOrderInfoInput").show() : $("#divHfOrderInfoInput").hide();
}

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

//========初始化 start========
var orderViewModel = new OrderViewModel();
try{
    ko.applyBindings(orderViewModel,$("#divLayerMain")[0]);
}catch(err){}
ko.applyBindings(orderViewModel,$("#gongJiHeader")[0]);
ko.applyBindings(orderViewModel,$(".shopnavmerit")[0]);

var hfOrderViewModel = new HfOrderViewModel();
ko.applyBindings(hfOrderViewModel,$("#divHfOrderPlacePage")[0]);
//========初始化 end========

