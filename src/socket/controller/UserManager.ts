import socketManager from "..";
import PROTOCLE from "../config/PROTOCLE";

export default class UserManager {
  // 头像
  avatar = "";
  // 名称
  nickname = "";
  // 性别
  sex = 1;
  // id
  uid = -1;
  // 当前所处的阶段
  inRoomId: number = 0;
  score = 0;
  isRobot = false;
  constructor({ avatar, nickname, uid, sex, score, isRobot }) {
    this.avatar = avatar;
    this.nickname = nickname;
    this.uid = uid;
    this.sex = sex || 1;
    this.score = score || 0;
    this.isRobot = isRobot || false;
  }
  getInfo() {
    return {
      isRobot: this.isRobot,
      avatar: this.avatar,
      nickname: this.nickname,
      sex: this.sex,
      uid: this.uid,
      inRoomId: this.inRoomId,
      score: this.score
    };
  }
  updateToClient() {
    // 更新当前自己状态给客户端
    socketManager.sendMsgByUidList(
      [this.uid],
      PROTOCLE.SERVER.UPDATE_USER_INFO,
      this.getInfo()
    );
  }
}
