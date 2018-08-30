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
}