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
  uidList = [1, 2, 3, 4, 5, 6];
  gameManagerList: GameManager[] = [];
  propMap = {};
  getGameCtr(uid) {
    return this.gameManagerList.find(
      (ctr: GameManager) => ctr.uidList.indexOf(uid) > -1
    );
  }
  checkAfterTurn() {
    console.log("轮次", this.uidList);
    // 每轮更新一次游戏数据
    socketManager.sendMsgByUidList(this.uidList, PROTOCLE.SERVER.RANK_UPDATE, {
      rankInfo: this.getRankInfo()
    });
  }
  getTargetRankList() {
    if (this.rankRound == 1) {
      return this.list1;
    } else if (this.rankRound == 2) {
      return this.list2;
    } else if (this.rankRound == 3) {
      return this.list3;
    } else {
      console.log("?????", this.rankRound);
      return [];
    }
  }
  rankRound = 0;
  afterGameOver(gameInfo) {
    if (this.isMatch) {
      // 将胜利者塞到下一轮的待定组
      let userGameData1 = gameInfo.data1;
      let userGameData2 = gameInfo.data2;
      let uidWinner =
        userGameData1.score > userGameData2.score
          ? userGameData1.uid
          : userGameData2.uid;
      this.waitingList.push(uidWinner);
      console.log(this.waitingList);

      // 检查当前轮次 是否所有队伍完成pk，完成了进入下一轮
      if (this.rankRound >= 3) {
        console.log("最后一场比赛");
        this.isStarted = false;
        this.uidList.forEach(uid => {
          let ctrUser = socketManager.getUserCtrById(uid);
          ctrUser.inRoomId = 0;
          this.leave(uid);
        });
        this.uidList = [];
      } else {
        let currentList = this.getTargetRankList();
        let flagOverAll =
          currentList.length > 0 &&
          currentList.every((ctr: GameManager) => ctr.gameInfo.isFinish);
        console.log(flagOverAll, currentList.length, "flagOverAll");
        setTimeout(() => {
          if (flagOverAll) {
            this.goNextRankRound();
          }
        }, 10000);
      }
    } else {
      this.isStarted = false;
    }
  }
  waitingList = [];
  goNextRankRound() {
    this.rankRound++;
    if (this.rankRound > 3) {
      return;
    }
    // 将当前在房间里的玩家分组开始游戏
    let list1 = [];
    this.waitingList.forEach(uid => {
      let group = list1[list1.length - 1];
      if (!group || group.length >= 2) {
        group = [];
        list1.push(group);
      }
      group.push(uid);
    });
    this.waitingList = [];
    let listCtrs = [];
    list1.forEach(group => {
      let ctrGame = new GameManager(group, this);
      this.gameManagerList.push(ctrGame);
      listCtrs.push(ctrGame);
      ctrGame.doStart();

      socketManager.sendMsgByUidList(group, PROTOCLE.SERVER.RANK_GAME_START, {
        gameInfo: ctrGame.gameInfo
      });
    });

    if (this.rankRound == 1) {
      this.list1 = listCtrs;
    } else if (this.rankRound == 2) {
      this.list2 = listCtrs;
    } else if (this.rankRound == 3) {
      this.list3 = listCtrs;
    }
    this.checkAfterTurn();
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
    this.propMap[uid] = propId;
    this.uidList.push(uid);
    if (this.isMatch) {
      this.waitingList = this.uidList;
      let userList = this.getUserDataList();
      socketManager.sendMsgByUidList([uid], PROTOCLE.SERVER.RANK_ENTER, {
        flag: true,
        userInfo: socketManager.getUserInfoById(uid),
        userList: userList
      });

      socketManager.sendMsgByUidList(
        this.uidList,
        PROTOCLE.SERVER.RANK_UPDATE,
        {
          rankInfo: this.getRankInfo()
        }
      );
      if (this.uidList.length >= MATCH_NEED) {
        this.doStartMatch();
      }
    } else {
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
  getRankInfo() {
    let waitingList = [];
    this.waitingList.forEach(uid => {
      waitingList.push(socketManager.getUserInfoById(uid));
    });
    let rankInfo = {
      waitingList,
      round: this.rankRound,
      list1: this.list1.map((ctr: GameManager) => ctr.gameInfo),
      list2: this.list2.map((ctr: GameManager) => ctr.gameInfo),
      list3: this.list3.map((ctr: GameManager) => ctr.gameInfo)
    };
    return rankInfo;
  }
  list1: GameManager[] = [];
  list2: GameManager[] = [];
  list3: GameManager[] = [];
  doStartMatch() {
    this.isStarted = true;
    this.waitingList = this.uidList;
    this.goNextRankRound();
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
    gameCtr.doStart();
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
      rankInfo: this.getRankInfo()
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
