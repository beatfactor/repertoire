import {combineReducers, compose, createStore, applyMiddleware} from 'redux'
import createSagaMiddleware, {END} from 'redux-saga'
import {all, fork} from 'redux-saga/effects'
import {handleActions} from 'redux-actions'

import Controller from './controller.js'


export const dispatchActions = {};

let __global_reducers__ = {};
let __global_sagas__ = [];
const __actionDispatchers__ = {};
const __commonStateContainer__ = {};

class StoreManager {
  static addGlobalReducer(name, controller) {
    name = name.toLowerCase();

    if (controller.stateNamespace) {
      __global_reducers__[controller.stateNamespace] = __global_reducers__[controller.stateNamespace] || [];
      __global_reducers__[controller.stateNamespace].push(controller);
    } else {
      if (__global_reducers__[name]) {
        console.error(`Duplicate declaration for component with name "${name}".`);
      }

      __global_reducers__[name] = [controller];
    }
  }

  static addGlobalSaga(sagaWatchers) {
    sagaWatchers = sagaWatchers.map(saga => fork(saga));
    __global_sagas__.push(...sagaWatchers);
  }

  static addGlobalActionDispatcher(action, fn) {
    __actionDispatchers__[action] = fn;
  }

  constructor(routes, initialState) {
    this.routes = routes;

    this.createControllers();
    this.createRootReducer();
    this.createRootSaga();
    this.create(initialState);
  }

  serializeObjectProps(item) {
    const keys = Object.keys(item);

    return '{' + keys.reduce(function(prev, value) {
      const name = (typeof item[value] == 'object' && item[value] || typeof item[value] == 'function') ?
        (item[value].name || item[value].toString()) : '';

      prev.push(`"${value}": ${name || item[value].toString()}`);

      return prev;
    }, []).join(', ') + '}';
  }

  createControllers() {
    this.controllers = this.routes.reduce((prev, item) => {
      if (!item.path) {
        throw new Error(`Route entry is missing the path property. Received: ${this.serializeObjectProps(item)}`);
      }

      if (!item.component) {
        throw new Error(`Route "${item.path}" needs a component property which is either a React component or a Controller instance.`);
      }

      const controllerName = item.component.stateNamespace || item.component.componentName;

      if (item.component instanceof Controller && !prev[controllerName]) {
        prev[controllerName] = item.component;
      }

      return prev;
    }, {});
  }

  mergeReducers(name, controllers) {
    __commonStateContainer__[name] = {};

    const combinedReducers = controllers.reduce((prev, controller) => {
      Object.keys(controller.__reducers).forEach(key => {
        prev[key] = controller.__reducers[key];
      });

      Object.assign(__commonStateContainer__[name], controller.initialState);

      controller.setStateContainer(function(evaluate) {
        if (evaluate) {
          return __commonStateContainer__[name];
        }

        return function(state) {
          __commonStateContainer__[name] = Object.assign({}, __commonStateContainer__[name], state);

          return this;
        };
      });

      return prev;
    }, {});

    return handleActions(combinedReducers, __commonStateContainer__[name]);
  }

  createRootReducer() {
    const combinedControllers = Object.assign({}, __global_reducers__);
    __global_reducers__ = {};

    Object.keys(this.controllers).forEach(stateNamespace => {
      combinedControllers[stateNamespace] = combinedControllers[stateNamespace] || [];
      combinedControllers[stateNamespace].push(this.controllers[stateNamespace]);
    });

    Object.keys(combinedControllers).forEach(stateNamespace => {
      combinedControllers[stateNamespace].forEach(controller => {
        Object.assign(dispatchActions, controller.actionCreators);
      });
    });

    const reducers = Object.keys(combinedControllers).reduce((prev, name) => {
      if (combinedControllers[name].length === 1) {
        prev[name] = combinedControllers[name][0].reducer;
      } else {
        prev[name] = this.mergeReducers(name, combinedControllers[name]);
      }

      return prev;
    }, {});

    this.rootReducer = combineReducers(reducers);

    return this;
  }

  createRootSaga() {
    const initialSagas = __global_sagas__.slice(0);

    let sagas = Object.keys(this.controllers).reduce((prev, key) => {
      prev = prev.concat(this.controllers[key].sagaWatchers.map(saga => fork(saga)));

      return prev;
    }, initialSagas);

    __global_sagas__ = [];

    this.rootSaga = function* () {
      yield all(sagas);
    };

    return this;
  }

  createFinalStore(state) {
    const sagaMiddleware = createSagaMiddleware();

    const store = compose(applyMiddleware(sagaMiddleware))(createStore)(this.rootReducer, state, window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__());
    store.runSaga = sagaMiddleware.run;
    store.close = () => store.dispatch(END);

    return store;
  }

  getStore() {
    return this.store;
  }

  create(initialState = {}) {
    this.store = this.createFinalStore(initialState);
    this.store.runSaga(this.rootSaga);

    return this;
  }
}

export default StoreManager;