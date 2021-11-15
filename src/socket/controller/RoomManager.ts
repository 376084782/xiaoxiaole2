import Util from "../Util";
import socketManager from "..";
import _ from "lodash";
import PROTOCLE from "../config/PROTOCLE";
import GameManager from "./GameManager";
import { MATCH_NEED, PROP_LIST } from "../config";
// 游戏内玩家全部离线的房间，自动清除
export default class RoomManager {
  type = 0;
  lp = 0;

  isMatch = false;
  roomId = 1;
  isPublic = true;
  isStarted = false;
  // 存当前在游戏中的uid列表
  uidList = [];
  gameManagerList: GameManager[] = [];
  propMap = {};
  matchDataMap = {};
  getGameCtr(uid) {
    return this.gameManagerList.find(
      (ctr: GameManager) => ctr.uidList.indexOf(uid) > -1
    );
  }
  checkAfterTurn() {
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
      return [];
    }
  }
  orderMap = {};
  getOrderByUid(uid) {
    return this.orderMap[uid];
  }
  rankRound = 0;
  afterGameOver(gameInfo) {
    let uidWinner = gameInfo.winner;
    let uidLoser = gameInfo.loser;
    let orderWinner = this.getOrderByUid(uidWinner);
    let orderLoser = this.getOrderByUid(uidLoser);
    this.waitingList.push(uidWinner);

    if (this.isMatch) {
      this.checkAfterTurn();
      // 将胜利者塞到下一轮的待定组

      let userCtr = socketManager.getUserCtrById(uidLoser);
      userCtr.inRoomId = 0;

      // 检查当前轮次 是否所有队伍完成pk，完成了进入下一轮
      if (this.rankRound >= 3) {
        console.log("最后一场比赛");
        console.log("上报游戏结果", {
          rank: 1,
          orderId: orderWinner
        });
        socketManager.doAjax({
          url: "/gameover",
          method: "post",
          data: {
            rank: 1,
            orderId: orderWinner
          }
        });
        console.log("上报游戏结果", {
          rank: 2,
          orderId: orderLoser
        });
        socketManager.doAjax({
          url: "/gameover",
          method: "post",
          data: {
            rank: 2,
            orderId: orderLoser
          }
        });

        socketManager.sendMsgByUidList(
          [uidWinner],
          PROTOCLE.SERVER.RANK_RESULT,
          {
            orderId: orderWinner,
            rank: 1
          }
        );
        socketManager.sendMsgByUidList(
          [uidLoser],
          PROTOCLE.SERVER.RANK_RESULT,
          {
            orderId: orderLoser,
            rank: 2
          }
        );
        this.isStarted = false;
        this.uidList.forEach(uid => {
          this.leave(uid);
          let ctrUser = socketManager.getUserCtrById(uid);
          ctrUser.inRoomId = 0;
        });
        this.uidList = [];
        this.rankRound = 0;
        this.waitingList = [];
        this.list1 = [];
        this.list2 = [];
        this.list3 = [];
      } else {
        // 输的踢出
        console.log("上报游戏结果", {
          rank: 0,
          orderId: orderLoser
        });
        socketManager.doAjax({
          url: "/gameover",
          method: "post",
          data: {
            rank: 0,
            orderId: orderLoser
          }
        });
        socketManager.sendMsgByUidList(
          [uidLoser],
          PROTOCLE.SERVER.RANK_RESULT,
          {
            orderId: orderLoser,
            rank: 0
          }
        );

        let currentList = this.getTargetRankList();
        let flagOverAll =
          currentList.length > 0 &&
          currentList.every((ctr: GameManager) => ctr.gameInfo.isFinish);
        setTimeout(() => {
          if (flagOverAll) {
            this.goNextRankRound();
          }
        }, 10000);
      }
    } else {
      // 上报游戏结果
      console.log("上报游戏结果", {
        rank: 1,
        orderId: orderWinner
      });
      socketManager.doAjax({
        url: "/gameover",
        method: "post",
        data: {
          rank: 1,
          orderId: orderWinner
        }
      });
      console.log("上报游戏结果", {
        rank: 0,
        orderId: orderLoser
      });
      socketManager.doAjax({
        url: "/gameover",
        method: "post",
        data: {
          rank: 0,
          orderId: orderLoser
        }
      });
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
  constructor(isMatch, type, lp) {
    this.isMatch = isMatch;
    this.type = type;
    this.lp = lp;
    this.roomId = Util.getUniqId();
  }
  askShuffle(uid) {
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr && !gameCtr.flagAnimating) {
      gameCtr.askShuffle(uid);
    }
  }
  askChuizi(uid, idx) {
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr && !gameCtr.flagAnimating) {
      gameCtr.askChuizi(uid, idx);
    }
  }
  // 玩家加入
  join({ uid, propId, matchId, type, lp }) {
    if (this.isStarted) {
      return;
    }
    this.propMap[uid] = propId;
    this.matchDataMap[uid] = {
      matchId,
      type,
      lp
    };
    if (this.isMatch) {
      if (this.uidList.length == 0) {
        // this.uidList = [1, 2, 3, 4, 5, 6];
      }
      this.uidList.push(uid);
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
      this.uidList.push(uid);
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
    // 房间内的人都扣除对应的道具
    this.doPay()
      .then(e => {
        console.log("rsv");
        this.isStarted = true;
        this.waitingList = this.uidList;
        this.goNextRankRound();
      })
      .catch(e => {
        console.log("rej");
        socketManager.sendErrByUidList(this.uidList, "startGame", e);
        this.isStarted = false;
        this.uidList.forEach(uid => {
          this.leave(uid);
          let ctrUser = socketManager.getUserCtrById(uid);
          ctrUser.inRoomId = 0;
        });
      });
  }

  doPay() {
    return new Promise((rsv, rej) => {
      setTimeout(() => {
        let dataSend = {
          matchId: 22, //比赛id
          type: 3, //比赛类型，1竞技场双人对战 2竞技场锦标赛 3欢乐场双人对战 4欢乐场锦标赛 5训练场双人对战 6训练场锦标赛
          lp: 10000, //令牌数量
          users: []
        };
        this.uidList.forEach(uid => {
          let propId = this.propMap[uid];
          let startData = this.matchDataMap[uid];
          let propConf = PROP_LIST.find(conf => conf.id == propId);
          dataSend.users.push({
            djmoney: propConf.cost,
            dj: propConf.name,
            userId: uid
          });
          Object.assign(dataSend, {
            matchId: startData.matchId,
            type: "" + startData.type,
            lp: startData.lp
          });
        });
        console.log("=======请求开始游戏======", dataSend);
        socketManager
          .doAjax({
            url: "/batchstart",
            method: "post",
            data: dataSend,
            noMd5: true
          })
          .then((e: any) => {
            console.log("创建游戏订单返回:", e);
            if (e.result == 1) {
              // 赋值orderMap
              this.orderMap = {};
              e.data.forEach(confUser => {
                this.orderMap[confUser.userId] = confUser.orderId;
              });
              rsv(null);
            } else {
              // 错误
              rej(e.msg);
            }
          });
      }, 1000);
    });
  }
  doStartGame() {
    this.isStarted = true;
    this.doPay()
      .then(e => {
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
      })
      .catch(e => {
        console.log("rej");
        this.isStarted = false;
        socketManager.sendErrByUidList(this.uidList, "startGame", e);
        this.uidList.forEach(uid => {
          this.leave(uid);
          let ctrUser = socketManager.getUserCtrById(uid);
          ctrUser.inRoomId = 0;
        });
      });
  }

  // 玩家离开
  leave(uid) {
    this.uidList = this.uidList.filter(uid1 => uid1 != uid);
    if (!this.isStarted && !this.isMatch) {
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
    if (gameCtr && !gameCtr.flagAnimating) {
      gameCtr.doMove(idx1, idx2, uid);
    }
  }
  useProp(id, uid) {
    if (!this.isStarted) {
      return;
    }
    let gameCtr = this.getGameCtr(uid);
    if (gameCtr && !gameCtr.flagAnimating) {
      gameCtr.useProp(id, uid);
    }
  }
}
