import {createAction} from 'redux-actions'
import Utils from './utils.js'

export default class Action {
  static get FETCH_ACTION_PREFIX() {
    return 'FETCH_';
  }

  /**
   *
   * @param {string|null} [actionName]
   * @param key
   * @param handler
   * @param context
   * @return {Action}
   */
  static create(actionName = null, key, handler, context) {
    if (Utils.isFunction(arguments[0]) && arguments.length === 3) {
      return Action.createFromFunction(key, arguments[0], context);
    }

    return Action.createFromHandler(...arguments);
  }

  static createFromFunction(key, fn, context) {
    const action = new Action(key, fn, context);
    const convertedName = action.generateName(Action.FETCH_ACTION_PREFIX);

    return action.createReduxAction(convertedName);
  }

  static createFromHandler(actionName) {
    const action = new Action();
    const convertedName = Utils.convertActionName(actionName);

    return action.setType(actionName).createReduxAction(convertedName);
  }

  constructor(key = '', handler = null, context = null) {
    this.key = key;
    this.originalHandler = handler;
    this.context = context;
  }

  createReduxAction(convertedName) {
    this.convertedName = convertedName;
    this.reduxAction = createAction(convertedName);

    return this;
  }

  generateName(prefix) {
    const type = Utils.convertActionName(prefix + this.key, {
      lowerCaseStr: false
    });

    this.type = type;

    return type;
  }

  setType(actionName) {
    this.type = actionName;

    return this;
  }
}