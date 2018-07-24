import Action from './action.js';
import Utils from './utils.js';

export default class Reducer extends Action {
  static get REDUCER_ACTION_PREFIX() {
    return 'SET_';
  }

  static get defaultValue() {
    return null;
  }

  constructor(key, handler, context) {
    super(...arguments);

    this.create();
  }

  /**
   * @return {function}
   */
  mappedValueFn() {
    const mappedValueFn = this.originalHandler.value;

    if (Utils.isFunction(mappedValueFn)) {
      return mappedValueFn;
    }

    return (state) => {
      if (this.key in state) {
        return state[this.key];
      }

      if ('defaultValue' in this.originalHandler) {
        return this.originalHandler.defaultValue;
      }

      return Reducer.defaultValue;
    };
  }

  /**
   * @param {string} key
   * @return {function}
   */
  reducerFn(key) {
    const reducerFn = this.originalHandler.reducer;

    if (Utils.isFunction(reducerFn)) {
      return reducerFn;
    }

    return function(state, action) {
      return {
        ...state,
        [key]: action.payload
      };
    };
  }

  create() {
    const actionName = this.generateName(Reducer.REDUCER_ACTION_PREFIX, this.key);
    this.createReduxAction(actionName);
  }
}

