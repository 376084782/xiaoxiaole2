import API from "../api/API";
import AgoraTokenGenerater from "../api/AgoraTokenGenerater";

var express = require("express");
var router = express.Router();
/* GET home page. */
router.post("/proxy", async (req, res, next) => {
  let data = req.body;
  let data2: any = await API.doAjax({
    url: data.url,
    method: data.method,
    data: data.data
  });
  res.send(data2);
});
router.post("/userinfo", async (req, res, next) => {
  let data = req.body;
  let result = (await API.getUserInfo(data.uid)) as any;
  res.send(result);
});

router.post("/agora", async (req, res, next) => {
  let data = req.body;
  let key = AgoraTokenGenerater.getToken({
    uid: data.uid,
    channelName: data.channel
  });
  if (!key) {
    res.send({
      code: -1,
      message: "agora初始化失败"
    });
  } else {
    res.send({
      code: 0,
      data: {
        key
      }
    });
  }
});

module.exports = router;
