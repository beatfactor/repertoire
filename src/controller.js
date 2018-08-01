import {handleActions} from 'redux-actions'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {call, take, put} from 'redux-saga/effects'

import Action from './action.js'
import Utils from './utils.js'
import ReduxStore from './store.js'

export default class BaseController {
  static getAllMethodNames(obj) {
    const reservedMethods = ['constructor', 'stateNamespace', 'toString', 'component', 'connect'];
    let methods = Reflect.ownKeys(obj.constructor.prototype);
    const baseClassMethods = Reflect.ownKeys(BaseController.prototype);

    methods = methods.filter(item => {
      return !reservedMethods.includes(item) && !item.startsWith('__');
    });

    methods.forEach(item => {
      if (baseClassMethods.includes(item)) {
        // eslint-disable-next-line no-console
        console.warn(`WARN: Controller method ${item} is a defined method on the super class. Overriding base controller methods ` +
        'can produce unexpected results.');
      }
    });

    return methods;
  }

  get stateNamespace() {
    return null;
  }

  get component() {
    if (this['@@connectComponent']) {
      return this['@@connectComponent'];
    }

    return this.__component;
  }

  directConnect(name = null) {
    ReduxStore.addGlobalSaga(this.sagaWatchers);
    ReduxStore.addGlobalReducer(name || this.__component.name, this);

    return this.connect();
  }

  get componentName() {
    if (typeof this.__component != 'function') {
      const err = new Error('React component is not defined.');
      console.error('Received:', this.__component);

      throw err;
    }

    if (!this.__component.name) {
      const err = new Error('Components must have a name property defined.');
      console.error('Received:', this.__component);

      throw err;
    }

    return this.__component.name.toLowerCase();
  }

  get reducer() {
    return handleActions(this.__reducers, this.initialState);
  }

  get sagaWatchers() {
    return this.__sagaWatchers;
  }

  get actionCreators() {
    return Object.keys(this.__actions).reduce((prev, action) => {
      prev[this.__convertedActionNames[action]] = this.__actions[action].reduxAction;

      return prev;
    }, {});
  }

  /**
   * @return {{}}
   */
  mapDispatchToProps(dispatch, props) {
    const actionCreators = Object.keys(this.actionCreators).reduce((prev, key) => {
      if (this[key]) {
        this[key] = (...args) => {
          const deferred = this.__actionPromises[key];
          dispatch(this.actionCreators[key](...args));

          return deferred.promise;
        };
      }

      prev[key] = this.actionCreators[key];

      return prev;
    }, {});

    return bindActionCreators(actionCreators, dispatch);
  }

  get state() {
    return this.stateContainer;
  }

  get stateContainer() {
    if (this['@@reduxStoreFn']) {
      return this['@@reduxStoreFn'](true);
    }

    return this['@@reduxStore'];
  }

  setStateContainer(fn) {
    this['@@reduxStoreFn'] = fn;
  }

  setCurrentState(state) {
    if (this['@@reduxStoreFn']) {
      return this['@@reduxStoreFn']().call(this, state);
    }

    this['@@reduxStore'] = state;

    return this;
  }

  set state(value) {
    if (!Utils.isObject(value)) {
      throw new Error(`Passed value must be an object: ${typeof value} given.`);
    }

    value.lastThrownError = ('lastThrownError' in value) ? value.lastThrownError : function(state) {
      return state.lastThrownError || null;
    };

    Object.keys(value).forEach(key => {
      let handler = value[key];

      if (Utils.isEmptyObject(handler)) {
        return;
      }

      const valueFn = Utils.isFunction(handler) ? handler : function() {
        return handler;
      };

      this.__mapStateToProps[key] = {
        value: valueFn
      };
      this.__initialState[key] = valueFn.call(this, this.initialState);

    });
  }

  get initialState() {
    return this.__initialState;
  }

  constructor(component) {
    this['@@reduxStore'] = {};
    this['@@reduxStoreFn'] = null;
    this['@@connectComponent'] = null;
    this.__actions = {};
    this.__reducers = {};
    this.__initialState = {};
    this.__contexts = {};
    this.__mapStateToProps = {};
    this.__sagaWatchers = [];
    this.__convertedActionNames = {};
    this.__actionPromises = {};

    this.addDispatchActionCreators();

    this.__component = component;
  }

  connect() {
    this['@@connectComponent'] = connect(this.mapStateToProps.bind(this), this.mapDispatchToProps.bind(this))(this.__component);

    return this['@@connectComponent'];
  }

  /**
   * Given an initial list of action strings, create redux actions and store them for later use
   */
  addDispatchActionCreators() {
    const methodNames = BaseController.getAllMethodNames(this);

    methodNames.forEach(action => {
      this.addActionCreator(action);
      this.addStandaloneAction(action);
    });
  }

  /**
   *
   * @param {Action|string} instanceOrName
   * @param {string} [name]
   */
  addActionCreator(instanceOrName, name = '') {
    if (Utils.isString(instanceOrName)) {
      this.addActionCreator(Action.create(instanceOrName), instanceOrName);

      return;
    }

    this.__actions[name] = instanceOrName;
    this.__convertedActionNames[name] = this.__actions[name].convertedName;

    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    this.__actionPromises[this.__convertedActionNames[name]] = deferred;
  }

  mapStateToProps(state) {
    return (state, ownProps) => {
      return Object.keys(this.__mapStateToProps).reduce((prev, key) => {
        const namespace = this.stateNamespace || this.componentName;
        const localState = namespace ? (state[namespace] || {}) : state;

        prev[key] = this.__mapStateToProps[key].value.call(this, localState);

        return prev;
      }, {});
    };
  }

  /**
   *
   * @param {string} actionName
   */
  addStandaloneAction(actionName) {
    const actionFn = this[actionName];

    this.addDispatchActionWatcher(actionName, actionFn, this);
  }

  addDispatchActionWatcher(actionName, fn, context) {
    const actionInstance = Action.create(actionName);
    const reducerInstance = Action.create(actionName + '@@reducer');
    const reducerAction = reducerInstance.reduxAction;
    const setState = this.setCurrentState.bind(this);
    const deferred = this.__actionPromises[actionInstance.convertedName];

    this.addActionCreator(reducerInstance, reducerInstance.convertedName);

    this.__reducers[reducerInstance.convertedName] = {
      next: (state, action) => {
        const actionObj = Object.assign({}, action);

        if (action.payload.__type && action.payload.__data) {
          actionObj.initiator = action.payload.__type;
          actionObj.payload = action.payload.__data;
        }

        let newState = {...state};
        // resetting lastThrownError
        if ((state.lastThrownError instanceof Error) && !(actionObj.payload instanceof Error)) {
          newState.lastThrownError = null;
        }

        if (actionObj.payload instanceof Error) {
          actionObj.payload.initiator = actionObj.initiator;

          newState = Object.assign(newState, {lastThrownError: actionObj.payload});
          deferred.reject(actionObj.payload);
        } else {
          newState = Object.assign(newState, actionObj.payload);

          if (newState.lastError instanceof Error && (!this.state.lastError || this.state.lastError !== newState.lastError)) {
            const lastError = new Error(newState.lastError.message);
            Object.keys(newState.lastError).forEach(key => {
              lastError[key] = newState.lastError[key];
            });

            lastError.initiator = actionObj.initiator;
            newState.lastError = lastError;
          }

          deferred.resolve(newState);
        }

        setState(newState);

        return newState;
      }
    };

    const watcher = function* () {
      while (true) {
        const action = yield take(actionInstance.convertedName);
        const payload = action.payload;

        try {
          const actionDispatcher = function(params) {
            let dispatchResult = fn ? fn.call(context, params) : null;
            if (!(dispatchResult instanceof Promise)) {
              dispatchResult = Promise.resolve(dispatchResult);
            }

            return function* fetch() {
              try {
                const data = yield call(function(res) {
                  return function() {
                    return res;
                  };
                }(dispatchResult));

                yield put(reducerAction({
                  __data: data,
                  __dispatchResult: dispatchResult,
                  __type: actionInstance.type,
                  __actionName: actionInstance.convertedName
                }));
              } catch (callErr) {
                console.error(`An error occurred while processing the result of "${actionInstance.convertedName}" action:`, callErr);
                yield put(reducerAction({
                  __data: callErr,
                  __dispatchResult: dispatchResult,
                  __type: actionInstance.type,
                  __actionName: actionInstance.convertedName
                }));
              }
            };
          };

          ReduxStore.addGlobalActionDispatcher(actionInstance.convertedName, actionDispatcher);
          yield call(actionDispatcher(payload));
        } catch (err) {
          console.error(`An error occurred while running "${actionInstance.convertedName}" action:`, err);
        }
      }
    };

    this.__sagaWatchers.push(watcher);
  }

  addWatcher(actionName, fn) {
    const watcher = function* () {
      while (true) {
        const action = yield take(actionName);
        const payload = action.payload;

        yield call(function fetch() {
          fn(payload);
        });
      }
    };

    this.__sagaWatchers.push(watcher);
  }

  toString() {
    return `"Controller <${this.componentName}>"`;
  }
}