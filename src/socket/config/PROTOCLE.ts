export default class PROTOCLE {
  static CLIENT = {
    EXIT: "EXIT",
    MATCH: "MATCH",
    RECONNECT: "RECONNECT",
    PING: "PING",
    SHUFFLE:'SHUFFLE',
    DO_CHUIZI:"DO_CHUIZI",
    UPDATE_USER_INFO: "UPDATE_USER_INFO",
    DO_MOVE:'DO_MOVE',
    RANK:"RANK",
    USE_PROP:'USE_PROP'
  };
  static SERVER = {
    MOVE:'MOVE',
    RANK_ENTER:'RANK_ENTER',
    RANK:"RANK",
    DO_CHUIZI:"DO_CHUIZI",
    SHUFFLE:'SHUFFLE',
    GAME_CHANGE_POWER:'GAME_CHANGE_POWER',
    ERROR: "ERROR",
    PING: "PING",
    RECONNECT: "RECONNECT",
    SHOW_MATCH_SUCCESS: "SHOW_MATCH_SUCCESS",
    SHOW_MATCH_ENTER: "SHOW_MATCH_ENTER",
    GAME_START: "GAME_START",
    UPDATE_USER_INFO: "UPDATE_USER_INFO",
    UPDATE_GAME_INFO: "UPDATE_GAME_INFO",
    SHOW_GAME_START: "SHOW_GAME_START",
    USE_PROP:'USE_PROP',
    GAME_FINISH:'GAME_FINISH',
  };
}
