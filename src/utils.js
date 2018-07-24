export default class Utils {
  static get ACTION_CONVERT_FORMAT() {
    return /^[_A-Z]+$/;
  }

  static shouldConvertName(actionName) {
    return Utils.ACTION_CONVERT_FORMAT.test(actionName);
  }

  static convertActionName(actionName, opts = {lowerCaseStr: true}) {
    if (!Utils.shouldConvertName(actionName)) {
      return actionName;
    }

    let parts = actionName.split('_');

    return parts.reduce(function(prev, value, index) {
      if (index === 0) {
        prev = value.toLowerCase();
      } else {
        let remnant = value.substring(1);
        if (opts.lowerCaseStr) {
          remnant = remnant.toLowerCase();
        }
        prev += value.charAt(0).toUpperCase() + remnant;
      }

      return prev;
    }, '');
  }

  static isObject(handler) {
    return handler && typeof handler == 'object';
  }

  static isEmptyObject(handler) {
    return Utils.isObject(handler) && Object.keys(handler).length === 0;
  }

  static isFunction(handler) {
    return typeof handler == 'function';
  }

  static isString(handler) {
    return typeof handler == 'string';
  }
}