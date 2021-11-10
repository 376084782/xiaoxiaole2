import Util from "../Util";
import socketManager from "..";
import PROTOCLE from "../config/PROTOCLE";
import _ = require("lodash");
import RoomManager from "./RoomManager";

export default class GameManager {
  roundTime = 60;
  ctrRoom: RoomManager;
  gameInfo = {
    isFinish: false,
    round: 1,
    turn: 1,
    turnList: [1, 1, 2, 2],
    skillNeed: 6,
    data1: {
      propData: {},
      shuffle: 1,
      chuizi: 1,
      propId: 1,
      gridType: 1,
      score: 0,
      skillPrg: 0,
      nickname: "",
      avatar: "",
      uid: 1
    },
    data2: {
      propData: {},
      shuffle: 1,
      chuizi: 1,
      propId: 2,
      gridType: 1,
      score: 0,
      skillPrg: 0,
      nickname: "",
      avatar: "",
      uid: 1
    },
    // 刚开始游戏时30s（预留动画时间） 之后20s
    timeNextStep: 0,
    listData: [],
    seatMap: {}
  };
  uidList: number[] = [];
  constructor(uidList, ctrRoom) {
    this.ctrRoom = ctrRoom;
    this.uidList = uidList;
    let seatList = Util.shuffle([1, 2]);
    uidList.forEach((uid, i) => {
      this.gameInfo.seatMap[uid] = seatList[i];
      let targetData =
        seatList[i] == 1 ? this.gameInfo.data1 : this.gameInfo.data2;
      targetData.propId = this.ctrRoom.propMap[uid] || 1;
      targetData.gridType = Util.getRandomInt(1, 6);

      let userInfo = socketManager.getUserInfoById(uid);
      targetData.avatar = userInfo.avatar;
      targetData.uid = userInfo.uid;
      targetData.nickname = userInfo.nickname;
    });
  }
  doStart() {
    let timeAni = (158 / 30) * 1000;
    let timeNextStep = this.roundTime * 1000 + timeAni;
    this.gameInfo.timeNextStep = new Date().getTime() + timeNextStep;
    this.initBoard();
    clearInterval(this.timerChecker);
    this.timerChecker = setInterval(this.timeChecker.bind(this), 500);
  }

  askChuizi(uid, idx) {
    let color = this.gameInfo.seatMap[uid];
    let colorCurrent = this.getCurrentColor();
    if (color == colorCurrent) {
      let dataTarget = color == 1 ? this.gameInfo.data1 : this.gameInfo.data2;
      if (dataTarget.chuizi > 0) {
        dataTarget.chuizi--;
        let listDel = [idx];
        let listAction = this.doDelByProp(listDel);
        socketManager.sendMsgByUidList(
          this.uidList,
          PROTOCLE.SERVER.DO_CHUIZI,
          {
            gameInfo: this.gameInfo,
            idx,
            crashList: listAction,
            seat: color
          }
        );
        this.goNextAfterAction(listAction, false);
      }
    }
  }
  askShuffle(uid) {
    let color = this.gameInfo.seatMap[uid];
    let colorCurrent = this.getCurrentColor();
    if (color == colorCurrent) {
      // 判断剩余次数
      let dataTarget = color == 1 ? this.gameInfo.data1 : this.gameInfo.data2;
      if (dataTarget.shuffle > 0) {
        dataTarget.shuffle--;
        let { listShuffle, listData } = this.doShuffle();
        socketManager.sendMsgByUidList(this.uidList, PROTOCLE.SERVER.SHUFFLE, {
          listShuffle,
          gameInfo: this.gameInfo,
          seat: this.gameInfo.seatMap[uid]
        });
      }
    }
  }
  getCurrentColor() {
    let turn = this.gameInfo.turn + (this.gameInfo.round % 2 == 1 ? 0 : 2);
    return this.gameInfo.turnList[turn - 1];
  }
  doMove(idx1, idx2, uid) {
    if (this.gameInfo.isFinish) {
      this.goNextTurn(this.gameInfo.listData, false, false, 0);
      return;
    }
    let color = this.gameInfo.seatMap[uid];
    let colorCurrent = this.getCurrentColor();
    if (color == colorCurrent) {
      // 校验是否轮到当前颜色
      let { listAction, flagNextTurn } = this.getMoveData(idx1, idx2);
      let flagExtraMove = !!listAction.find(
        e => e.data && e.data.flagExtraMove
      );
      if (flagNextTurn) {
        socketManager.sendMsgByUidList(this.uidList, PROTOCLE.SERVER.MOVE, {
          crashList: listAction,
          gameInfo: this.gameInfo,
          seat: colorCurrent,
          flagExtraMove: flagExtraMove
        });
        this.goNextAfterAction(listAction, !flagExtraMove);
      } else {
        socketManager.sendMsgByUidList(this.uidList, PROTOCLE.SERVER.MOVE, {
          crashList: listAction,
          gameInfo: this.gameInfo,
          seat: colorCurrent,
          flagExtraMove: flagExtraMove
        });
        this.goNextAfterAction(listAction, false);
      }
    } else {
      this.goNextTurn(this.gameInfo.listData, false, false, 0);
    }
  }
  goNextAfterAction(listAction, isGoNext, delay = 0) {
    clearTimeout(this.timer);
    // 延迟一段时间用于播放移动动画
    let timeAnimate = delay;
    listAction.forEach(({ action, data }) => {
      if (action == "exchange") {
        timeAnimate += 8 / 30;
      } else if (action == "crash") {
        let { listFall, listWillDel } = data;
        if (listWillDel.length > 0) {
          timeAnimate += 8 / 30;
        }
        if (listFall.length > 0) {
          timeAnimate += 10 / 30;
        }
      }
    });
    timeAnimate += 36 / 30;
    this.goNextTurn(
      this.gameInfo.listData,
      isGoNext,
      false,
      Math.floor(timeAnimate * 1000)
    );
  }
  timerChecker;
  timeChecker() {
    let time = new Date().getTime();
    if (time < this.gameInfo.timeNextStep) {
      return;
    }
    this.goNextTurn(this.gameInfo.listData, false, true, 0);
  }
  goNextTurn(listData, isGoNextTurn, isGoNextRound = false, delay = 0) {
    let timeNextStep = Math.floor(this.roundTime * 1000);
    this.gameInfo.listData = listData;
    let isEnd = false;
    if (this.gameInfo.round <= 8) {
      if (isGoNextRound) {
        this.gameInfo.turn = 1;
        this.gameInfo.round++;
        this.gameInfo.timeNextStep =
          new Date().getTime() + delay + timeNextStep;
      } else if (isGoNextTurn) {
        if (this.gameInfo.turn < 2) {
          this.gameInfo.timeNextStep += delay;
          this.gameInfo.turn++;
        } else {
          this.gameInfo.timeNextStep =
            new Date().getTime() + delay + timeNextStep;
          this.gameInfo.turn = 1;
          this.gameInfo.round++;
        }
      } else {
        this.gameInfo.timeNextStep += delay;
      }
    }
    isEnd = this.gameInfo.round > 8;

    if (isEnd) {
      this.doAfter(delay, () => {
        this.doFinishGame();
      });
    } else {
      this.doAfter(delay, () => {
        this.ctrRoom && this.ctrRoom.checkAfterTurn();
        socketManager.sendMsgByUidList(
          this.uidList,
          PROTOCLE.SERVER.GAME_CHANGE_POWER,
          {
            gameInfo: this.gameInfo
          }
        );
      });
    }
  }
  doFinishGame() {
    clearInterval(this.timerChecker);
    if (!this.ctrRoom.isMatch) {
      this.uidList.forEach(uid => {
        let userCtr = socketManager.getUserCtrById(uid);
        userCtr.inRoomId = 0;
        this.ctrRoom.leave(uid);
      });
    }

    let uidWillSend = this.uidList.concat();
    this.uidList = [];
    this.gameInfo.isFinish = true;
    this.ctrRoom.afterGameOver(this.gameInfo);

    clearTimeout(this.timer);
    // 游戏结束
    setTimeout(() => {
      socketManager.sendMsgByUidList(uidWillSend, PROTOCLE.SERVER.GAME_FINISH, {
        gameInfo: this.gameInfo
      });
    }, 0);
  }
  timer;
  doAfter(time, func) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      func && func();
    }, time);
  }

  checkMovePower() {}

  updateListData(listData) {
    this.gameInfo.listData = listData;
  }
  initBoard() {
    let listData = [];
    for (let m = 0; m < 7; m++) {
      listData[m] = [];
      for (let n = 0; n < 7; n++) {
        let colorLeft = -1;
        let colorTop = -1;
        if (n >= 1) {
          // 查询左侧的格子颜色
          colorLeft = listData[m][n - 1];
        }
        if (m >= 1) {
          // 查询上侧的格子颜色
          colorTop = listData[m - 1][n];
        }
        let listColor = [1, 2, 3, 4, 5, 6].filter(
          color => color != colorLeft && color != colorTop
        );

        let randomIdx = Util.getRandomInt(0, listColor.length);
        listData[m][n] = listColor[randomIdx];
      }
    }
    this.gameInfo.listData = listData;
    return listData;
  }

  getMoveData(idx1, idx2) {
    let listAction = [];
    let resExchange = this.exchange(idx1, idx2);
    let flagNextTurn = true;
    if (resExchange) {
      listAction.push({
        action: "exchange",
        data: resExchange
      });
      while (true) {
        let dataCrash = this.loopCrash();
        if (!dataCrash.isChanged) {
          break;
        }

        listAction.push({
          action: "crash",
          data: dataCrash
        });
      }
      if (listAction.length == 1) {
        flagNextTurn = false;
        let resExchangeBack = this.exchange(idx1, idx2);
        listAction.push({
          action: "exchange_back",
          data: resExchangeBack
        });
      }
    }
    return { flagNextTurn, listAction };
  }
  useProp(id, uid) {
    if (this.gameInfo.isFinish) {
      return;
    }
    let extraData: any = {};
    let listDel = [];
    switch (id) {
      case 1: {
        let res = this.useProp1();
        listDel = res.listDel;
        extraData.idx = res.idx;
        break;
      }
      case 2: {
        let res = this.useProp2();
        listDel = res.listDel;
        extraData.idx = res.idx;
        break;
      }
      case 3: {
        let res = this.useProp3();
        listDel = res.listDel;
        break;
      }
      case 5: {
        listDel = this.useProp5();
        break;
      }
    }

    let color = this.gameInfo.seatMap[uid];
    let colorCurrent = this.getCurrentColor();
    if (color == colorCurrent) {
      // 清空技能能量
      let currentTargetData = this.getCurrentData();
      if (currentTargetData.skillPrg >= this.gameInfo.skillNeed) {
        currentTargetData.skillPrg = 0;
        clearTimeout(this.timer);
        if (id == 4) {
          // 帽子
          // 随机塞三个道具,一个闪电，两个箭头
          let listCanChangeIdxs = [];
          this.gameInfo.listData.forEach((list, y) => {
            list.forEach((grid, x) => {
              if (grid < 100) {
                listCanChangeIdxs.push(this.xyToIdx(x, y));
              }
            });
          });
          listCanChangeIdxs = _.shuffle(listCanChangeIdxs);
          let listWillChange = listCanChangeIdxs.slice(0, 3);
          let listTarget = [];
          listTarget.push(400 + Util.getRandomInt(1, 6));
          listTarget.push(100 + Util.getRandomInt(1, 6));
          listTarget.push(200 + Util.getRandomInt(1, 6));
          let listChange = [];
          listWillChange.forEach((grid, i) => {
            listChange.push([grid, listTarget[i]]);
            this.changeGrid(grid, listTarget[i]);
          });
          extraData.listChange = listChange;
        } else if (id == 6) {
          // 油漆
          // 随机6个变色
          let listCanChangeIdxs = [];
          let colorList = [];
          for (let i = 0; i < 6; i++) {
            let color = i + 1;
            if (color != currentTargetData.gridType) {
              colorList.push(color);
            }
          }
          let targetGridColor =
            colorList[Util.getRandomInt(0, colorList.length - 1)];
          this.gameInfo.listData.forEach((list, y) => {
            list.forEach((grid, x) => {
              if (grid < 100 && grid != targetGridColor) {
                listCanChangeIdxs.push(this.xyToIdx(x, y));
              }
            });
          });
          listCanChangeIdxs = _.shuffle(listCanChangeIdxs);
          let listChangeColor = listCanChangeIdxs.slice(0, 6);
          listChangeColor.forEach(idx => {
            this.changeGrid(idx, targetGridColor);
          });
          extraData.listChangeColor = listChangeColor;
          extraData.targetColor = targetGridColor;
          extraData.listData = this.gameInfo.listData;
        }

        let listAction = this.doDelByProp(listDel);

        let flagExtraMove = !!listAction.find(
          e => e.data && e.data.flagExtraMove
        );
        socketManager.sendMsgByUidList(this.uidList, PROTOCLE.SERVER.USE_PROP, {
          crashData: { id, color, listAction, extraData, flagExtraMove },
          gameInfo: this.gameInfo,
          seat: colorCurrent
        });
        let map = {
          1: 42 / 30,
          2: 125 / 30,
          3: 60 / 30,
          4: 112 / 30,
          5: 85 / 30,
          6: 120 / 30
        };

        this.goNextAfterAction(listAction, false, map[id]);

        return { id, listAction };
      }
    }
  }
  getCurrentData() {
    let currentSeat = this.getCurrentColor();
    let currentTargetData =
      currentSeat == 1 ? this.gameInfo.data1 : this.gameInfo.data2;
    return currentTargetData;
  }
  doDelByProp(listDel = []) {
    let listAction = [];
    let isFirst = true;
    while (true) {
      let dataCrash;
      if (isFirst) {
        dataCrash = this.loopCrash(listDel);
        isFirst = false;
      } else {
        dataCrash = this.loopCrash();
      }
      if (!dataCrash.isChanged) {
        break;
      }
      listAction.push({
        action: "crash",
        data: dataCrash
      });
    }
    return listAction;
  }

  // 炸药
  useProp1() {
    let x = Util.getRandomInt(1, 2);
    let y = Util.getRandomInt(1, 5);
    let listDel = [];
    let dir = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    dir.forEach(([dirX, dirY]) => {
      let xy = { x: x + dirX, y: y + dirY };
      let idx = this.xyToIdx(xy.x, xy.y);
      listDel.push(idx);
    });
    return { listDel, idx: this.xyToIdx(x, y) };
  }
  // 毒
  useProp2() {
    let x = Util.getRandomInt(2, 4);
    let y = Util.getRandomInt(1, 4);
    let listDel = [];
    let dir = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [2, 0],

      [-1, -1],
      [-2, -1],
      [1, -1],
      [0, -1],

      // [-2, 1],
      [-1, 1],
      [0, 1],
      [1, 1],

      // [-1, 2],
      [0, 2]
      // [1, 2]
    ];
    dir.forEach(([dirX, dirY]) => {
      let xy = { x: x + dirX, y: y + dirY };
      let idx = this.xyToIdx(xy.x, xy.y);
      listDel.push(idx);
    });
    return { listDel, idx: this.xyToIdx(x, y) };
  }
  // 火箭
  useProp3() {
    let listDel = [];
    let listXY = [
      [3, 0],

      [3, 1],
      [2, 1],
      [4, 1],

      [3, 2],
      [2, 2],
      [4, 2],
      [1, 2],
      [5, 2],

      [3, 3],
      [2, 3],
      [4, 3],

      [3, 4]
    ];
    listXY.forEach(([x, y]) => {
      let idx = this.xyToIdx(x, y);
      listDel.push(idx);
    });
    return { listDel };
  }
  // 帽子
  useProp4() {
    let listDel = [];
    return listDel;
  }
  // 鸭子
  useProp5() {
    let listDel = [];
    let listXY = [
      [0, 6],
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
      [5, 6],
      [6, 6]
    ];
    listXY.forEach(([x, y]) => {
      let idx = this.xyToIdx(x, y);
      listDel.push(idx);
    });
    return listDel;
  }

  loopCrash(listWillDel = []) {
    let res: any[] = this.checkMerge();
    let listWillChange = [];
    res.forEach(dataDismiss => {
      listWillDel = listWillDel.concat(dataDismiss.list);
      listWillChange = listWillChange.concat(dataDismiss.listChange);
    });

    let valsDeled = this.delGrids(listWillDel);
    let dataDelBySpecialGrid = this.checkSpecialGridDeleted();
    valsDeled = valsDeled.concat(this.delGrids(dataDelBySpecialGrid.list));
    listWillDel = _.uniq(listWillDel.concat(dataDelBySpecialGrid.list));

    listWillChange.forEach(conf => {
      this.changeGrid(conf.idx, conf.value);
    });

    let listFall = this.checkFall();

    let isChanged =
      listWillChange.length > 0 ||
      listWillDel.length > 0 ||
      dataDelBySpecialGrid.list.length > 0 ||
      dataDelBySpecialGrid.listAni.length > 0 ||
      listFall.length > 0;

    let currentSeat = this.getCurrentColor();
    let currentTargetData =
      currentSeat == 1 ? this.gameInfo.data1 : this.gameInfo.data2;

    let prgAdded = valsDeled.filter(color => {
      return color == currentTargetData.gridType;
    }).length;
    currentTargetData.score += listWillDel.length;
    currentTargetData.skillPrg += prgAdded;
    if (currentTargetData.skillPrg >= this.gameInfo.skillNeed) {
      currentTargetData.skillPrg = this.gameInfo.skillNeed;
    }

    return {
      userData: currentTargetData,
      prgAdded,
      isChanged,
      listWillChange,
      listWillDel,
      dataDelBySpecialGrid,
      listFall,
      flagExtraMove: !!res.find(e => e.flagExtraMove)
    };
  }

  col = 7;
  row = 7;
  // idx=>x y
  idxToXY(idx) {
    return {
      x: idx % this.col,
      y: Math.floor(idx / this.col)
    };
  }
  // xy=>idx
  xyToIdx(x, y) {
    return y * this.col + x;
  }
  // 交换两个格子
  exchange(idx1, idx2) {
    // 解构，交换顺序
    let pos1 = this.idxToXY(idx1);
    let pos2 = this.idxToXY(idx2);

    let val1 = this.gameInfo.listData[pos1.y][pos1.x];
    let val2 = this.gameInfo.listData[pos2.y][pos2.x];
    if (val1 == val2) {
      // 判断两个值如果相同，不交换
      return false;
    }
    [
      this.gameInfo.listData[pos1.y][pos1.x],
      this.gameInfo.listData[pos2.y][pos2.x]
    ] = [
      this.gameInfo.listData[pos2.y][pos2.x],
      this.gameInfo.listData[pos1.y][pos1.x]
    ];
    return [
      [idx1, idx2],
      [idx2, idx1]
    ];
  }
  getColor(x, y) {
    return this.gameInfo.listData[y][x] % 100;
  }
  findLinkedList(idx, dirList = [1, 2, 3, 4], list?: number[]) {
    let xy = this.idxToXY(idx);
    let color = this.getColor(xy.x, xy.y);
    if (!list) {
      list = [idx];
    }

    let findByDir = dir => {
      let xy1 = { x: xy.x, y: xy.y };
      let dirList = [];
      switch (dir) {
        case 1: {
          xy1.y--;
          dirList = [1, 2, 4];
          break;
        }
        case 2: {
          xy1.x++;
          dirList = [1, 2, 3];

          break;
        }
        case 3: {
          xy1.y++;
          dirList = [4, 2, 3];

          break;
        }
        case 4: {
          xy1.x--;
          dirList = [1, 4, 3];
          break;
        }
      }
      if (xy1.x >= 0 && xy1.x < this.col && xy1.y >= 0 && xy1.y < this.row) {
        if (this.getColor(xy1.x, xy1.y) == color) {
          let idx = this.xyToIdx(xy1.x, xy1.y);
          if (list.indexOf(idx) == -1) {
            list.push(idx);
            list = _.uniq(list.concat(this.findLinkedList(idx, dirList, list)));
          }
        }
      }
      return list;
    };

    dirList.forEach(dir => {
      findByDir(dir);
    });

    return list;
  }
  isMoreThanInX(count, list) {
    return !!list.find(grid1 => {
      let xy1 = this.idxToXY(grid1);
      return (
        list.filter(grid => {
          let xy = this.idxToXY(grid);
          return xy.y == xy1.y;
        }).length >= count
      );
    });
  }
  isMoreThanInY(count, list) {
    return !!list.find(grid1 => {
      let xy1 = this.idxToXY(grid1);
      return (
        list.filter(grid => {
          let xy = this.idxToXY(grid);
          return xy.x == xy1.x;
        }).length >= count
      );
    });
  }
  isMoreThanInLine(count, list) {
    // x轴上是否有三个以上相连
    let flagMoreThanInX = this.isMoreThanInX(count, list);
    // y轴上是否有三个以上相连
    let flagMoreThanInY = this.isMoreThanInY(count, list);
    let flagMoreThan3 = flagMoreThanInX || flagMoreThanInY;
    return flagMoreThan3;
  }
  checkMerge() {
    let map = [];
    let flagExtraMove = false;
    this.gameInfo.listData.forEach((row, y) => {
      row.forEach((grid, x) => {
        let idx = this.xyToIdx(x, y);
        let list = map.find(({ color, list }) => {
          return list.indexOf(idx) > -1;
        });
        if (!list) {
          let listLinked = this.findLinkedList(idx);

          let listXSameOver3 = listLinked.filter(grid1 => {
            let xy1 = this.idxToXY(grid1);
            return (
              listLinked.filter(grid => {
                let xy = this.idxToXY(grid);
                return xy.y == xy1.y;
              }).length >= 3
            );
          });
          let listYSameOver3 = listLinked.filter(grid1 => {
            let xy1 = this.idxToXY(grid1);
            return (
              listLinked.filter(grid => {
                let xy = this.idxToXY(grid);
                return xy.x == xy1.x;
              }).length >= 3
            );
          });
          let flagMoreThan3 = false;
          // todo:效率略低，可以优化成根据终点位置横纵向查询
          listLinked = [];
          if (listXSameOver3.length > 0) {
            flagMoreThan3 = true;
            listLinked = listLinked.concat(listXSameOver3);
          }
          if (listYSameOver3.length > 0) {
            listLinked = listLinked.concat(listYSameOver3);
            flagMoreThan3 = true;
          }
          listLinked = _.uniq(listLinked);

          if (flagMoreThan3 && listLinked.indexOf(idx) > -1) {
            let listChange = [];
            // 相连五个以上，生成炸弹
            let flagMoreThan5 = listLinked.length >= 5;
            if (flagMoreThan5) {
              flagExtraMove = true;
              listChange.push({ idx, value: 300 + grid });
            } else {
              // 相连四个以上，生成箭头
              let flagMoreThan4X = this.isMoreThanInX(4, listLinked);
              if (flagMoreThan4X) {
                flagExtraMove = true;
                listChange.push({ idx, value: 200 + grid });
              } else {
                let flagMoreThan4Y = this.isMoreThanInY(4, listLinked);
                if (flagMoreThan4Y) {
                  flagExtraMove = true;
                  listChange.push({ idx, value: 100 + grid });
                }
              }
            }

            map.push({
              color: this.gameInfo.listData[y][x],
              list: listLinked,
              listChange,
              flagExtraMove
            });
          }
        }
      });
    });

    return map;
  }

  delGrids(list) {
    let valList = [];
    list.forEach(idx => {
      let val = this.delGrid(idx);
      valList.push(val);
    });
    return valList;
  }
  lastDelList = [];
  delGrid(idx) {
    let pos = this.idxToXY(idx);
    let val = +this.gameInfo.listData[pos.y][pos.x];
    this.lastDelList.push({
      idx,
      value: val
    });
    this.gameInfo.listData[pos.y][pos.x] = -1;
    return val;
  }

  // 检查最后删除的元素是否触发了箭头或者炸弹
  checkSpecialGridDeleted() {
    let list = [];
    let listAni = [];
    this.lastDelList.forEach(data => {
      let xy = this.idxToXY(data.idx);
      if (data.value > 100) {
        // 特殊道具，进行额外消除操作
        if (data.value > 400) {
          // 选三个同色的进行消除
          let color = data.value % 100;
          let listCanDel = [];
          this.gameInfo.listData.forEach((list, y) => {
            list.forEach((grid, x) => {
              if (grid == color) {
                listCanDel.push(this.xyToIdx(x, y));
              }
            });
          });
          listCanDel = _.shuffle(listCanDel);
          let listDel = listCanDel.slice(0, 3);
          list = list.concat(listDel);
          listAni.push({
            type: 400,
            xy,
            listDel: listDel
          });
        } else if (data.value > 300) {
          // 炸弹，辐射状消除 本行

          let dirList = [
            [0, 0],
            [-1, 0],
            [-2, 0],
            [1, 0],
            [2, 0],
            [0, -1],
            [-1, -1],
            [1, -1],
            [0, -2],
            [0, 1],
            [-1, 1],
            [1, 1],
            [0, 2]
          ];
          dirList.forEach(([dirX, dirY]) => {
            if (
              this.gameInfo.listData[xy.y + dirY] &&
              this.gameInfo.listData[xy.x + dirX]
            ) {
              let idxTarget = this.xyToIdx(xy.x + dirX, xy.y + dirY);
              list.push(idxTarget);
            }
          });
          listAni.push({
            type: 300,
            xy
          });
        } else if (data.value > 200) {
          // y轴消除
          for (let y = 0; y < 7; y++) {
            list.push(this.xyToIdx(xy.x, y));
          }
          listAni.push({
            type: 200,
            xy
          });
        } else {
          // x轴消除
          for (let x = 0; x < 7; x++) {
            list.push(this.xyToIdx(x, xy.y));
          }
          listAni.push({
            type: 100,
            xy
          });
        }
      }
    });
    this.lastDelList = [];
    return { list, listAni };
  }

  changeGrid(idx, value) {
    let xy = this.idxToXY(idx);
    this.gameInfo.listData[xy.y][xy.x] = value;
  }

  // 检查补满格子
  checkFall() {
    let listMap = this.gameInfo.listData;
    let mapMove = [];
    let res = [];
    while (true) {
      mapMove = [];
      // 倒着进行查询
      let coutMap = {};
      for (let y = this.row - 1; y >= 0; y--) {
        for (let x = this.col - 1; x >= 0; x--) {
          let grid = listMap[y][x];
          if (grid == -1) {
            // 上面的格子掉下来填满
            let posPre = { x, y };
            let targetLev = 0;
            while (true) {
              posPre.y--;
              if (!listMap[posPre.y]) {
                // 上方没有格子了
                coutMap[x] = coutMap[x] || 0;
                coutMap[x]++;
                targetLev = Util.getRandomInt(1, 6);
                mapMove.push({
                  idxTo: this.xyToIdx(x, y),
                  idxFrom: this.xyToIdx(x, y - 1) - 1000,
                  posFrom: { x, y: -coutMap[x] },
                  color: targetLev,
                  isNew: true
                });
                break;
              } else if (listMap[posPre.y][posPre.x] > -1) {
                // 找到格子
                targetLev = listMap[posPre.y][posPre.x];
                listMap[posPre.y][posPre.x] = -1;

                let conf = {
                  idxTo: this.xyToIdx(x, y),
                  idxFrom: this.xyToIdx(posPre.x, posPre.y),
                  posFrom: posPre,
                  color: targetLev,
                  isNew: false
                };
                let confCanMerge = mapMove.find(
                  conf2 => conf2.idxTo == conf.idxFrom
                );
                if (confCanMerge) {
                  confCanMerge.idxTo = conf.idxTo;
                } else {
                  mapMove.push(conf);
                }

                break;
              }
            }
            listMap[y][x] = targetLev;
          }
        }
      }
      // 相对上一次的移动进行合并操作

      if (mapMove.length == 0) {
        break;
      }
      res = res.concat(mapMove);
    }

    return res;
  }

  getRandomNew(): { list1_back; listNew } {
    let list1 = [];
    this.gameInfo.listData.forEach((row: number[], y) => {
      row.forEach((grid: number, x) => {
        let idx = this.xyToIdx(x, y);
        list1[idx] = grid;
      });
    });

    let list1_back = _.cloneDeep(list1);
    let listNew = [];

    // 随机
    for (let m = 0; m < 7; m++) {
      listNew[m] = [];
      for (let n = 0; n < 7; n++) {
        let colorLeft = -1;
        let colorTop = -1;
        if (n >= 1) {
          // 查询左侧的格子颜色
          colorLeft = listNew[m][n - 1] % 10;
        }
        if (m >= 1) {
          // 查询上侧的格子颜色
          colorTop = listNew[m - 1][n] % 10;
        }
        let listColor = list1.filter(
          color => color % 10 != colorLeft && color % 10 != colorTop
        );
        if (listColor.length == 0) {
          // 无解，重算
          return this.getRandomNew();
        }

        let randomIdx = Util.getRandomInt(0, listColor.length);

        listNew[m][n] = listColor[randomIdx];

        // 从list1里反查这个颜色，排除掉
        let idx2 = list1.findIndex(
          color => color % 10 == listColor[randomIdx] % 10
        );
        list1.splice(idx2, 1);
      }
    }
    return { list1_back, listNew };
  }
  // shuffle
  doShuffle() {
    // 得到新数组
    let { list1_back, listNew } = this.getRandomNew();
    let listIdxNew = [];
    listNew.forEach((row: number[], y) => {
      row.forEach((grid: number, x) => {
        let idx = this.xyToIdx(x, y);
        listIdxNew[idx] = grid;
      });
    });

    // 将老数据一一配对，得到乱序的动画起始结束的点
    let listShuffle = [];

    list1_back.forEach((color, idx) => {
      let listIdx = [];
      let endIdx = idx;
      listIdxNew.forEach((colorNew, idxNew) => {
        if (idxNew != idx && colorNew % 10 == color % 10) {
          listIdx.push(idxNew);
        }
      });
      if (listIdx.length > 0) {
        let idx3 = Util.getRandomInt(0, listIdx.length);
        endIdx = listIdx[idx3];
      } else {
        console.log("没有可以随机的位置了blabla");
      }
      // 将endIdx对应的颜色置空，防止后续重复随机
      listIdxNew[endIdx] = -1;

      listShuffle.push([idx, endIdx]);
    });

    // 赋值新棋盘
    this.gameInfo.listData = listNew;
    return { listShuffle, listData: this.gameInfo.listData };
  }
}
