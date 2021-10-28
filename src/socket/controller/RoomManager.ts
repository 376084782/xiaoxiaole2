import Util from "../Util";
import socketManager from "..";
import _ from "lodash";
import PROTOCLE from "../config/PROTOCLE";
import GameManager from "./GameManager";
// 游戏内玩家全部离线的房间，自动清除
export default class RoomManager {
  roomId = 1;
  isPublic = true;
  isStarted = false;
  // 存当前在游戏中的uid列表
  uidList = [];
  gameManager: GameManager;
  propMap = {};
  constructor() {
    this.roomId = Util.getUniqId();
  }
  askShuffle(uid) {
    if (this.gameManager) {
      this.gameManager.askShuffle(uid);
    }
  }
  // 玩家加入
  join(uid, propId) {
    this.uidList.push(uid);
    this.propMap[uid] = propId;
    socketManager.sendMsgByUidList([uid], PROTOCLE.SERVER.SHOW_MATCH_ENTER, {
      flag: true,
      userInfo: socketManager.getUserInfoById(uid)
    });
    if (this.uidList.length >= 2) {
      this.doStartGame();
    }
  }
  getUserDataList() {
    let userDataList = [];
    this.uidList.forEach(uid => {
      userDataList.push(socketManager.getUserInfoById(uid));
    });
    return userDataList;
  }
  doStartGame() {
    // 显示匹配成功动画
    this.isStarted = true;
    let userDataList = [];
    this.uidList.forEach(uid => {
      userDataList.push(socketManager.getUserInfoById(uid));
    });
    // 随机游戏内数据
    this.gameManager = new GameManager(this.uidList, this);
    socketManager.sendMsgByUidList(
      this.uidList,
      PROTOCLE.SERVER.UPDATE_GAME_INFO,
      {
        gameInfo: this.gameManager.gameInfo
      }
    );
    setTimeout(() => {
      socketManager.sendMsgByUidList(
        this.uidList,
        PROTOCLE.SERVER.SHOW_MATCH_SUCCESS,
        {
          userList: userDataList
        }
      );
      setTimeout(() => {
        // 广播下发游戏数据，进入游戏开始动画
        socketManager.sendMsgByUidList(
          this.uidList,
          PROTOCLE.SERVER.SHOW_GAME_START
        );
      }, (158 / 30) * 1000);
    }, 2000);
  }
  // 玩家离开
  leave(uid) {
    this.uidList = this.uidList.filter(uid1 => uid1 != uid);
    if (!this.isStarted) {
      socketManager.sendMsgByUidList([uid], PROTOCLE.SERVER.SHOW_MATCH_ENTER, {
        flag: false
      });
    }
  }
  // 获取全服房间内游戏数据
  getRoomInfo() {
    let info = {
      isInRoom: true,
      isStarted: this.isStarted,
      gameInfo: {},
      userList: this.getUserDataList()
    };
    if (this.gameManager) {
      info.gameInfo = this.gameManager.gameInfo;
    }
    return info;
  }
  doMove(idx1, idx2, uid) {
    if (!this.gameManager) {
      console.log("gameManager 没了");
      return;
    }
    this.gameManager.doMove(idx1, idx2, uid);
  }
  useProp(id, uid) {
    if (!this.gameManager) {
      return;
    }
    this.gameManager.useProp(id, uid);
  }
}
