import { KEKE_HOST } from "../socket/config";

var request = require("request");
export default class API {
  static doAjax({ url, method, data }) {
    return new Promise((rsv, rej) => {
      request(
        {
          url: url,
          method: method,
          json: true,
          headers: {
            "content-type": "application/json"
          },
          body: data
        },
        function(error, response, body) {
          if (!error && response.statusCode == 200) {
            rsv(body);
          } else {
            rej(error);
          }
        }
      );
    });
  }

  static async getUserInfo(user_id) {
    let data2: any = await this.doAjax({
      url: KEKE_HOST + "/v2/external/user/info",
      method: "get",
      data: {
        user_id
      }
    });
    if (data2.code == 0) {
      // 转化数据格式
      return {
        code: 0,
        data: {
          avatar: data2.data.image,
          sex: data2.data.gender,
          nickname: data2.data.nickname,
          uid: user_id
        }
      };
    } else {
      return {
        code: 0,
        data: {
          nickname: "测试用户" + user_id,
          sex: 1,
          avatar:
            "https://ss1.bdstatic.com/70cFvXSh_Q1YnxGkpoWK1HF6hhy/it/u=25668084,2889217189&fm=26&gp=0.jpg",
          uid: user_id
        }
      };
    }
  }
}
