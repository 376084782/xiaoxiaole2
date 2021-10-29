import Util from "../Util";
import socketManager from "..";
import _ from "lodash";
import PROTOCLE from "../config/PROTOCLE";
import GameManager from "./GameManager";
import { MATCH_NEED } from "../config";
// 游戏内玩家全部离线的房间，自动清除
export default class RoomManager {
  isMatch = false;
  roomId = 1;
  isPublic = true;
  isStarted = false;
  // 存当前在游戏中的uid列表
  uidList = [];
  gameManagerList: GameManager[] = [];
  propMap = {};
  getGameCtr(uid) {
    return this.gameManagerList.find(
      (ctr: GameManager) => ctr.uidList.indexOf(uid) > -1
    );
  }
  afterGameOver(gameInfo) {
    if (this.isMatch) {
      // 将获胜者塞到下一回合，失败者t出去
    } else {
      this.isStarted = false;
    }
  }
  constructor(isMatch) {
    this.isMatch = isMatch;
    this.roomId = Util.getUniqId();
  }
  askShuffle(uid) {
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr) {
      gameCtr.askShuffle(uid);
    }
  }
  askChuizi(uid, idx) {
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr) {
      gameCtr.askChuizi(uid, idx);
    }
  }
  // 玩家加入
  join(uid, propId) {
    if (this.isStarted) {
      return;
    }
    this.uidList.push(uid);
    if (this.isMatch) {
      this.propMap[uid] = propId;
      socketManager.sendMsgByUidList([uid], PROTOCLE.SERVER.RANK_ENTER, {
        flag: true,
        userInfo: socketManager.getUserInfoById(uid),
        userList: this.getUserDataList()
      });
      this.rankInfo.userNextRound.push(uid);
      if (this.uidList.length >= MATCH_NEED) {
        this.doStartMatch();
      }
    } else {
      this.propMap[uid] = propId;
      socketManager.sendMsgByUidList([uid], PROTOCLE.SERVER.SHOW_MATCH_ENTER, {
        flag: true,
        userInfo: socketManager.getUserInfoById(uid)
      });
      if (this.uidList.length >= 2) {
        this.doStartGame();
      }
    }
  }
  getUserDataList() {
    let userDataList = [];
    this.uidList.forEach(uid => {
      userDataList.push(socketManager.getUserInfoById(uid));
    });
    return userDataList;
  }
  rankInfo = {
    userNextRound: [],
    round: 1
  };
  doStartMatch() {
    this.isStarted = true;
    // 将userNextRound的玩家依次塞到对应的游戏对局中
  }

  doStartGame() {
    // 显示匹配成功动画
    this.isStarted = true;
    let userDataList = [];
    this.uidList.forEach(uid => {
      userDataList.push(socketManager.getUserInfoById(uid));
    });
    // 随机游戏内数据
    let gameCtr = new GameManager(this.uidList, this);
    this.gameManagerList.push(gameCtr);
    socketManager.sendMsgByUidList(
      this.uidList,
      PROTOCLE.SERVER.UPDATE_GAME_INFO,
      {
        gameInfo: gameCtr.gameInfo
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
  getRoomInfo(uid) {
    let info: any = {
      isInRoom: true,
      isStarted: this.isStarted,
      gameInfo: {},
      userList: this.getUserDataList(),
      isMatch: this.isMatch,
      rankInfo: this.rankInfo
    };
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr) {
      info.gameInfo = gameCtr.gameInfo;
    }
    return info;
  }
  doMove(idx1, idx2, uid) {
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr) {
      gameCtr.doMove(idx1, idx2, uid);
    }
  }
  useProp(id, uid) {
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr) {
      gameCtr.useProp(id, uid);
    }
  }
}
