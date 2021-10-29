import RoomManager from "./controller/RoomManager";
import PROTOCLE from "./config/PROTOCLE";
import UserManager from "./controller/UserManager";
import { PEOPLE_EACH_GAME_MAX, MATCH_NEED } from "./config";
import Util from "./Util";

export default class socketManager {
  static io;
  static userSockets = {};
  static userMap: UserManager[] = [];
  static aliveRoomList: RoomManager[] = [];
  static getRoomCanJoin(isMatch = false): RoomManager {
    // 检查当前已存在的房间中 公开的，人未满的,未开始游戏的
    let list = this.aliveRoomList.filter((roomCtr: RoomManager) => {
      return (
        roomCtr.isMatch == isMatch &&
        roomCtr.isPublic &&
        roomCtr.uidList.length < (isMatch ? MATCH_NEED : 2) &&
        !roomCtr.isStarted
      );
    });
    if (list.length == 0) {
      let roomNew = new RoomManager(isMatch);
      this.aliveRoomList.push(roomNew);
    }
    return this.aliveRoomList[this.aliveRoomList.length - 1];
  }
  // 公共错误广播
  static sendErrByUidList(uidList: number[], protocle: string, data) {
    this.sendMsgByUidList(uidList, PROTOCLE.SERVER.ERROR, {
      protocle,
      data
    });
  }
  static sendMsgByUidList(userList: number[], type: string, data = {}) {
    userList.forEach(uid => {
      let socket = this.userSockets[uid];
      if (socket) {
        socket.emit("message", {
          type,
          data
        });
      }
    });
  }
  static init(io) {
    this.io = io;
    this.listen();
  }
  static getUserCtrById(uid) {
    if (!this.userMap[uid]) {
      this.userMap[uid] = new UserManager({
        avatar: "",
        nickname: "机器人" + uid,
        uid,
        sex: 1,
        score: 0
      });
    }
    let ctrUser = this.userMap[uid];
    return ctrUser;
  }
  static getUserInfoById(uid) {
    if (!this.userMap[uid]) {
      this.userMap[uid] = new UserManager({
        avatar: "",
        nickname: "机器人" + uid,
        uid,
        sex: 1,
        score: 0
      });
    }
    let ctrUser = this.userMap[uid];
    return ctrUser.getInfo();
  }
  static listen() {
    this.io.on("connect", this.onConnect);
    this.io.on("disconnect", this.onDisconnect);
  }
  static getRoomCtrByRoomId(roomId): RoomManager {
    return this.aliveRoomList.find(roomCtr => roomCtr.roomId == roomId);
  }
  static onMessage(res, socket) {
    console.log("收到消息", res);
    // 公共头
    let uid = res.uid;
    if (!uid) {
      return;
    }
    if (!this.userMap[uid]) {
      this.userMap[uid] = new UserManager(res.userInfo);
    }
    let data = res.data;
    let type = res.type;
    this.userSockets[uid] = socket;

    let userCtr = this.getUserCtrById(uid);
    let roomId = userCtr.inRoomId;
    let roomCtr = this.getRoomCtrByRoomId(roomId);

    switch (type) {
      case PROTOCLE.CLIENT.EXIT: {
        if (roomCtr) {
          roomCtr.leave(uid);
        }
        break;
      }
      case PROTOCLE.CLIENT.RECONNECT: {
        // 检测重连数据
        let dataGame: any = {
          isMatch: data.isMatch
        };
        let userInfo = userCtr.getInfo();

        if (userCtr.inRoomId && roomCtr) {
          // 获取游戏数据并返回
          dataGame = roomCtr.getRoomInfo(uid);
        }
        this.sendMsgByUidList([userCtr.uid], PROTOCLE.SERVER.RECONNECT, {
          userInfo: userInfo,
          dataGame
        });
        break;
      }
      case PROTOCLE.CLIENT.RANK: {
        // 参与排位赛
        break;
      }
      case PROTOCLE.CLIENT.MATCH: {
        // 参与或者取消匹配
        let { flag, isMatch } = data;
        if (flag) {
          if (roomCtr) {
            this.sendErrByUidList([userCtr.uid], PROTOCLE.CLIENT.MATCH, {
              msg: "已经处于游戏中，无法匹配"
            });
            return;
          }
          let targetRoom: RoomManager;
          targetRoom = this.getRoomCanJoin(isMatch);

          targetRoom.join(uid, data.propId);
          userCtr.inRoomId = targetRoom.roomId;
          userCtr.updateToClient();
        } else {
          if (!roomCtr) {
            return;
          }
          roomCtr.leave(uid);
          userCtr.inRoomId = 0;
          userCtr.updateToClient();
        }
        break;
      }
      case PROTOCLE.CLIENT.USE_PROP: {
        if (!roomCtr) {
          return;
        }
        roomCtr.useProp(data.id, uid);
        break;
      }
      case PROTOCLE.CLIENT.DO_MOVE: {
        if (!roomCtr) {
          return;
        }
        // 发回接收到的时间戳，计算ping
        roomCtr.doMove(data.idx1, data.idx2, uid);
        break;
      }
      case PROTOCLE.CLIENT.SHUFFLE: {
        if (!roomCtr) {
          return;
        }
        roomCtr.askShuffle(uid);
        break;
      }
      case PROTOCLE.CLIENT.DO_CHUIZI: {
        if (!roomCtr) {
          return;
        }
        roomCtr.askChuizi(uid, data.idx);
        break;
      }
      case PROTOCLE.CLIENT.PING: {
        // 发回接收到的时间戳，计算ping
        this.sendMsgByUidList([uid], PROTOCLE.SERVER.PING, {
          timestamp: data.timestamp
        });
        break;
      }
    }
  }
  static onDisconnect(socket) {
    // 通过socket反查用户，将用户数据标记为断线
    // for (let uid in this.userSockets) {
    //   if (this.userSockets[uid] == socket) {
    //     // 踢出用户
    //     let userCtr = this.getUserCtrById(uid);
    //     let roomId = userCtr.inRoomId;
    //     let roomCtr = this.getRoomCtrByRoomId(roomId);
    //     if (roomCtr && !roomCtr.isStarted) {
    //       roomCtr.leave(uid);
    //       userCtr.inRoomId = 0;
    //     }
    //   }
    // }
  }
  static onConnect(socket) {
    socket.on("message", res => {
      console.log(this.onMessage);
      socketManager.onMessage(res, socket);
    });
  }
}
